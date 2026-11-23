'use strict';
// DevPilot: run, switch and clean your projects with buttons.
if (process.argv.includes('--uninstall')) { require('./uninstall'); return; }   // Windows "Uninstall" runs this
const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, Notification, nativeImage, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { Store } = require('./lib/store');
const { scanProject, findProjects } = require('./lib/scan');
const { Procs } = require('./lib/procs');
const ports = require('./lib/ports');
const urls = require('./lib/urls');
const images = require('./lib/images');
const { run, exists } = require('./lib/util');

app.setAppUserModelId('com.devpilot.app');
if (!app.requestSingleInstanceLock()) { app.quit(); }

const DATA = app.getPath('userData');            // %APPDATA%\DevPilot
const store = new Store(DATA);
const procs = new Procs();
procs.autoRestart = !!store.settings.autoRestart;
const scans = new Map();                         // projectId -> last scan
let win = null, tray = null, quitting = false, trayHintShown = false;

const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };
const toast = (text, kind = 'info') => send('toast', { text, kind });
const keyOf = (pid, rel) => `${pid}|${rel || ''}`;
const taskKey = (pid, rel, action) => `${pid}|${rel || ''}|${action}`;

// ---------------------------------------------------------------- scanning, with your own choices on top
function scanOf(pid, fresh = true) {
  const p = store.project(pid);
  if (!p) throw new Error('Project not found.');
  if (!exists(p.path)) throw new Error(`The folder ${p.path} does not exist any more.`);
  if (!fresh && scans.has(pid)) return scans.get(pid);
  const s = scanProject(p.path);
  for (const part of s.parts) {
    const o = (p.parts || {})[part.rel] || {};
    if (o.dev && part.scripts[o.dev]) { part.dev = o.dev; part.commands.dev = cmdFor(part, o.dev); }
    if (o.port) { part.port = +o.port; part.portFrom = 'set by you'; }
    if (o.inStartAll === false || o.inStartAll === true) part.inStartAll = o.inStartAll;
  }
  scans.set(pid, s);
  return s;
}
const cmdFor = (part, script) => (part.pm === 'yarn' ? `yarn ${script}` : `${part.pm} run ${script}`);
const partOf = (pid, rel) => { const s = scanOf(pid, false); const part = s.parts.find((x) => x.rel === rel); if (!part) throw new Error('This part was not found: scan the project again.'); return part; };

function projectsOut() {
  return store.projects().map((p) => ({ ...p, exists: exists(p.path), local: !!urls.status(DATA, p.id) }));
}

// ---------------------------------------------------------------- running things
async function runAction(pid, rel, action, opts = {}) {
  const part = partOf(pid, rel);
  const p = store.project(pid);
  if (action === 'dev' || action === 'prod' || action === 'up') {
    const cmd = action === 'prod' ? part.commands.prod : part.commands.dev;
    if (!cmd) throw new Error(`No ${action === 'prod' ? 'production start' : 'start'} command found for ${part.name}.`);
    const key = keyOf(pid, rel);
    if (procs.running(key)) return { already: true, state: procs.state(key) };
    if (part.port && !opts.force) {
      if (opts.killFirst) { for (const u of await ports.whoUses(part.port)) await ports.killPid(u.pid); }
      else if (await ports.isOpen(part.port)) return { busy: await ports.whoUses(part.port), port: part.port };
    }
    return { state: procs.start(key, { kind: 'server', cmd, cwd: part.dir, project: pid, part: rel, action, port: part.port, label: `${p.name} · ${part.name}` }) };
  }
  const cmd = action === 'build' ? part.commands.build : action === 'install' ? part.commands.install : action === 'down' ? part.commands.down
    : action.startsWith('script:') ? cmdFor(part, action.slice(7)) : null;
  if (!cmd) throw new Error(`Nothing to run for "${action}" in ${part.name}.`);
  const key = taskKey(pid, rel, action);
  if (procs.running(key)) return { already: true, state: procs.state(key) };
  return { state: procs.start(key, { kind: 'task', cmd, cwd: part.dir, project: pid, part: rel, action, label: `${p.name} · ${part.name} · ${action.replace('script:', '')}` }) };
}

async function startAll(pid, profileId) {
  const s = scanOf(pid);
  const p = store.project(pid);
  const prof = (p.profiles || []).find((x) => x.id === profileId);
  let parts = s.parts.filter((x) => x.kind !== 'docker' && x.commands.dev && x.inStartAll !== false);
  if (prof) parts = s.parts.filter((x) => prof.parts.includes(x.rel) && x.commands.dev);
  const notInstalled = parts.filter((x) => !x.installed);
  parts = parts.filter((x) => x.installed);
  const busy = [];
  const startOne = async (part) => { const r = await runAction(pid, part.rel, 'dev'); if (r.busy) busy.push({ part: part.name, port: r.port, who: r.busy }); return r; };
  const backs = parts.filter((x) => x.role === 'backend');
  const rest = parts.filter((x) => x.role !== 'backend');
  for (const b of backs) {
    const r = await startOne(b);
    if (r.state && !r.already) await procs.waitReady(keyOf(pid, b.rel), 90000);      // the server first: the pages need it
  }
  await Promise.all(rest.map(startOne));
  return { started: parts.length - busy.length, notInstalled: notInstalled.map((x) => x.name), busy };
}

async function installAll(pid) {
  const s = scanOf(pid);
  const todo = s.parts.filter((x) => x.commands.install && x.kind !== 'docker');
  for (const part of todo) await runAction(pid, part.rel, 'install');
  return { count: todo.length };
}

// ---------------------------------------------------------------- VS Code / folders / browser
async function vscodePath() {
  const s = store.settings.vscode;
  if (s && exists(s)) return s;
  const cands = [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft VS Code', 'Code.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft VS Code', 'Code.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor', 'Cursor.exe')];
  for (const c of cands) if (exists(c)) return c;
  const r = await run(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe'), ['code.cmd']);
  const line = r.out.split(/\r?\n/).find(Boolean);
  return line && exists(line) ? line : null;
}
async function openInCode(target, line) {
  const exe = await vscodePath();
  if (!exe) throw new Error('VS Code was not found. Set its location in Settings.');
  const args = line ? ['-g', `${target}:${line}`] : [target];
  if (/\.cmd$/i.test(exe)) spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', exe, ...args], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  else spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();
  return true;
}

// ---------------------------------------------------------------- git
async function git(dir, args, timeout = 60000) { return run('git', ['-C', dir, ...args], { timeout }); }
async function gitStatus(pid) {
  const p = store.project(pid);
  const r = await git(p.path, ['status', '--porcelain=v1', '-b']);
  if (!r.ok) return { ok: false, error: /not a git repository/i.test(r.err) ? 'This project is not a Git repository.' : (r.err || 'Git is not available.').trim() };
  const lines = r.out.split(/\r?\n/).filter(Boolean);
  const head = lines.shift() || '';
  const m = /^## ([^.\s]+)(?:\.\.\.(\S+))?(?: \[(.+)\])?/.exec(head) || [];
  const files = lines.map((l) => ({ st: l.slice(0, 2), file: l.slice(3) }));
  const br = await git(p.path, ['branch', '--format=%(refname:short)']);
  return { ok: true, branch: m[1] || '', upstream: m[2] || '', track: m[3] || '', files, branches: br.out.split(/\r?\n/).filter(Boolean) };
}

// ---------------------------------------------------------------- images: build check + shrink
function waitTask(key) {
  return new Promise((resolve) => {
    const on = (s) => { if (s.key === key) { off(); resolve(s.status === 'done'); } };
    const off = () => { procs.off('task-done', on); procs.off('task-failed', on); };
    procs.on('task-done', on); procs.on('task-failed', on);
  });
}
async function trashImages(pid, files, buildParts) {
  const p = store.project(pid);
  const res = images.moveToTrash(DATA, pid, p.path, files);
  if (!res.moved.length) return { moved: 0 };
  if (buildParts && buildParts.length) {
    for (const rel of buildParts) {
      const key = taskKey(pid, rel, 'build');
      const r = await runAction(pid, rel, 'build');
      const ok = r.already ? true : await waitTask(key);
      if (!ok) {
        const back = images.restore(DATA, pid, res.batch);
        return { moved: 0, buildFailed: rel, restored: back.restored.length };
      }
    }
  }
  return { moved: res.moved.length, batch: res.batch };
}
function shrinkImage(pid, full, maxW = 2000) {
  const p = store.project(pid);
  const rel = path.relative(p.path, full);
  if (rel.startsWith('..')) throw new Error('Not a file of this project.');
  const img = nativeImage.createFromPath(full);
  if (img.isEmpty()) throw new Error('This image type cannot be shrunk here (only PNG and JPG).');
  const { width, height } = img.getSize();
  const isJpg = /\.jpe?g$/i.test(full);
  const r = width > maxW ? img.resize({ width: maxW, height: Math.round(height * maxW / width), quality: 'best' }) : img;
  const buf = isJpg ? r.toJPEG(82) : r.toPNG();
  const before = fs.statSync(full).size;
  if (buf.length >= before * 0.95) return { saved: 0, before, after: before, note: 'Already small: left as it is.' };
  const keep = images.moveToTrash(DATA, pid, p.path, [full], 'original before shrinking');   // the original goes to the Trash first
  fs.writeFileSync(full, buf);
  return { saved: before - buf.length, before, after: buf.length, batch: keep.batch };
}

// ---------------------------------------------------------------- IPC
const H = (ch, fn) => ipcMain.handle(ch, async (e, ...a) => { try { return { ok: true, data: await fn(...a) }; } catch (err) { return { ok: false, error: String(err && err.message || err) }; } });

H('state', () => ({ settings: store.settings, projects: projectsOut(), last: store.data.lastProject, procs: procs.states(), version: app.getVersion(), data: DATA, dark: nativeTheme.shouldUseDarkColors }));
H('settings', (patch) => { const s = store.setSettings(patch); procs.autoRestart = !!s.autoRestart; theme(); return s; });
H('pick-folder', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Choose a project folder' }); return r.canceled ? null : r.filePaths[0]; });
H('pick-file', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Programs', extensions: ['exe', 'cmd'] }] }); return r.canceled ? null : r.filePaths[0]; });
H('project-add', (dir) => { if (!dir || !exists(dir)) throw new Error('This folder does not exist.'); const p = store.addProject(dir); store.data.lastProject = p.id; store.save(); return p; });
H('project-add-many', (dirs) => dirs.filter(exists).map((d) => store.addProject(d)));
H('project-find', (base) => findProjects(base || 'D:\\').map((x) => ({ ...x, added: store.projects().some((p) => p.path.toLowerCase() === x.path.toLowerCase()) })));
H('project-update', (pid, patch) => { const p = store.updateProject(pid, patch); scans.delete(pid); return p; });
H('project-remove', async (pid) => { await procs.stopAll((it) => it.project === pid); store.removeProject(pid); scans.delete(pid); return true; });
H('project-open', (pid) => { store.data.lastProject = pid; store.save(); return true; });
H('scan', (pid) => scanOf(pid, true));
H('part-set', (pid, rel, patch) => { const p = store.project(pid); p.parts = p.parts || {}; p.parts[rel] = { ...(p.parts[rel] || {}), ...patch }; store.save(); return scanOf(pid, true); });

H('run', (pid, rel, action, opts) => runAction(pid, rel, action, opts || {}));
H('stop', (key) => procs.stop(key));
H('restart', async (pid, rel) => { const key = keyOf(pid, rel); const st = procs.state(key); await procs.stop(key); return runAction(pid, rel, st && st.action === 'prod' ? 'prod' : 'dev', { killFirst: true }); });
H('start-all', (pid, profileId) => startAll(pid, profileId));
H('stop-all', (pid) => procs.stopAll((it) => it.project === pid));
H('restart-all', async (pid) => { await procs.stopAll((it) => it.project === pid && it.kind === 'server'); return startAll(pid); });
H('install-all', (pid) => installAll(pid));
H('custom', (pid, bid) => {
  const p = store.project(pid); const b = (p.buttons || []).find((x) => x.id === bid);
  if (!b) throw new Error('Button not found.');
  const cwd = b.part ? path.join(p.path, b.part) : p.path;
  const key = taskKey(pid, b.part || '', 'custom:' + bid);
  if (procs.running(key)) return { already: true };
  return { state: procs.start(key, { kind: b.long ? 'server' : 'task', cmd: b.cmd, cwd, project: pid, part: b.part || '', action: 'custom:' + bid, label: `${p.name} · ${b.label}` }) };
});
H('logs', (key) => procs.logs(key));
H('logs-clear', (key) => { procs.clearLogs(key); return true; });

H('ports', async () => {
  const list = await ports.listening();
  const mine = new Map();
  for (const st of procs.states()) if (st.port && ['starting', 'running'].includes(st.status)) mine.set(st.port, st.label);
  return list.map((x) => ({ ...x, mine: mine.get(x.port) || '' }));
});
H('port-who', (port) => ports.whoUses(port));
H('kill', (pid) => ports.killPid(pid));

H('urls-find', (pid) => { const s = scanOf(pid, true); const r = urls.find(s); const st = urls.status(DATA, pid); return { ...r, localMode: !!st, since: st ? st.at : null, files: st ? Object.keys(st.files).map((f) => path.relative(s.path, f).replace(/\\/g, '/')) : [] }; });
H('urls-local', (pid, ids, extra, overrides) => {
  const s = scanOf(pid, true); const r = urls.find(s); const p = store.project(pid);
  const ov = overrides || {};
  for (const g of r.items) if (ov[g.id] && /^https?:\/\//i.test(ov[g.id]) && g.mode === 'replace') { g.local = ov[g.id]; g.needsPort = false; }
  p.urlPick = ids; p.urlExtra = extra || []; p.urlOverrides = ov; store.save();
  return urls.toLocal(DATA, p, { ...r, parts: s.parts }, ids, extra || []);
});
H('urls-prod', (pid) => urls.toProd(DATA, store.project(pid)));

H('images-scan', (pid, opts) => images.scan(store.project(pid).path, opts || {}));
H('images-trash', (pid, files, buildParts) => trashImages(pid, files, buildParts));
H('images-batches', (pid) => images.batches(DATA, pid));
H('images-restore', (pid, batch) => images.restore(DATA, pid, batch));
H('images-empty', (pid, batch) => { images.emptyBatch(DATA, pid, batch); return true; });
H('images-shrink', (pid, full) => shrinkImage(pid, full));

H('git-status', (pid) => gitStatus(pid));
H('git-pull', async (pid) => { const r = await git(store.project(pid).path, ['pull', '--ff-only'], 120000); if (!r.ok) throw new Error((r.err || r.out).trim().split('\n').slice(-3).join(' ')); return r.out.trim(); });
H('git-checkout', async (pid, br) => { const r = await git(store.project(pid).path, ['checkout', br]); if (!r.ok) throw new Error((r.err || r.out).trim().split('\n').slice(-2).join(' ')); return true; });

H('open-code', (target, line) => openInCode(target, line));
H('open-folder', (dir) => shell.openPath(dir));
H('open-url', (url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return true; });
H('show-file', (f) => { shell.showItemInFolder(f); return true; });
H('copy', (text) => { require('electron').clipboard.writeText(String(text)); return true; });

// ---------------------------------------------------------------- events to the window
procs.on('state', (s) => { send('proc-state', s); updateTray(); });
procs.on('logs', (b) => send('proc-logs', b));
procs.on('crash', (s) => {
  if (store.settings.notifications && Notification.isSupported()) {
    const n = new Notification({ title: `${s.label} stopped`, body: s.lastError || `Exit code ${s.code}`, silent: false });
    n.on('click', () => { showWindow(); send('focus-logs', s.key); });
    n.show();
  }
});
setInterval(() => { if (procs.anyRunning()) procs.metrics().catch(() => {}); }, 3000);

// ---------------------------------------------------------------- window, theme, tray
function theme() {
  const t = store.settings.theme;
  nativeTheme.themeSource = t === 'light' ? 'light' : t === 'dark' ? 'dark' : 'system';
  const dark = nativeTheme.shouldUseDarkColors;
  if (win && !win.isDestroyed()) { try { win.setTitleBarOverlay({ color: dark ? '#0d1220' : '#f6f7fb', symbolColor: dark ? '#9aa6bf' : '#4b5568', height: 44 }); } catch (_) {} }
  send('theme', { dark });
}
nativeTheme.on('updated', () => send('theme', { dark: nativeTheme.shouldUseDarkColors }));

async function createWindow() {
  // after an update the window must never run an old cached copy of its own page
  try { const { session } = require('electron'); await session.defaultSession.clearCache(); await session.defaultSession.clearCodeCaches({}); } catch (_) {}
  theme();
  const dark = nativeTheme.shouldUseDarkColors;
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1060, minHeight: 680, show: false, backgroundColor: dark ? '#0d1220' : '#f6f7fb',
    titleBarStyle: 'hidden', titleBarOverlay: { color: dark ? '#0d1220' : '#f6f7fb', symbolColor: dark ? '#9aa6bf' : '#4b5568', height: 44 },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('close', (e) => {
    if (quitting) return;
    if (procs.anyRunning()) {                     // servers keep running: DevPilot goes to the tray
      e.preventDefault(); win.hide();
      if (!trayHintShown && Notification.isSupported()) { trayHintShown = true; new Notification({ title: 'DevPilot is still running', body: 'Your servers keep running. DevPilot is in the tray (next to the clock).' }).show(); }
    }
  });
}
function showWindow() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }

function updateTray() {
  if (!tray) return;
  const running = procs.states().filter((s) => ['starting', 'running'].includes(s.status));
  tray.setToolTip(running.length ? `DevPilot · ${running.length} running` : 'DevPilot');
  const projs = store.projects().filter((p) => running.some((s) => s.project === p.id));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open DevPilot', click: showWindow },
    { type: 'separator' },
    ...(projs.length ? projs.map((p) => ({ label: `■ Stop ${p.name}`, click: () => procs.stopAll((it) => it.project === p.id) })) : [{ label: 'Nothing running', enabled: false }]),
    { type: 'separator' },
    { label: 'Quit (stops everything)', click: () => quitAll() },
  ]));
}
async function quitAll() {
  quitting = true;
  if (store.settings.stopOnQuit !== false) await procs.stopAll();
  store.save(true);
  app.quit();
}

app.on('second-instance', showWindow);
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  try {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png')));
    tray.on('click', showWindow);
    updateTray();
  } catch (_) { /* no tray icon: the window still works */ }
});
app.on('before-quit', (e) => { if (!quitting) { e.preventDefault(); quitAll(); } });
app.on('window-all-closed', () => { if (!procs.anyRunning()) quitAll(); });
