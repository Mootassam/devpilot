'use strict';
// Prod <-> Local switch.
// Finds the lines that set a server address (baseURL: "...", API_URL = "...", VITE_API_URL=...) and switches them:
//   "toggle"  = the way you do it by hand: comment out the prod line, un-comment your localhost line
//   "replace" = no localhost line exists: the prod address becomes http://localhost:<server port><same path>
// Every file is backed up before it is touched; "Back to Prod" puts back exactly what was there.
const fs = require('fs');
const path = require('path');
const { readText, readJson, writeAtomic, walk, exists } = require('./util');

const KEY_RX = /(url|uri|api|base|host|endpoint|server|backend|socket|domain|origin|gateway)/i;
const CODE_EXT = /\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte|json)$/i;
const SKIP_FILE = /(\.test\.|\.spec\.|\.d\.ts$|\.min\.|package(-lock)?\.json$|tsconfig|i18n|locales?[\\/]|translations?[\\/]|__tests__|\.stories\.)/i;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\])$/i;
const GUARD = '# DevPilot local-mode guard';

// one line that assigns an address: [indent][comment?]prefix "url" rest
const CODE_LINE = /^(\s*)(\/\/\s?)?(.*?\b([A-Za-z_$][\w$]*)["']?\s*[:=]\s*)(["'`])(https?:\/\/[^"'`\s]+)\5(.*)$/;
const ENV_LINE = /^(\s*)(#\s?)?((?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*)(["']?)(https?:\/\/[^"'\s]+)\5(\s*)$/;

function hostOf(u) { try { return new URL(u).hostname; } catch (_) { return ''; } }
const isLocal = (u) => LOCAL_HOST.test(hostOf(u));
function pathOf(u) { try { const x = new URL(u); return (x.pathname === '/' ? '' : x.pathname) + x.search; } catch (_) { return ''; } }

function filesOf(part) {
  const out = [];
  for (const f of fs.readdirSync(part.dir)) {
    if (/^\.env(\.|$)/.test(f) && !/(production|prod|example|sample|template)/i.test(f)) out.push(path.join(part.dir, f));
  }
  for (const sub of ['src', 'app', 'config', 'lib', 'utils']) {
    const base = path.join(part.dir, sub);
    if (!exists(base)) continue;
    walk(base, (full, rel) => { if (CODE_EXT.test(full) && !SKIP_FILE.test(rel)) out.push(full); }, { maxFiles: 6000 });
  }
  for (const f of ['config.js', 'config.ts', 'next.config.js', 'nuxt.config.ts']) { const p = path.join(part.dir, f); if (exists(p)) out.push(p); }
  return [...new Set(out)];
}

function parseLine(line, env) {
  const m = (env ? ENV_LINE : CODE_LINE).exec(line);
  if (!m) return null;
  const key = m[4];
  if (!env && !KEY_RX.test(key)) return null;
  if (env && !KEY_RX.test(key)) return null;
  return { indent: m[1], commented: !!m[2], key, url: m[6], local: isLocal(m[6]) };
}

// every place an address can be switched, for one part
function findInPart(part, serverPort) {
  const groups = [];
  for (const file of filesOf(part)) {
    const text = readText(file, 600 * 1024);
    if (!text || !/https?:\/\//.test(text)) continue;
    const env = /[\\/]\.env/.test(file);
    const lines = text.split(/\r?\n/);
    const byKey = new Map();
    lines.forEach((ln, i) => {
      const p = parseLine(ln, env);
      if (!p) return;
      if (!byKey.has(p.key)) byKey.set(p.key, []);
      byKey.get(p.key).push({ ...p, line: i });
    });
    for (const [key, items] of byKey) {
      const active = items.filter((x) => !x.commented);
      if (active.length !== 1) continue;                    // none, or several active lines: unclear, skipped
      const a = active[0];
      if (a.local) { groups.push({ file, key, env, state: 'local', prod: null, local: a.url, line: a.line }); continue; }
      const near = items.filter((x) => x.commented && x.local).sort((x, y) => Math.abs(x.line - a.line) - Math.abs(y.line - a.line));
      if (near.length) groups.push({ file, key, env, mode: 'toggle', state: 'prod', prod: a.url, local: near[0].url, line: a.line, localLine: near[0].line });
      else if (serverPort) groups.push({ file, key, env, mode: 'replace', state: 'prod', prod: a.url, local: `http://localhost:${serverPort}${pathOf(a.url)}`, line: a.line });
      else groups.push({ file, key, env, mode: 'replace', state: 'prod', prod: a.url, local: null, line: a.line, needsPort: true });
    }
  }
  return groups;
}

function find(scan) {
  const server = scan.parts.find((p) => p.role === 'backend' && p.port);
  const serverPort = server ? server.port : null;
  const out = [];
  for (const part of scan.parts) {
    if (part.kind === 'docker' || part.role === 'backend') continue;     // the server's own .env holds its own addresses
    for (const g of findInPart(part, serverPort)) out.push({ ...g, part: part.rel || '(root)', rel: path.relative(scan.path, g.file).replace(/\\/g, '/'), id: path.relative(scan.path, g.file).replace(/\\/g, '/') + '#' + g.key });
  }
  // which addresses are YOUR server: hosts you already keep a localhost twin for, IP addresses, .env API settings, strong API keys
  const own = new Set();
  for (const g of out) {
    const h = hostOf(g.prod || '');
    if (!h) continue;
    if (g.mode === 'toggle' || g.env || isIp(h) || STRONG_KEY.test(g.key)) own.add(h);
  }
  for (const g of out) {
    if (g.state !== 'prod') { g.recommended = false; g.external = false; continue; }
    const h = hostOf(g.prod);
    g.recommended = g.mode === 'toggle' || ((STRONG_KEY.test(g.key) || g.env) && (own.has(h)) && !!g.local);
    g.external = !g.recommended && !own.has(h);
  }
  return { serverPort, serverName: server ? (server.rel || server.name) : null, items: out };
}
const STRONG_KEY = /^(base_?url|backend_?url|api_?url|api_?base(_?url)?|base_?api(_?url)?|server_?url|socket_?url|ws_?url|api_?endpoint|backend|api|(VITE|REACT_APP|NEXT_PUBLIC|NUXT_PUBLIC|EXPO_PUBLIC|VUE_APP)_\w*(API|BACKEND|SERVER|SOCKET|BASE)\w*)$/i;
const isIp = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h);

// ---- switching
const comment = (line, env) => line.replace(/^(\s*)/, `$1${env ? '# ' : '// '}`);
const uncomment = (line, env) => line.replace(env ? /^(\s*)#\s?/ : /^(\s*)\/\/\s?/, '$1');

function stateFile(dir, projectId) { return path.join(dir, 'switch', projectId + '.json'); }
function status(dir, projectId) { const s = readJson(stateFile(dir, projectId)); return s && s.mode === 'local' ? s : null; }

function toLocal(dir, project, scanResult, selectedIds, extra = []) {
  if (status(dir, project.id)) throw new Error('This project is already in LOCAL mode.');
  const chosen = scanResult.items.filter((g) => g.state === 'prod' && g.local && selectedIds.includes(g.id));
  const plan = new Map();     // file -> [{ line, before, after }]
  for (const g of chosen) {
    const text = readText(g.file, 600 * 1024); if (text == null) continue;
    const lines = text.split(/\r?\n/);
    const ch = plan.get(g.file) || [];
    if (g.mode === 'toggle') {
      ch.push({ line: g.line, before: lines[g.line], after: comment(lines[g.line], g.env) });
      ch.push({ line: g.localLine, before: lines[g.localLine], after: uncomment(lines[g.localLine], g.env) });
    } else {
      ch.push({ line: g.line, before: lines[g.line], after: lines[g.line].replace(g.prod, g.local) });
    }
    plan.set(g.file, ch);
  }
  // extra replacements typed by hand: prod address -> local address, in the same files the scan reads
  for (const x of extra.filter((e) => e && e.prod && e.local && e.prod !== e.local)) {
    for (const part of scanResult.parts || []) {
      for (const file of filesOf(part)) {
        const text = readText(file, 600 * 1024); if (!text || !text.includes(x.prod)) continue;
        const lines = text.split(/\r?\n/); const ch = plan.get(file) || [];
        lines.forEach((l, i) => { if (l.includes(x.prod) && !ch.some((c) => c.line === i)) ch.push({ line: i, before: l, after: l.split(x.prod).join(x.local) }); });
        plan.set(file, ch);
      }
    }
  }
  if (!plan.size) throw new Error('Nothing to switch: choose at least one address.');
  const files = {};
  for (const [file, changes] of plan) {
    const orig = fs.readFileSync(file, 'utf8');
    const eol = orig.includes('\r\n') ? '\r\n' : '\n';
    const lines = orig.split(/\r?\n/);
    for (const c of changes) if (lines[c.line] === c.before) lines[c.line] = c.after;
    const next = lines.join(eol);
    files[file] = { orig, switched: next, changes };
  }
  // the backup is written BEFORE any project file changes
  writeAtomic(stateFile(dir, project.id), JSON.stringify({ mode: 'local', at: Date.now(), project: project.path, files }, null, 1));
  for (const [file, f] of Object.entries(files)) writeAtomic(file, f.switched);
  const hook = guardOn(project.path);
  return { files: Object.keys(files).length, changes: Object.values(files).reduce((n, f) => n + f.changes.length, 0), hook };
}

function toProd(dir, project) {
  const st = status(dir, project.id);
  if (!st) return { restored: 0, conflicts: [] };
  const conflicts = []; let restored = 0;
  for (const [file, f] of Object.entries(st.files)) {
    let cur; try { cur = fs.readFileSync(file, 'utf8'); } catch (_) { conflicts.push({ file, reason: 'file not found' }); continue; }
    if (cur === f.switched) { writeAtomic(file, f.orig); restored++; continue; }
    if (cur === f.orig) { restored++; continue; }
    // you edited the file while in LOCAL mode: undo only our own lines, keep your edits
    const eol = cur.includes('\r\n') ? '\r\n' : '\n';
    const lines = cur.split(/\r?\n/);
    let miss = 0;
    for (const c of f.changes) {
      let i = lines[c.line] === c.after ? c.line : lines.indexOf(c.after);
      if (i < 0) { miss++; continue; }
      lines[i] = c.before;
    }
    if (miss) conflicts.push({ file, reason: `${miss} line(s) were changed by hand; the rest was restored` });
    writeAtomic(file, lines.join(eol)); restored++;
  }
  try { fs.renameSync(stateFile(dir, project.id), stateFile(dir, project.id) + '.' + Date.now() + '.done'); } catch (_) {}
  guardOff(project.path);
  return { restored, conflicts };
}

// ---- git guard: while LOCAL mode is on, a commit is stopped with a message (only if you have no pre-commit hook of your own)
function gitDir(p) { let d = path.resolve(p); for (let i = 0; i < 4; i++) { if (exists(path.join(d, '.git', 'HEAD'))) return path.join(d, '.git'); const up = path.dirname(d); if (up === d) break; d = up; } return null; }
function guardOn(projectPath) {
  const g = gitDir(projectPath); if (!g) return 'no git';
  const hook = path.join(g, 'hooks', 'pre-commit');
  if (exists(hook) && !String(readText(hook) || '').includes(GUARD)) return 'your own pre-commit hook exists: not changed';
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(hook, `#!/bin/sh\n${GUARD}\necho "" >&2\necho "  DevPilot: this project is in LOCAL mode (local addresses)." >&2\necho "  Click 'Back to Prod' in DevPilot before you commit." >&2\necho "" >&2\nexit 1\n`);
  return 'on';
}
function guardOff(projectPath) {
  const g = gitDir(projectPath); if (!g) return;
  const hook = path.join(g, 'hooks', 'pre-commit');
  if (exists(hook) && String(readText(hook) || '').includes(GUARD)) { try { fs.unlinkSync(hook); } catch (_) {} }
}

module.exports = { find, toLocal, toProd, status, isLocal, pathOf };
