'use strict';
/* DevPilot window. Everything that touches files or programs goes through window.dp (preload.js), used here as `dp`. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ------------------------------------------------------------------ tiny DOM helpers
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const P = {
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', build: '<path d="m15 12-8.4 8.4a2.1 2.1 0 0 1-3-3L12 9"/><path d="M17.6 15 22 10.6M20.9 11.7l-1.3-1.3a2.4 2.4 0 0 1-.7-1.7V7.2l-2.5-2.5A6 6 0 0 0 12.1 3H9l.9.8A6.2 6.2 0 0 1 12 8.4v1.4l2 2h2.4a2.4 2.4 0 0 1 1.7.7l1.3 1.3"/>',
  install: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>', logs: '<path d="m4 17 6-6-6-6M12 19h8"/>', more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>', folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>', star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>', git: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>', swap: '<path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  port: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/>', copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  chev: '<path d="m9 18 6-6-6-6"/>', down: '<path d="m6 9 6 6 6-6"/>', zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>', layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>', broom: '<path d="m13 11 8-8M7 14l3 3M4.5 19.5 3 21M11 12.5a4 4 0 0 0-5.6 0L3 15l6 6 2.5-2.4a4 4 0 0 0 0-5.6z"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>', down2: '<path d="M12 3v12M7 10l5 5 5-5"/>', box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>', rocket: '<path d="M5 17 12 4l7 13-7-3.5z"/>',
};
const I = (n, cls = '') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'i ' + cls); s.innerHTML = P[n] || ''; return s; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtMB = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m`; };
const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:');
function hue(str) { let x = 0; for (const c of String(str)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 360; }
const avatar = (name, cls = '') => h('div', { class: 'avatar ' + cls, style: { background: `linear-gradient(135deg, hsl(${hue(name)} 70% 56%), hsl(${(hue(name) + 40) % 360} 72% 46%))` } }, (name || '?').trim()[0] || '?');
const FW = { 'Vite': ['VT', '#646cff'], 'React (CRA)': ['RE', '#0ea5c6'], 'Next.js': ['NX', '#111827'], 'Express': ['EX', '#3c873a'], 'NestJS': ['NE', '#e0234e'], 'Fastify': ['FA', '#111827'],
  'Koa': ['KO', '#33333d'], 'Angular': ['NG', '#dd0031'], 'Vue CLI': ['VU', '#41b883'], 'Nuxt': ['NU', '#00c58e'], 'Electron': ['EL', '#47848f'], 'Gatsby': ['GA', '#663399'], 'Astro': ['AS', '#ff5d01'],
  'Expo': ['EX', '#000'], 'SvelteKit': ['SV', '#ff3e00'], 'Python': ['PY', '#3776ab'], 'Django': ['DJ', '#0c4b33'], 'Flask': ['FL', '#3776ab'], 'FastAPI': ['FA', '#059669'], 'Docker Compose': ['DK', '#2496ed'], 'Apollo': ['AP', '#311c87'] };
const fwBadge = (f) => { const [t, c] = FW[f] || ['JS', '#7c6cff']; return h('div', { class: 'fw', style: { background: c } }, t); };

// ------------------------------------------------------------------ app state
const S = {
  settings: {}, projects: [], cur: null, page: 'welcome', tab: 'overview', scan: null, scanErr: '',
  procs: new Map(), logs: new Map(), logKey: null, logQ: '', logErrOnly: false, autoScroll: true,
  urls: null, urlSel: null, urlOv: {}, urlExtra: [], images: null, imgTab: 'unused', imgSel: new Set(), imgBatches: [], imgBuild: false, imgBuildParts: new Set(),
  git: null, ports: null, portQ: '', q: '',
};
const proj = () => S.projects.find((p) => p.id === S.cur) || null;
const pkey = (rel) => `${S.cur}|${rel || ''}`;
const isUp = (s) => !!s && (s.status === 'running' || s.status === 'starting');
const serverOf = (rel) => S.procs.get(pkey(rel));
const tasksOf = (rel) => [...S.procs.values()].filter((s) => s.key.startsWith(pkey(rel) + '|') && s.status === 'running');
const projProcs = (pid) => [...S.procs.values()].filter((s) => s.project === pid);

// ------------------------------------------------------------------ toasts, menus, modals
function toast(text, kind = 'info', ms = 3800) {
  const t = h('div', { class: 'toast ' + kind }, I(kind === 'ok' ? 'check' : kind === 'bad' ? 'alert' : kind === 'warn' ? 'alert' : 'zap', 'sm'), h('div', {}, text));
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 220); }, ms);
}
const fail = (e) => toast(String(e && e.message || e), 'bad', 6000);
let menuEl = null;
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
function menu(anchor, items) {
  closeMenu();
  const m = h('div', { class: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it.sep) { m.append(h('hr')); continue; }
    if (it.header) { m.append(h('div', { class: 'ml' }, it.header)); continue; }
    m.append(h('button', { class: 'mi' + (it.danger ? ' bad' : ''), disabled: it.disabled, onclick: () => { closeMenu(); it.onClick && it.onClick(); } }, it.icon ? I(it.icon, 'sm') : null, it.label, it.kbd ? h('span', { class: 'k' }, it.kbd) : null));
  }
  document.body.append(m); menuEl = m;
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, bottom: anchor.y, right: anchor.x, top: anchor.y };
  const mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.right - mw)) + 'px';
  m.style.top = (r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target)) { closeMenu(); document.removeEventListener('mousedown', off); } }), 0);
}
function modal({ icon = 'zap', kind = '', title, body, buttons = [{ label: 'OK', kind: 'primary', value: true }], wide = false, onOpen }) {
  return new Promise((resolve) => {
    const close = (v) => { o.remove(); document.removeEventListener('keydown', key); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') close(null); };
    const o = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === o) close(null); } },
      h('div', { class: 'modal' + (wide ? ' wide' : '') },
        h('div', { class: 'mh' }, h('div', { class: 'ic ' + kind }, I(icon)), h('div', { style: { flex: 1, minWidth: 0 } }, h('h2', {}, title))),
        h('div', { class: 'mb' }, typeof body === 'string' ? h('div', { html: body }) : body),
        h('div', { class: 'mf' }, ...buttons.map((b) => b === 'sp' ? h('div', { class: 'sp' }) : h('button', { class: 'btn ' + (b.kind || ''), onclick: async () => { if (b.onClick) { const r = await b.onClick(); if (r === false) return; } close(b.value); } }, b.icon ? I(b.icon, 'sm') : null, b.label)))));
    document.getElementById('modals').append(o);
    document.addEventListener('keydown', key);
    if (onOpen) onOpen(o);
    const f = o.querySelector('input, .btn.primary, .btn.go'); if (f) setTimeout(() => f.focus(), 30);
  });
}
const confirmBox = (title, text, okLabel = 'OK', kind = 'primary', icon = 'alert') => modal({ icon, kind: kind === 'solid-bad' ? 'bad' : '', title, body: text, buttons: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: okLabel, kind, value: true }] });
async function promptBox(title, label, value = '', ph = '') {
  const inp = h('input', { class: 'input', value, placeholder: ph, style: { width: '100%' } });
  const r = await modal({ icon: 'edit', title, body: h('label', { class: 'field' }, label, inp), buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Save', kind: 'primary', value: 'ok' }],
    onOpen: (o) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') o.querySelector('.btn.primary').click(); }) });
  return r === 'ok' ? inp.value.trim() : null;
}
async function busyBtn(btn, fn) {
  const old = [...btn.childNodes]; btn.disabled = true; btn.replaceChildren(h('span', { class: 'spin' }), old.filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() || '');
  try { return await fn(); } catch (e) { fail(e); } finally { if (btn.isConnected) { btn.disabled = false; btn.replaceChildren(...old); } }
}

// ------------------------------------------------------------------ theme
function applyTheme(dark) {
  const t = S.settings.theme;
  const isDark = t === 'dark' ? true : t === 'light' ? false : dark;
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

// ------------------------------------------------------------------ sidebar
function renderSide() {
  const list = $('#projList'); list.replaceChildren();
  const q = S.q.toLowerCase();
  const items = S.projects.filter((p) => !q || p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q));
  const favs = items.filter((p) => p.favorite), rest = items.filter((p) => !p.favorite).sort((a, b) => a.name.localeCompare(b.name));
  const row = (p) => {
    const pr = projProcs(p.id), up = pr.filter((s) => s.kind === 'server' && isUp(s)).length, bad = pr.some((s) => s.status === 'crashed');
    return h('div', { class: 'proj' + (S.page === 'project' && p.id === S.cur ? ' on' : ''), title: p.path, onclick: () => openProject(p.id) },
      avatar(p.name),
      h('div', { class: 'txt' }, h('div', { class: 'nm' }, p.name),
        h('div', { class: 'sub' }, !p.exists ? h('span', { style: { color: 'var(--bad)' } }, 'Folder missing')
          : bad ? [h('span', { class: 'dot bad' }), 'Crashed'] : up ? [h('span', { class: 'dot run' }), `${up} running`] : p.path.replace(/^[A-Z]:\\/i, '').slice(0, 34),
          p.local ? h('span', { class: 'chip ok', style: { height: '18px', padding: '0 6px', fontSize: '10.5px' } }, 'LOCAL') : null)),
      h('button', { class: 'star' + (p.favorite ? ' on' : ''), title: p.favorite ? 'Remove from favorites' : 'Add to favorites', onclick: async (e) => { e.stopPropagation(); await dp.projectUpdate(p.id, { favorite: !p.favorite }); await refreshProjects(); } }, I('star', 'sm')));
  };
  if (!S.projects.length) list.append(h('div', { class: 'empty', style: { padding: '30px 10px' } }, h('div', {}, 'No projects yet.'), h('small', {}, 'Add one, or let DevPilot find them.')));
  if (favs.length) { list.append(h('div', { class: 'group-label' }, 'Favorites')); favs.forEach((p) => list.append(row(p))); }
  if (rest.length) { list.append(h('div', { class: 'group-label' }, favs.length ? 'Projects' : `Projects · ${rest.length}`)); rest.forEach((p) => list.append(row(p))); }
  if (S.projects.length && !items.length) list.append(h('div', { class: 'empty', style: { padding: '24px 10px' } }, 'No project matches.'));
  $$('.nav-item').forEach((b) => b.classList.toggle('on', b.dataset.page === S.page));
}
async function refreshProjects() { const st = await dp.state(); S.projects = st.projects; renderSide(); if (S.page === 'project') renderHeaderOnly(); }

// ------------------------------------------------------------------ navigation
function crumb(...parts) { $('#crumb').replaceChildren(...parts.flatMap((p, i) => (i ? [I('chev', 'sm'), p] : [p]))); }
async function openProject(pid, tab) {
  const same = S.cur === pid && S.page === 'project';
  S.cur = pid; S.page = 'project'; S.tab = tab || (same ? S.tab : 'overview');
  S.scan = null; S.scanErr = ''; S.urls = null; S.urlSel = null; S.images = null; S.imgSel = new Set(); S.git = null; S.logKey = null;
  dp.projectOpen(pid).catch(() => {});
  renderSide(); renderView();
  try { S.scan = await dp.scan(pid); } catch (e) { S.scanErr = e.message; }
  if (S.cur === pid) renderView();
}
function setPage(page) { S.page = page; renderSide(); renderView(); }

function renderView() {
  closeMenu();
  const v = $('#view'); v.replaceChildren();
  if (S.page === 'ports') return renderPorts(v);
  if (S.page === 'settings') return renderSettings(v);
  if (S.page === 'project' && proj()) return renderProject(v);
  return renderWelcome(v);
}

// ------------------------------------------------------------------ welcome
function renderWelcome(v) {
  crumb(h('b', {}, 'Welcome'));
  v.append(h('div', { class: 'welcome' },
    h('div', { class: 'glow', html: '<svg viewBox="0 0 24 24"><path d="M5 17 L12 4 L19 17 L12 13.5 Z" fill="currentColor"/><circle cx="12" cy="19.5" r="1.6" fill="currentColor"/></svg>' }),
    h('h1', {}, 'Run your projects with one click'),
    h('p', {}, 'No more CMD. DevPilot reads your project, finds the commands, and gives you buttons: start, stop, build, install, switch to local, clean unused images.'),
    h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center' } },
      h('button', { class: 'btn primary lg', onclick: addProject }, I('plus'), 'Add a project'),
      h('button', { class: 'btn lg', onclick: findProjectsModal }, I('search'), 'Find my projects')),
    h('div', { class: 'feat' },
      ...[['play', 'One-click start', 'Backend first, then admin and platform. Logs, ports and crashes handled for you.'],
        ['swap', 'Prod ↔ Local', 'Switch your API addresses to localhost and back with one button. Every file is backed up.'],
        ['broom', 'Clean images', 'Find images your code never uses and move them to a Trash you can restore.']].map(([i, b, s]) =>
        h('div', { class: 'card' }, h('div', { class: 'fi' }, I(i)), h('b', {}, b), h('span', {}, s))))));
}
async function addProject() {
  try {
    const dir = await dp.pickFolder(); if (!dir) return;
    const p = await dp.projectAdd(dir);
    await refreshProjects(); openProject(p.id);
    toast(`${p.name} added`, 'ok');
  } catch (e) { fail(e); }
}
async function findProjectsModal() {
  let base = 'D:\\', list = [], sel = new Set();
  const box = h('div', {});
  const draw = () => {
    box.replaceChildren(
      h('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px' } },
        h('input', { class: 'input mono', value: base, style: { flex: 1 }, onchange: (e) => { base = e.target.value; load(); } }),
        h('button', { class: 'btn', onclick: async () => { const d = await dp.pickFolder(); if (d) { base = d; load(); } } }, I('folder', 'sm'), 'Browse')),
      list === null ? h('div', { class: 'empty' }, h('span', { class: 'spin' }), 'Looking for projects…')
        : !list.length ? h('div', { class: 'empty' }, 'No projects found in this folder.')
          : h('div', { class: 'card rows', style: { maxHeight: '46vh', overflowY: 'auto' } }, ...list.map((x) => h('label', { class: 'row', style: { cursor: x.added ? 'default' : 'pointer', opacity: x.added ? .55 : 1 } },
            h('input', { type: 'checkbox', checked: sel.has(x.path), disabled: x.added, style: { width: '16px', height: '16px', accentColor: 'var(--accent)' }, onchange: (e) => { e.target.checked ? sel.add(x.path) : sel.delete(x.path); upd(); } }),
            avatar(x.name),
            h('div', { class: 'grow' }, h('b', {}, x.name), h('div', { class: 'mono faint', style: { fontSize: '12px' } }, x.path)),
            x.git ? h('span', { class: 'chip' }, I('git', 'sm'), 'git') : null,
            x.added ? h('span', { class: 'chip ok' }, 'added') : h('span', { class: 'chip' }, `${x.parts} part${x.parts > 1 ? 's' : ''}`)))));
  };
  const upd = () => { const b = document.querySelector('#addSel'); if (b) { b.disabled = !sel.size; b.textContent = sel.size ? `Add ${sel.size} project${sel.size > 1 ? 's' : ''}` : 'Add projects'; } };
  const load = async () => { list = null; draw(); try { list = await dp.projectFind(base); } catch (e) { list = []; fail(e); } sel = new Set(); draw(); upd(); };
  load();
  const r = await modal({ icon: 'search', title: 'Find my projects', wide: true, body: box,
    buttons: [{ label: 'Select all', kind: 'ghost', onClick: () => { (list || []).filter((x) => !x.added).forEach((x) => sel.add(x.path)); draw(); upd(); return false; } }, 'sp',
      { label: 'Cancel', kind: 'ghost', value: null }, { label: 'Add projects', kind: 'primary', value: 'add' }],
    onOpen: (o) => { const b = o.querySelector('.btn.primary'); b.id = 'addSel'; b.disabled = true; } });
  if (r !== 'add' || !sel.size) return;
  try { const added = await dp.projectAddMany([...sel]); await refreshProjects(); toast(`${added.length} project${added.length > 1 ? 's' : ''} added`, 'ok'); if (added[0]) openProject(added[0].id); } catch (e) { fail(e); }
}

// ------------------------------------------------------------------ project page
const TABS = [['overview', 'layers', 'Overview'], ['logs', 'logs', 'Logs'], ['urls', 'swap', 'Prod ↔ Local'], ['images', 'image', 'Images'], ['git', 'git', 'Git'], ['buttons', 'zap', 'Buttons & profiles']];
function renderProject(v) {
  const p = proj();
  crumb(h('span', {}, 'Projects'), h('b', {}, p.name));
  v.append(h('div', { id: 'phead' }), h('div', { class: 'tabs', id: 'tabs' }), h('div', { id: 'tabBody' }));
  renderHeaderOnly(); renderTabs(); renderTab();
}
function renderHeaderOnly() {
  const p = proj(), el = $('#phead'); if (!p || !el) return;
  const pr = projProcs(p.id), anyUp = pr.some((s) => s.kind === 'server' && isUp(s));
  const profiles = p.profiles || [];
  el.className = 'phead';
  el.replaceChildren(
    avatar(p.name),
    h('div', { class: 'title' },
      h('h1', {}, p.name, h('span', { class: 'mode ' + (p.local ? 'local' : 'prod'), title: p.local ? 'Your API addresses point to localhost' : 'Production addresses' }, p.local ? [h('span', { class: 'dot run' }), 'LOCAL'] : 'PROD')),
      h('div', { class: 'path', title: 'Copy the path', onclick: () => dp.copy(p.path).then(() => toast('Path copied', 'ok', 1800)) }, I('folder', 'sm'), p.path)),
    h('div', { class: 'acts' },
      h('div', { class: 'btn-group' },
        h('button', { class: 'btn go', onclick: (e) => startAll(e.currentTarget) }, I('play', 'sm'), 'Start all'),
        h('button', { class: 'btn go', title: 'Start a profile', onclick: (e) => menu(e.currentTarget, [{ header: 'Start' }, { label: 'Everything', icon: 'play', onClick: () => startAll(null) },
          ...profiles.map((pf) => ({ label: pf.name, icon: 'play', onClick: () => startAll(null, pf.id) })), { sep: true }, { label: 'Manage profiles…', icon: 'edit', onClick: () => { S.tab = 'buttons'; renderTabs(); renderTab(); } }]) }, I('down', 'sm'))),
      h('button', { class: 'btn danger', disabled: !anyUp && !pr.some((s) => isUp(s)), onclick: (e) => busyBtn(e.currentTarget, async () => { await dp.stopAll(p.id); toast('Everything stopped', 'ok'); }) }, I('stop', 'sm'), 'Stop all'),
      h('button', { class: 'btn', disabled: !anyUp, onclick: (e) => busyBtn(e.currentTarget, async () => { const r = await dp.restartAll(p.id); afterStart(r); }) }, I('restart', 'sm'), 'Restart'),
      h('button', { class: 'btn', onclick: (e) => busyBtn(e.currentTarget, async () => { const r = await dp.installAll(p.id); toast(`Installing ${r.count} part${r.count > 1 ? 's' : ''}… follow it in Logs`, 'info'); }) }, I('install', 'sm'), 'Install all'),
      h('button', { class: 'btn icon', title: 'Open in VS Code', onclick: () => dp.openCode(p.path).catch(fail) }, I('code')),
      h('button', { class: 'btn icon', title: 'Open the folder', onclick: () => dp.openFolder(p.path) }, I('folder')),
      h('button', { class: 'btn icon', title: 'More', onclick: (e) => menu(e.currentTarget, [
        { label: 'Scan the project again', icon: 'refresh', onClick: async () => { S.scan = await dp.scan(p.id); renderTab(); toast('Scanned again', 'ok', 1600); } },
        { label: 'Rename…', icon: 'edit', onClick: async () => { const n = await promptBox('Rename project', 'Name', p.name); if (n) { await dp.projectUpdate(p.id, { name: n }); await refreshProjects(); renderView(); } } },
        { label: p.favorite ? 'Remove from favorites' : 'Add to favorites', icon: 'star', onClick: async () => { await dp.projectUpdate(p.id, { favorite: !p.favorite }); await refreshProjects(); } },
        { sep: true },
        { label: 'Remove from DevPilot…', icon: 'trash', danger: true, onClick: async () => { if (await confirmBox(`Remove ${p.name}?`, 'It is only removed from DevPilot: <b>your files are not touched</b>. Its running servers are stopped.', 'Remove', 'solid-bad')) { await dp.projectRemove(p.id); S.cur = null; await refreshProjects(); setPage('welcome'); } } }]) }, I('more'))));
}
function renderTabs() {
  const el = $('#tabs'); if (!el) return;
  const pr = projProcs(S.cur);
  const up = pr.filter((s) => isUp(s)).length, errs = pr.filter((s) => s.status === 'crashed' || s.status === 'failed').length;
  el.replaceChildren(...TABS.map(([id, ic, label]) => h('button', { class: 'tab' + (S.tab === id ? ' on' : ''), onclick: () => { S.tab = id; renderTabs(); renderTab(); } }, I(ic, 'sm'), label,
    id === 'logs' && errs ? h('span', { class: 'badge bad' }, errs) : id === 'logs' && up ? h('span', { class: 'badge ok' }, up) : null,
    id === 'urls' && proj() && proj().local ? h('span', { class: 'badge ok' }, 'ON') : null)));
}
function renderTab() {
  const b = $('#tabBody'); if (!b) return;
  b.replaceChildren();
  if (S.scanErr) { b.append(h('div', { class: 'card hero' }, h('div', { class: 'hic', style: { background: 'var(--bad-soft)', color: 'var(--bad)' } }, I('alert', 'lg')), h('div', { class: 'grow' }, h('h2', {}, 'This project could not be read'), h('p', {}, S.scanErr)))); return; }
  if (!S.scan) { b.append(h('div', { class: 'empty' }, h('span', { class: 'spin' }), 'Reading the project…')); return; }
  ({ overview: tabOverview, logs: tabLogs, urls: tabUrls, images: tabImages, git: tabGit, buttons: tabButtons })[S.tab](b);
}

// ------------------------------------------------------------------ overview
function tabOverview(b) {
  const p = proj();
  const btns = p.buttons || [];
  if (btns.length) b.append(h('div', { class: 'quick' }, ...btns.map((x) => h('button', { class: 'btn sm', onclick: (e) => busyBtn(e.currentTarget, async () => { await dp.custom(p.id, x.id); toast(`${x.label} started: see Logs`, 'info'); }) }, I('zap', 'sm'), x.label))));
  if (!S.scan.parts.length) {
    b.append(h('div', { class: 'card empty', style: { padding: '50px' } }, h('div', { class: 'big' }, I('box', 'lg')), h('b', {}, 'Nothing to run was found here'),
      h('span', {}, 'DevPilot looks for package.json, Python and Docker files in this folder and the folders inside it.'),
      h('button', { class: 'btn', onclick: () => { S.tab = 'buttons'; renderTabs(); renderTab(); } }, I('plus', 'sm'), 'Add your own button')));
    return;
  }
  const grid = h('div', { class: 'parts', id: 'partsGrid' });
  b.append(grid);
  drawCards();
}
function drawCards() {
  const grid = $('#partsGrid'); if (!grid || !S.scan) return;
  grid.replaceChildren(...S.scan.parts.map(partCard));
}
function partCard(part) {
  const p = proj(), sv = serverOf(part.rel), tasks = tasksOf(part.rel);
  const up = isUp(sv), crashed = sv && sv.status === 'crashed';
  const task = tasks[0];
  const st = task ? ['task', task.action === 'install' ? 'Installing…' : task.action === 'build' ? 'Building…' : 'Working…']
    : !sv ? ['', 'Stopped'] : sv.status === 'running' ? ['run', 'Running'] : sv.status === 'starting' ? ['start', 'Starting…'] : crashed ? ['bad', 'Crashed'] : ['', 'Stopped'];
  const url = sv && sv.url;
  const card = h('div', { class: 'card pcard' + (up && sv.status === 'running' ? ' running' : '') + (crashed ? ' crashed' : '') });
  if (task || (sv && sv.status === 'starting')) card.append(h('div', { class: 'progress' }, h('i')));
  card.append(h('div', { class: 'top' }, fwBadge(part.framework),
    h('div', { class: 'grow' },
      h('div', { class: 'nm' }, part.rel ? part.name : `${part.name} (root)`, part.role === 'backend' ? h('span', { class: 'chip accent' }, 'server') : null),
      h('div', { class: 'meta' }, h('span', { class: 'chip' }, part.framework), part.kind === 'node' ? h('span', { class: 'chip', title: part.pmAll.length > 1 ? `Lock files found: ${part.pmAll.join(', ')}` : '' }, part.pm) : null,
        part.port ? h('span', { class: 'chip', title: part.portFrom ? `Port from ${part.portFrom}` : '' }, ':' + part.port) : null)),
    h('span', { class: 'status ' + st[0] }, h('span', { class: 'dot ' + (st[0] === 'run' ? 'run' : st[0] === 'start' ? 'start' : st[0] === 'bad' ? 'bad' : st[0] === 'task' ? 'task' : '') }), st[1])));
  const mid = h('div', { class: 'mid' });
  if (part.orchestrator) mid.append(h('div', { class: 'note info' }, I('layers', 'sm'), h('span', { class: 'grow' }, 'This script starts the other parts by itself. It is not part of “Start all”.')));
  if (!part.installed && part.kind === 'node') mid.append(h('div', { class: 'note warn' }, I('alert', 'sm'), h('span', { class: 'grow' }, 'Not installed yet'),
    h('button', { class: 'btn sm', onclick: (e) => busyBtn(e.currentTarget, () => act(part, 'install')) }, I('install', 'sm'), 'Install')));
  mid.append(h('div', { class: 'urlrow' },
    url && up ? h('span', { class: 'url', title: 'Open in the browser', onclick: () => dp.openUrl(url) }, I('globe', 'sm'), url.replace(/\/$/, ''), I('ext', 'sm'))
      : h('span', { class: 'url off' }, I('globe', 'sm'), part.port ? `localhost:${part.port}` : (part.kind === 'docker' ? 'docker compose' : 'no web address')),
    h('span', { style: { flex: 1 } }),
    up ? h('span', { class: 'stats' }, h('span', {}, I('cpu', 'sm'), ' ', h('b', {}, (sv.cpu || 0) + '%')), h('span', {}, h('b', {}, (sv.mem || 0) + ' MB')), h('span', {}, I('clock', 'sm'), ' ', h('b', {}, ago(sv.startedAt)))) : null));
  if (crashed || (sv && sv.portBusy && up)) mid.append(h('div', { class: 'note bad' }, I('alert', 'sm'), h('span', { class: 'grow' }, h('span', { class: 't', title: sv.lastError }, sv.lastError || `Stopped with exit code ${sv.code}`)),
    h('button', { class: 'btn sm', onclick: () => showLogs(sv.key) }, 'View logs')));
  if (!part.commands.dev && part.kind === 'node') mid.append(h('div', { class: 'note info' }, I('alert', 'sm'), h('span', { class: 'grow' }, 'No start script in package.json. Use the ⋯ menu to run another script.')));
  card.append(mid);
  const bar = h('div', { class: 'bar' });
  if (part.kind === 'docker') {
    bar.append(up ? h('button', { class: 'btn sm danger', onclick: (e) => busyBtn(e.currentTarget, () => dp.stop(pkey(part.rel))) }, I('stop', 'sm'), 'Stop')
      : h('button', { class: 'btn sm go', onclick: (e) => busyBtn(e.currentTarget, () => act(part, 'up')) }, I('play', 'sm'), 'Up'),
    h('button', { class: 'btn sm', onclick: (e) => busyBtn(e.currentTarget, () => act(part, 'down')) }, I('stop', 'sm'), 'Down'),
    h('button', { class: 'btn sm', onclick: (e) => busyBtn(e.currentTarget, () => act(part, 'build')) }, I('build', 'sm'), 'Build'));
  } else {
    if (up) bar.append(h('button', { class: 'btn sm danger', onclick: (e) => busyBtn(e.currentTarget, () => dp.stop(pkey(part.rel))) }, I('stop', 'sm'), 'Stop'),
      h('button', { class: 'btn sm', onclick: (e) => busyBtn(e.currentTarget, async () => { const r = await dp.restart(p.id, part.rel); if (r && r.busy) portBusy(part, r); }) }, I('restart', 'sm'), 'Restart'));
    else if (part.commands.dev) bar.append(part.commands.prod
      ? h('div', { class: 'btn-group' }, h('button', { class: 'btn sm go', title: part.commands.dev, onclick: (e) => busyBtn(e.currentTarget, () => act(part, 'dev')) }, I('play', 'sm'), 'Start'),
        h('button', { class: 'btn sm go', title: 'Other ways to start', onclick: (e) => menu(e.currentTarget, [{ header: 'Start' }, { label: `Dev · ${part.commands.dev}`, icon: 'play', onClick: () => act(part, 'dev') }, { label: `Production · ${part.commands.prod}`, icon: 'rocket', onClick: () => act(part, 'prod') }]) }, I('down', 'sm')))
      : h('button', { class: 'btn sm go', title: part.commands.dev, onclick: (e) => busyBtn(e.currentTarget, () => act(part, 'dev')) }, I('play', 'sm'), 'Start'));
    if (part.commands.build) bar.append(h('button', { class: 'btn sm', title: part.commands.build, onclick: (e) => busyBtn(e.currentTarget, () => act(part, 'build')) }, I('build', 'sm'), 'Build'));
    if (part.commands.install) bar.append(h('button', { class: 'btn sm', title: part.commands.install, onclick: (e) => busyBtn(e.currentTarget, () => act(part, 'install')) }, I('install', 'sm'), 'Install'));
  }
  bar.append(h('span', { class: 'sp' }),
    h('button', { class: 'btn sm icon', title: 'Logs', onclick: () => showLogs(sv ? sv.key : (task ? task.key : pkey(part.rel))) }, I('logs', 'sm')),
    h('button', { class: 'btn sm icon', title: 'More', onclick: (e) => partMenu(e.currentTarget, part) }, I('more', 'sm')));
  card.append(bar);
  return card;
}
function partMenu(anchor, part) {
  const p = proj();
  const scripts = Object.keys(part.scripts || {});
  menu(anchor, [
    { label: 'Open in VS Code', icon: 'code', onClick: () => dp.openCode(part.dir).catch(fail) },
    { label: 'Open the folder', icon: 'folder', onClick: () => dp.openFolder(part.dir) },
    serverOf(part.rel) && serverOf(part.rel).url ? { label: 'Open in the browser', icon: 'globe', onClick: () => dp.openUrl(serverOf(part.rel).url) } : null,
    { sep: true },
    part.kind === 'node' ? { label: `Start script: ${part.dev || 'none'}…`, icon: 'play', onClick: () => chooseDevScript(part) } : null,
    { label: part.port ? `Port: ${part.port}…` : 'Set the port…', icon: 'port', onClick: async () => { const v = await promptBox(`Port of ${part.name}`, 'Used to check the port before starting and to open the browser', part.port || '', 'e.g. 3000'); if (v != null) { if (v && !/^\d{2,5}$/.test(v)) return toast('A port is a number, like 3000', 'warn'); S.scan = await dp.partSet(p.id, part.rel, { port: v ? +v : null }); renderTab(); } } },
    part.kind !== 'docker' ? { label: part.inStartAll === false ? 'Include in “Start all”' : 'Leave out of “Start all”', icon: 'layers', onClick: async () => { S.scan = await dp.partSet(p.id, part.rel, { inStartAll: part.inStartAll === false }); renderTab(); } } : null,
    scripts.length ? { sep: true } : null,
    scripts.length ? { header: 'Run a script' } : null,
    ...scripts.slice(0, 14).map((s) => ({ label: s, icon: 'zap', kbd: part.pm, onClick: () => act(part, 'script:' + s) })),
  ]);
}
async function chooseDevScript(part) {
  const p = proj();
  const opts = Object.keys(part.scripts || {});
  const sel = h('select', { class: 'select', style: { width: '100%' } }, ...opts.map((s) => h('option', { value: s, selected: s === part.dev }, `${s}  ·  ${part.scripts[s]}`.slice(0, 120))));
  const r = await modal({ icon: 'play', title: `How to start ${part.name}`, body: h('label', { class: 'field' }, 'Script used by Start and Start all', sel), buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Save', kind: 'primary', value: 'ok' }] });
  if (r !== 'ok') return;
  S.scan = await dp.partSet(p.id, part.rel, { dev: sel.value }); renderTab(); toast(`${part.name} now starts with “${sel.value}”`, 'ok');
}
async function act(part, action, opts) {
  const p = proj();
  try {
    const r = await dp.run(p.id, part.rel, action, opts);
    if (r.busy) return portBusy(part, r, action);
    if (r.already) toast(`${part.name} is already running`, 'info', 2000);
    else if (['build', 'install', 'down'].includes(action) || action.startsWith('script:')) toast(`${part.name}: ${action.replace('script:', '')} started`, 'info', 2200);
  } catch (e) { fail(e); }
}
async function portBusy(part, r, action = 'dev') {
  const who = r.busy.map((x) => `<b>${esc(x.name)}</b> <span class="mono">(PID ${x.pid})</span>`).join(', ') || 'another program';
  const v = await modal({ icon: 'port', kind: 'warn', title: `Port ${r.port} is already in use`, body: `${who} is using port <b>${r.port}</b>, so <b>${esc(part.name)}</b> can't start on it.<br><br>Usually it's an old copy of the same server that is still running.`,
    buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Start anyway', kind: '', value: 'force' }, { label: 'Stop it & start', kind: 'primary', value: 'kill' }] });
  if (v === 'kill') act(part, action, { killFirst: true });
  if (v === 'force') act(part, action, { force: true });
}
async function startAll(btn, profileId) {
  const p = proj();
  const go = async () => { const r = await dp.startAll(p.id, profileId); afterStart(r); };
  if (btn) await busyBtn(btn, go); else go().catch(fail);
}
async function afterStart(r) {
  if (!r) return;
  if (r.started) toast(`Starting ${r.started} part${r.started > 1 ? 's' : ''}…`, 'ok', 2500);
  if (r.notInstalled && r.notInstalled.length) {
    const ok = await confirmBox('Some parts are not installed', `<b>${r.notInstalled.map(esc).join(', ')}</b> ${r.notInstalled.length > 1 ? 'have' : 'has'} no node_modules yet, so ${r.notInstalled.length > 1 ? 'they were' : 'it was'} not started.<br><br>Install now? Then press Start all again.`, 'Install', 'primary', 'install');
    if (ok) for (const n of r.notInstalled) { const part = S.scan.parts.find((x) => x.name === n); if (part) act(part, 'install'); }
  }
  for (const b of r.busy || []) { const part = S.scan.parts.find((x) => x.name === b.part); if (part) await portBusy(part, { port: b.port, busy: b.who }); }
}

// ------------------------------------------------------------------ logs
function showLogs(key) { S.tab = 'logs'; S.logKey = key; renderTabs(); renderTab(); }
function logItems() {
  const items = new Map();
  for (const part of S.scan ? S.scan.parts : []) items.set(pkey(part.rel), { key: pkey(part.rel), name: part.rel ? part.name : `${part.name} (root)`, sub: part.framework, st: serverOf(part.rel) });
  for (const s of projProcs(S.cur)) if (!items.has(s.key)) items.set(s.key, { key: s.key, name: s.label.split(' · ').slice(1).join(' · ') || s.label, sub: s.action.replace('script:', '').replace(/^custom:.*/, 'button'), st: s });
  return [...items.values()];
}
function tabLogs(b) {
  const items = logItems();
  if (!S.logKey || !items.some((x) => x.key === S.logKey)) { const run = items.find((x) => isUp(x.st)); S.logKey = (run || items[0] || {}).key || null; }
  const list = h('div', { class: 'card loglist', id: 'logList' });
  const cons = h('div', { class: 'card console' });
  b.append(h('div', { class: 'logs' }, list, cons));
  drawLogList();
  drawConsole();
}
function drawLogList() {
  const list = $('#logList'); if (!list) return;
  list.replaceChildren(...logItems().map((x) => {
    const st = x.st, s = !st ? '' : st.status === 'running' ? (st.kind === 'task' ? 'task' : 'run') : st.status === 'starting' ? 'start' : (st.status === 'crashed' || st.status === 'failed') ? 'bad' : '';
    return h('div', { class: 'logitem' + (x.key === S.logKey ? ' on' : ''), onclick: () => { S.logKey = x.key; drawLogList(); drawConsole(); } },
      h('span', { class: 'dot ' + s }), h('div', { class: 't' }, h('b', {}, x.name), h('small', {}, st ? `${x.sub} · ${st.status}` : x.sub)),
      st && st.errors ? h('span', { class: 'chip bad', title: 'Error lines' }, st.errors) : null);
  }));
}
async function drawConsole() {
  const cons = $('.console'); if (!cons) return;
  const key = S.logKey; const st = S.procs.get(key);
  cons.replaceChildren();
  if (!key) { cons.append(h('div', { class: 'empty' }, 'Nothing to show yet.')); return; }
  const search = h('input', { class: 'input', placeholder: 'Search…', value: S.logQ, style: { flex: '0 1 200px', minWidth: '90px', height: '32px' }, oninput: (e) => { S.logQ = e.target.value; fillConsole(); } });
  cons.append(h('div', { class: 'ctool' },
    h('b', {}, (logItems().find((x) => x.key === key) || {}).name || key),
    st ? h('span', { class: 'chip ' + (st.status === 'running' ? 'ok' : st.status === 'crashed' || st.status === 'failed' ? 'bad' : '') }, st.status) : null,
    st && st.url && isUp(st) ? h('span', { class: 'url', onclick: () => dp.openUrl(st.url) }, I('globe', 'sm'), st.url.replace(/\/$/, '')) : null,
    h('span', { class: 'grow' }), search,
    h('button', { class: 'btn sm' + (S.logErrOnly ? ' primary' : ''), onclick: () => { S.logErrOnly = !S.logErrOnly; drawConsole(); } }, I('alert', 'sm'), 'Errors only'),
    h('button', { class: 'btn sm icon', title: S.autoScroll ? 'Auto-scroll on' : 'Auto-scroll off', style: S.autoScroll ? { color: 'var(--accent)' } : {}, onclick: () => { S.autoScroll = !S.autoScroll; drawConsole(); } }, I('down2', 'sm')),
    h('button', { class: 'btn sm icon', title: 'Copy all', onclick: () => dp.copy((S.logs.get(key) || []).map((l) => stripAnsi(l.text)).join('\n')).then(() => toast('Logs copied', 'ok', 1500)) }, I('copy', 'sm')),
    h('button', { class: 'btn sm icon', title: 'Clear', onclick: async () => { await dp.logsClear(key); S.logs.set(key, []); fillConsole(); } }, I('trash', 'sm')),
    st && isUp(st) ? h('button', { class: 'btn sm danger', onclick: (e) => busyBtn(e.currentTarget, () => dp.stop(key)) }, I('stop', 'sm'), 'Stop') : null),
  h('div', { class: 'cbody', id: 'cbody' }));
  if (!S.logs.has(key)) { try { S.logs.set(key, await dp.logs(key)); } catch (_) { S.logs.set(key, []); } }
  fillConsole();
}
const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '');
function ansi(text) {
  let out = '', open = 0;
  const parts = String(text).split(/\x1b\[([0-9;]*)m/);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) { out += esc(parts[i].replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')); continue; }
    const codes = parts[i].split(';').filter(Boolean).map(Number);
    if (!codes.length || codes.includes(0) || codes.includes(39)) { out += '</span>'.repeat(open); open = 0; }
    const cls = codes.filter((c) => (c >= 30 && c <= 37) || (c >= 90 && c <= 97) || c === 1 || c === 2).map((c) => (c === 1 ? 'a1' : c === 2 ? 'a2' : 'c' + c));
    if (cls.length) { out += `<span class="${cls.join(' ')}">`; open++; }
  }
  return out + '</span>'.repeat(open);
}
function lineEl(l) {
  let html = ansi(l.text);
  if (S.logQ) { const q = esc(S.logQ).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); html = html.replace(new RegExp(`(${q})(?![^<]*>)`, 'gi'), '<mark>$1</mark>'); }
  return h('div', { class: 'ln' + (l.s === 'err' ? ' err' : l.s === 'sys' ? ' sys' : ''), html: html || ' ' });
}
const lineOk = (l) => (!S.logErrOnly || l.s === 'err') && (!S.logQ || stripAnsi(l.text).toLowerCase().includes(S.logQ.toLowerCase()));
function fillConsole() {
  const c = $('#cbody'); if (!c) return;
  const lines = (S.logs.get(S.logKey) || []).filter(lineOk).slice(-3000);
  c.replaceChildren(...lines.map(lineEl));
  if (!lines.length) c.append(h('div', { class: 'ln sys', style: { opacity: .6 } }, S.logErrOnly || S.logQ ? 'No matching lines.' : 'No output yet. Start this part to see its logs here.'));
  if (S.autoScroll) c.scrollTop = c.scrollHeight;
}
function appendLogs(batch) {
  for (const [key, lines] of Object.entries(batch)) {
    const arr = S.logs.get(key);
    if (arr) { arr.push(...lines); if (arr.length > 5000) arr.splice(0, arr.length - 5000); }
    if (key === S.logKey && S.tab === 'logs') {
      const c = $('#cbody'); if (!c) continue;
      if (c.firstChild && c.childElementCount === 1 && c.firstChild.classList.contains('sys') && c.firstChild.style.opacity) c.replaceChildren();
      const near = c.scrollHeight - c.scrollTop - c.clientHeight < 80;
      for (const l of lines) if (lineOk(l)) c.append(lineEl(l));
      while (c.childElementCount > 3000) c.firstChild.remove();
      if (S.autoScroll && near) c.scrollTop = c.scrollHeight;
    }
  }
}

// ------------------------------------------------------------------ Prod <-> Local
async function tabUrls(b) {
  const p = proj();
  if (!S.urls) { b.append(h('div', { class: 'empty' }, h('span', { class: 'spin' }), 'Looking for server addresses…')); try { S.urls = await dp.urlsFind(p.id); } catch (e) { S.urls = { items: [], error: e.message }; } if (S.tab === 'urls' && S.cur === p.id) renderTab(); return; }
  const U = S.urls;
  const prodItems = U.items.filter((g) => g.state === 'prod');
  const localItems = U.items.filter((g) => g.state === 'local');
  if (!S.urlSel) {
    const saved = (p.urlPick || []).filter((id) => prodItems.some((g) => g.id === id));
    S.urlSel = new Set(saved.length ? saved : prodItems.filter((g) => g.recommended).map((g) => g.id));
    S.urlOv = { ...(p.urlOverrides || {}) }; S.urlExtra = (p.urlExtra || []).map((x) => ({ ...x }));
  }
  const local = U.localMode;
  const mixed = !local && localItems.length && prodItems.length;
  b.append(h('div', { class: 'card hero' },
    h('div', { class: 'hic', style: { background: local ? 'var(--ok-soft)' : 'var(--accent-soft)', color: local ? 'var(--ok)' : 'var(--accent)' } }, I(local ? 'check' : 'swap', 'lg')),
    h('div', { class: 'grow' },
      h('h2', {}, local ? 'LOCAL mode is on' : mixed ? 'Some addresses are already local' : 'Production addresses'),
      h('p', {}, local ? `${U.files.length} file${U.files.length > 1 ? 's were' : ' was'} switched to localhost ${ago(U.since)} ago. Commits are blocked until you go back to Prod.`
        : `Choose the addresses to switch below. Server${U.serverName ? ` “${U.serverName}”` : ''}${U.serverPort ? ` runs on port ${U.serverPort}` : ': port unknown'}. Every file is backed up first.`)),
    local ? h('button', { class: 'btn lg danger', onclick: (e) => busyBtn(e.currentTarget, toProd) }, I('undo'), 'Back to Prod')
      : h('button', { class: 'btn lg go', disabled: !S.urlSel.size && !S.urlExtra.some((x) => x.prod && x.local), onclick: (e) => busyBtn(e.currentTarget, toLocal) }, I('swap'), 'Switch to Local')));
  if (U.error) b.append(h('div', { class: 'note bad', style: { marginBottom: '16px' } }, I('alert', 'sm'), U.error));
  if (local) {
    b.append(h('div', { class: 'sec' }, h('h3', {}, I('folder', 'sm'), 'Switched files'), h('div', { class: 'card rows' }, ...U.files.map((f) => h('div', { class: 'row' }, I('check', 'sm'), h('span', { class: 'file grow', onclick: () => dp.openCode(p.path + '\\' + f.replace(/\//g, '\\')).catch(fail) }, f))))));
    return;
  }
  const group = (title, icon, list, open = true) => {
    if (!list.length) return null;
    const body = h('div', { class: 'card rows' }, ...list.map(urlRow));
    return open ? h('div', { class: 'sec' }, h('h3', {}, I(icon, 'sm'), title, h('span', { class: 'chip' }, list.length)), body)
      : h('details', { class: 'more sec' }, h('summary', {}, I('chev', 'sm chev'), I(icon, 'sm'), title, h('span', { class: 'chip' }, list.length)), body);
  };
  const rec = prodItems.filter((g) => g.recommended), own = prodItems.filter((g) => !g.recommended && !g.external), ext = prodItems.filter((g) => g.external);
  if (!prodItems.length && !localItems.length) b.append(h('div', { class: 'card empty' }, h('div', { class: 'big' }, I('swap', 'lg')), h('b', {}, 'No server addresses were found'), h('span', {}, 'Add one by hand below: the production address and its local version.')));
  b.append(...[group('Recommended: your server', 'shield', rec), group('Other addresses on your domains', 'globe', own, !!own.some((g) => S.urlSel.has(g.id))),
    group('Outside services (not your server)', 'ext', ext, false), group('Already local', 'check', localItems, false)].filter(Boolean));
  // addresses typed by hand
  const extra = h('div', { class: 'card rows' });
  const drawExtra = () => {
    extra.replaceChildren(...S.urlExtra.map((x, i) => h('div', { class: 'row' },
      h('input', { class: 'input mono', placeholder: 'https://api.mysite.com', value: x.prod || '', style: { flex: 1, color: 'var(--bad)' }, oninput: (e) => { x.prod = e.target.value.trim(); } }), I('chev', 'sm'),
      h('input', { class: 'input mono', placeholder: 'http://localhost:5000', value: x.local || '', style: { flex: 1, color: 'var(--ok)' }, oninput: (e) => { x.local = e.target.value.trim(); } }),
      h('button', { class: 'btn sm icon ghost', onclick: () => { S.urlExtra.splice(i, 1); drawExtra(); } }, I('x', 'sm')))),
    h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { S.urlExtra.push({ prod: '', local: '' }); drawExtra(); } }, I('plus', 'sm'), 'Add an address by hand'), h('span', { class: 'muted', style: { fontSize: '12.5px' } }, 'Replaced everywhere it appears in the app code and .env files.')));
  };
  drawExtra();
  b.append(h('div', { class: 'sec' }, h('h3', {}, I('edit', 'sm'), 'Your own replacements'), extra),
    h('div', { class: 'note info' }, I('shield', 'sm'), h('span', { class: 'grow' }, 'Safe: every file is copied before it changes. “Back to Prod” puts back exactly what was there, even if you edited the file meanwhile.')));
}
function urlRow(g) {
  const p = proj();
  const can = g.state === 'prod';
  const on = can && S.urlSel.has(g.id);
  const localVal = S.urlOv[g.id] || g.local;
  return h('label', { class: 'row', style: { cursor: can ? 'pointer' : 'default', alignItems: 'flex-start' } },
    can ? h('input', { type: 'checkbox', checked: on, style: { width: '16px', height: '16px', marginTop: '3px', accentColor: 'var(--accent)' }, onchange: (e) => { e.target.checked ? S.urlSel.add(g.id) : S.urlSel.delete(g.id); const btn = $('.hero .btn.go'); if (btn) btn.disabled = !S.urlSel.size; } }) : I('check', 'sm'),
    h('div', { class: 'grow' },
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, h('b', { class: 'mono', style: { fontSize: '13px' } }, g.key), h('span', { class: 'chip' }, g.part),
        g.mode === 'toggle' ? h('span', { class: 'chip ok', title: 'Your file already has a localhost line: it is un-commented, and the prod line is commented' }, 'uses your localhost line') : g.mode === 'replace' ? h('span', { class: 'chip info' }, 'replace') : null,
        h('span', { class: 'file', title: 'Open in VS Code', style: { flex: 1 }, onclick: (e) => { e.preventDefault(); dp.openCode(g.file, g.line + 1).catch(fail); } }, `${g.rel}:${g.line + 1}`)),
      can ? h('div', { class: 'swap' }, h('span', { class: 'from' }, g.prod), I('chev', 'sm'),
        g.mode === 'replace' ? h('input', { class: 'input mono', value: localVal || '', placeholder: 'http://localhost:PORT/api', onclick: (e) => e.preventDefault(), oninput: (e) => { S.urlOv[g.id] = e.target.value.trim(); } }) : h('span', { class: 'to' }, localVal))
        : h('div', { class: 'swap' }, h('span', { class: 'to' }, g.local))));
}
async function toLocal() {
  const p = proj();
  const ids = [...S.urlSel];
  const missing = S.urls.items.filter((g) => ids.includes(g.id) && g.mode === 'replace' && !(S.urlOv[g.id] || g.local));
  if (missing.length) return toast('Type the local address for: ' + missing.map((g) => g.key).join(', '), 'warn', 5000);
  const r = await dp.urlsLocal(p.id, ids, S.urlExtra.filter((x) => x.prod && x.local), S.urlOv);
  toast(`LOCAL mode on: ${r.changes} line${r.changes > 1 ? 's' : ''} in ${r.files} file${r.files > 1 ? 's' : ''}`, 'ok', 4500);
  if (r.hook && r.hook !== 'on' && r.hook !== 'no git') toast('Git guard not added: ' + r.hook, 'warn', 5000);
  S.urls = null; await refreshProjects(); renderHeaderOnly(); renderTabs(); renderTab();
}
async function toProd() {
  const p = proj();
  const r = await dp.urlsProd(p.id);
  toast(`Back to Prod: ${r.restored} file${r.restored > 1 ? 's' : ''} restored`, 'ok', 4000);
  for (const c of r.conflicts || []) toast(`${c.file.split(/[\\/]/).pop()}: ${c.reason}`, 'warn', 7000);
  S.urls = null; S.urlSel = null; await refreshProjects(); renderHeaderOnly(); renderTabs(); renderTab();
}

// ------------------------------------------------------------------ images
async function tabImages(b) {
  const p = proj();
  if (!S.images) {
    b.append(h('div', { class: 'card hero' }, h('div', { class: 'hic', style: { background: 'var(--accent-soft)', color: 'var(--accent)' } }, I('broom', 'lg')),
      h('div', { class: 'grow' }, h('h2', {}, 'Find images your code never uses'), h('p', {}, 'Only image files inside this project folder are checked. Nothing on a server or in the cloud is touched. Removed images go to DevPilot’s Trash, so you can restore them.')),
      h('button', { class: 'btn lg primary', onclick: (e) => busyBtn(e.currentTarget, scanImages) }, I('search'), 'Scan images')));
    S.imgBatches = await dp.imagesBatches(p.id).catch(() => []);
    if (S.imgBatches.length) b.append(trashSection());
    return;
  }
  const R = S.images;
  const T = [['unused', 'Not used', R.unused.length, fmtMB(R.bytesUnused)], ['maybe', 'Maybe used', R.maybe.length, 'check first'], ['special', 'Icons kept', R.special.length, 'favicon, app icons'],
    ['duplicates', 'Duplicates', R.duplicates.length, 'groups'], ['big', 'Too big', R.big.length, 'over 500 KB'], ['missing', 'Missing', R.missing.length, 'broken references'], ['trash', 'Trash', S.imgBatches.length, 'restore']];
  b.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' } },
    h('span', { class: 'muted' }, `${R.images} images · ${R.codeFiles} code files read · ${R.used} used`), h('span', { style: { flex: 1 } }),
    h('button', { class: 'btn sm', onclick: (e) => busyBtn(e.currentTarget, scanImages) }, I('refresh', 'sm'), 'Scan again')),
  h('div', { class: 'tiles' }, ...T.map(([id, l, n, s]) => h('div', { class: 'card tile' + (S.imgTab === id ? ' on' : ''), onclick: () => { S.imgTab = id; renderTab(); } },
    h('div', { class: 'n', style: { color: id === 'unused' && n ? 'var(--accent)' : id === 'missing' && n ? 'var(--bad)' : '' } }, n), h('div', { class: 'l' }, l), h('div', { class: 's' }, s)))));
  const t = S.imgTab;
  if (t === 'trash') { b.append(trashSection()); return; }
  if (t === 'missing') {
    b.append(R.missing.length ? h('div', { class: 'card', style: { overflow: 'hidden' } }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Image the code asks for'), h('th', {}, 'In file'))),
      h('tbody', {}, ...R.missing.map((m) => h('tr', {}, h('td', { class: 'mono', style: { color: 'var(--bad)' } }, m.ref), h('td', {}, h('span', { class: 'file', style: { fontFamily: 'var(--mono)', fontSize: '12px', cursor: 'pointer' }, onclick: () => dp.openCode(p.path + '\\' + m.file.replace(/\//g, '\\')).catch(fail) }, m.file)))))))
      : h('div', { class: 'card empty' }, I('check', 'lg'), 'No broken image references found.'));
    return;
  }
  if (t === 'duplicates') {
    if (!R.duplicates.length) { b.append(h('div', { class: 'card empty' }, I('check', 'lg'), 'No duplicate images.')); return; }
    b.append(h('div', { class: 'note info', style: { marginBottom: '12px' } }, I('copy', 'sm'), 'Same picture saved more than once. Before removing a copy, check which name your code uses: “Not used” already tells you when a copy is unused.'),
      ...R.duplicates.map((g) => h('div', { class: 'card', style: { padding: '12px', marginBottom: '10px', display: 'flex', gap: '12px', alignItems: 'center' } },
        h('div', { class: 'img', style: { width: '90px', flex: 'none', border: 0 } }, h('div', { class: 'th', style: { height: '64px' } }, h('img', { src: fileUrl(g.files[0].full), loading: 'lazy' }))),
        h('div', { class: 'grow', style: { minWidth: 0 } }, h('b', {}, `${g.files.length} copies · ${fmtMB(g.size)} each`), ...g.files.map((f) => h('div', { class: 'file mono', style: { fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }, onclick: () => dp.showFile(f.full) }, f.rel))))));
    return;
  }
  if (t === 'big') {
    if (!R.big.length) { b.append(h('div', { class: 'card empty' }, I('check', 'lg'), 'No image over 500 KB.')); return; }
    b.append(h('div', { class: 'card rows' }, ...R.big.map((im) => h('div', { class: 'row' },
      h('div', { class: 'img', style: { width: '74px', flex: 'none', border: 0 } }, h('div', { class: 'th', style: { height: '52px' } }, h('img', { src: fileUrl(im.full), loading: 'lazy' }))),
      h('div', { class: 'grow' }, h('b', {}, im.name), h('span', { class: 'file' }, im.rel)), h('span', { class: 'chip warn' }, fmtMB(im.size)),
      /\.(png|jpe?g)$/i.test(im.name) ? h('button', { class: 'btn sm', title: 'Max 2000 px wide; the original goes to the Trash', onclick: (e) => busyBtn(e.currentTarget, async () => { const r = await dp.imagesShrink(proj().id, im.full); toast(r.saved ? `${im.name}: ${fmtMB(r.before)} → ${fmtMB(r.after)} (original in Trash)` : r.note, r.saved ? 'ok' : 'info', 4500); if (r.saved) { im.size = r.after; } renderTab(); }) }, I('zap', 'sm'), 'Shrink') : h('span', { class: 'chip' }, 'svg/webp: keep')))));
    return;
  }
  const list = t === 'unused' ? R.unused : t === 'maybe' ? R.maybe : R.special;
  if (!list.length) { b.append(h('div', { class: 'card empty' }, I('check', 'lg'), t === 'unused' ? 'Every image is used. Nice and clean!' : 'Nothing here.')); return; }
  if (t !== 'unused') b.append(h('div', { class: 'note ' + (t === 'maybe' ? 'warn' : 'info'), style: { marginBottom: '12px' } }, I('alert', 'sm'),
    t === 'maybe' ? 'Your code builds these names at run time (for example `flag-${code}.png`). They are probably used, so they are never selected for you.' : 'Browsers and phones load these by themselves (favicon, app icons), even if the code never names them. Kept on purpose.'));
  const grid = h('div', { class: 'igrid' }, ...list.map((im) => {
    const tile = h('div', { class: 'card img' + (S.imgSel.has(im.full) ? ' on' : ''), title: `${im.rel}\n${im.why || ''}${im.from ? '\nfrom ' + im.from : ''}`, onclick: () => { S.imgSel.has(im.full) ? S.imgSel.delete(im.full) : S.imgSel.add(im.full); tile.classList.toggle('on'); drawImgBar(); } },
      h('div', { class: 'cb' }, I('check', 'sm')),
      h('div', { class: 'th' }, h('img', { src: fileUrl(im.full), loading: 'lazy', onerror: (e) => { e.target.replaceWith(I('image', 'lg')); } })),
      h('div', { class: 'meta' }, h('b', {}, im.name), h('small', {}, `${fmtMB(im.size)} · ${im.rel.split('/').slice(0, -1).join('/') || '/'}`)));
    return tile;
  }));
  b.append(grid, h('div', { class: 'actionbar', id: 'imgBar' }));
  drawImgBar();
}
function drawImgBar() {
  const bar = $('#imgBar'); if (!bar || !S.images) return;
  const all = [...S.images.unused, ...S.images.maybe, ...S.images.special];
  const sel = all.filter((x) => S.imgSel.has(x.full));
  const bytes = sel.reduce((n, x) => n + x.size, 0);
  const fronts = (S.scan ? S.scan.parts : []).filter((x) => x.commands.build && x.kind === 'node');
  bar.replaceChildren(...[
    h('button', { class: 'btn sm', onclick: () => { const list = S.imgTab === 'unused' ? S.images.unused : S.imgTab === 'maybe' ? S.images.maybe : S.images.special; const allOn = list.every((x) => S.imgSel.has(x.full)); list.forEach((x) => (allOn ? S.imgSel.delete(x.full) : S.imgSel.add(x.full))); renderTab(); } }, I('check', 'sm'), 'Select all'),
    h('b', {}, sel.length ? `${sel.length} selected · ${fmtMB(bytes)}` : 'Click images to select them'),
    h('span', { class: 'grow' }),
    fronts.length ? h('label', { class: 'check', title: 'After moving, DevPilot runs the build. If it fails, every image comes back by itself.' }, h('input', { type: 'checkbox', checked: S.imgBuild, onchange: (e) => { S.imgBuild = e.target.checked; drawImgBar(); } }), 'Check the build first') : null,
    S.imgBuild ? h('div', { style: { display: 'flex', gap: '6px' } }, ...fronts.map((f) => h('button', { class: 'btn sm' + (S.imgBuildParts.has(f.rel) ? ' primary' : ''), onclick: () => { S.imgBuildParts.has(f.rel) ? S.imgBuildParts.delete(f.rel) : S.imgBuildParts.add(f.rel); drawImgBar(); } }, f.name))) : null,
    h('button', { class: 'btn danger', disabled: !sel.length, onclick: (e) => busyBtn(e.currentTarget, () => trashImages(sel)) }, I('trash', 'sm'), 'Move to Trash')].filter(Boolean));
}
async function scanImages() {
  const p = proj();
  S.images = await dp.imagesScan(p.id, {});
  S.imgSel = new Set(S.images.unused.map((x) => x.full));
  S.imgBatches = await dp.imagesBatches(p.id).catch(() => []);
  S.imgTab = 'unused';
  if (!S.imgBuildParts.size) (S.scan ? S.scan.parts : []).filter((x) => x.role === 'frontend' && x.commands.build).forEach((x) => S.imgBuildParts.add(x.rel));
  renderTab();
}
async function trashImages(sel) {
  const p = proj();
  const parts = S.imgBuild ? [...S.imgBuildParts] : [];
  if (!await confirmBox(`Move ${sel.length} image${sel.length > 1 ? 's' : ''} to the Trash?`, `${fmtMB(sel.reduce((n, x) => n + x.size, 0))} will leave the project folder.${parts.length ? '<br><br>Then the build runs; if it fails, everything comes back by itself.' : ''}<br><br>You can restore them any time from <b>Images → Trash</b>.`, 'Move to Trash', 'solid-bad', 'trash')) return;
  if (parts.length) toast('Moving, then building… this can take a minute', 'info', 5000);
  const r = await dp.imagesTrash(p.id, sel.map((x) => x.full), parts);
  if (r.buildFailed) toast(`The build of ${r.buildFailed} failed: all ${r.restored} images were put back. Nothing changed.`, 'warn', 8000);
  else toast(`${r.moved} image${r.moved > 1 ? 's' : ''} moved to the Trash`, 'ok', 4000);
  await scanImages();
}
function trashSection() {
  const p = proj();
  if (!S.imgBatches.length) return h('div', { class: 'card empty' }, h('div', { class: 'big' }, I('trash', 'lg')), 'The Trash is empty.');
  return h('div', { class: 'sec' }, h('h3', {}, I('trash', 'sm'), 'Trash'), h('div', { class: 'card rows' }, ...S.imgBatches.map((bt) => h('div', { class: 'row' },
    I('trash', 'sm'), h('div', { class: 'grow' }, h('b', {}, `${bt.count} file${bt.count > 1 ? 's' : ''} · ${bt.label}`), h('div', { class: 'muted', style: { fontSize: '12px' } }, new Date(bt.at).toLocaleString())),
    h('button', { class: 'btn sm', onclick: (e) => busyBtn(e.currentTarget, async () => { const r = await dp.imagesRestore(p.id, bt.batch); toast(`${r.restored.length} restored${r.skipped.length ? `, ${r.skipped.length} kept in Trash (a file with that name exists)` : ''}`, r.skipped.length ? 'warn' : 'ok', 5000); S.imgBatches = await dp.imagesBatches(p.id); if (S.images) await scanImages(); else renderTab(); }) }, I('undo', 'sm'), 'Restore'),
    h('button', { class: 'btn sm ghost', onclick: async () => { if (await confirmBox('Delete forever?', `These ${bt.count} files will be deleted for good. They can't be restored after this.`, 'Delete forever', 'solid-bad', 'trash')) { await dp.imagesEmpty(p.id, bt.batch); S.imgBatches = await dp.imagesBatches(p.id); renderTab(); } } }, 'Delete forever')))));
}

// ------------------------------------------------------------------ git
async function tabGit(b) {
  const p = proj();
  if (!S.git) { b.append(h('div', { class: 'empty' }, h('span', { class: 'spin' }), 'Reading Git…')); try { S.git = await dp.gitStatus(p.id); } catch (e) { S.git = { ok: false, error: e.message }; } if (S.tab === 'git' && S.cur === p.id) renderTab(); return; }
  const G = S.git;
  if (!G.ok) { b.append(h('div', { class: 'card empty', style: { padding: '50px' } }, h('div', { class: 'big' }, I('git', 'lg')), h('b', {}, G.error))); return; }
  if (p.local) b.append(h('div', { class: 'note warn', style: { marginBottom: '14px' } }, I('alert', 'sm'), h('span', { class: 'grow' }, 'LOCAL mode is on: commits are blocked so local addresses never reach your repository. Use “Back to Prod” first.')));
  const sel = h('select', { class: 'select' }, ...G.branches.map((x) => h('option', { value: x, selected: x === G.branch }, x)));
  b.append(h('div', { class: 'card hero' }, h('div', { class: 'hic', style: { background: 'var(--accent-soft)', color: 'var(--accent)' } }, I('git', 'lg')),
    h('div', { class: 'grow' }, h('h2', {}, G.branch || '(no branch)'), h('p', {}, (G.upstream ? `Tracks ${G.upstream}` : 'No remote branch') + (G.track ? ` · ${G.track}` : '') + ` · ${G.files.length} changed file${G.files.length === 1 ? '' : 's'}`)),
    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, sel,
      h('button', { class: 'btn', onclick: (e) => busyBtn(e.currentTarget, async () => { if (sel.value === G.branch) return; await dp.gitCheckout(p.id, sel.value); toast(`Switched to ${sel.value}`, 'ok'); S.git = null; S.scan = await dp.scan(p.id); renderTab(); }) }, I('swap', 'sm'), 'Switch'),
      h('button', { class: 'btn primary', onclick: (e) => busyBtn(e.currentTarget, async () => { const out = await dp.gitPull(p.id); toast(out.split('\n')[0] || 'Up to date', 'ok', 4000); S.git = null; renderTab(); }) }, I('down2', 'sm'), 'Pull'),
      h('button', { class: 'btn icon', title: 'Refresh', onclick: () => { S.git = null; renderTab(); } }, I('refresh', 'sm')))));
  const color = (st) => (/M/.test(st) ? 'var(--warn)' : /A|\?/.test(st) ? 'var(--ok)' : /D/.test(st) ? 'var(--bad)' : 'var(--muted)');
  b.append(G.files.length ? h('div', { class: 'sec' }, h('h3', {}, 'Changed files'), h('div', { class: 'card rows', style: { maxHeight: '52vh', overflowY: 'auto' } }, ...G.files.map((f) => h('div', { class: 'row' },
    h('span', { class: 'mono', style: { width: '26px', fontWeight: 800, color: color(f.st) } }, f.st.trim() || '·'), h('span', { class: 'file grow', onclick: () => dp.openCode(p.path + '\\' + f.file.replace(/\//g, '\\').replace(/^"|"$/g, '')).catch(fail) }, f.file)))))
    : h('div', { class: 'card empty' }, I('check', 'lg'), 'Nothing changed: your working copy is clean.'));
}

// ------------------------------------------------------------------ custom buttons + profiles
function tabButtons(b) {
  const p = proj();
  const btns = p.buttons || [], profs = p.profiles || [];
  b.append(h('div', { class: 'sec' }, h('h3', {}, I('zap', 'sm'), 'Your buttons', h('span', { style: { flex: 1 } }), h('button', { class: 'btn sm', onclick: () => editButton() }, I('plus', 'sm'), 'New button')),
    btns.length ? h('div', { class: 'card rows' }, ...btns.map((x) => h('div', { class: 'row' }, h('div', { class: 'fi', style: { width: '34px', height: '34px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' } }, I('zap', 'sm')),
      h('div', { class: 'grow' }, h('b', {}, x.label), h('div', { class: 'mono muted', style: { fontSize: '12px' } }, `${x.part ? x.part + ' › ' : ''}${x.cmd}`)),
      x.long ? h('span', { class: 'chip info' }, 'keeps running') : null,
      h('button', { class: 'btn sm go', onclick: (e) => busyBtn(e.currentTarget, async () => { await dp.custom(p.id, x.id); toast(`${x.label} started: see Logs`, 'info'); }) }, I('play', 'sm'), 'Run'),
      h('button', { class: 'btn sm icon ghost', title: 'Edit', onclick: () => editButton(x) }, I('edit', 'sm')),
      h('button', { class: 'btn sm icon ghost', title: 'Delete', onclick: async () => { if (await confirmBox(`Delete “${x.label}”?`, 'Only the button is deleted.', 'Delete', 'solid-bad', 'trash')) { await dp.projectUpdate(p.id, { buttons: btns.filter((y) => y.id !== x.id) }); await refreshProjects(); renderTab(); } } }, I('trash', 'sm')))))
      : h('div', { class: 'card empty' }, 'Any command as a button: npm run seed, docker compose up, node scripts/reset.js…')),
  h('div', { class: 'sec' }, h('h3', {}, I('layers', 'sm'), 'Profiles for “Start all”', h('span', { style: { flex: 1 } }), h('button', { class: 'btn sm', onclick: () => editProfile() }, I('plus', 'sm'), 'New profile')),
    profs.length ? h('div', { class: 'card rows' }, ...profs.map((x) => h('div', { class: 'row' }, I('layers', 'sm'), h('div', { class: 'grow' }, h('b', {}, x.name), h('div', { class: 'muted', style: { fontSize: '12.5px' } }, x.parts.map((r) => r || '(root)').join(' · ') || 'no parts')),
      h('button', { class: 'btn sm go', onclick: () => startAll(null, x.id) }, I('play', 'sm'), 'Start'),
      h('button', { class: 'btn sm icon ghost', onclick: () => editProfile(x) }, I('edit', 'sm')),
      h('button', { class: 'btn sm icon ghost', onclick: async () => { await dp.projectUpdate(p.id, { profiles: profs.filter((y) => y.id !== x.id) }); await refreshProjects(); renderTab(); renderHeaderOnly(); } }, I('trash', 'sm')))))
      : h('div', { class: 'card empty' }, 'For example “Backend only” or “Admin + server”: one click starts just those parts.')));
}
async function editButton(x) {
  const p = proj();
  const lab = h('input', { class: 'input', value: x ? x.label : '', placeholder: 'Seed database' });
  const cmd = h('input', { class: 'input mono', value: x ? x.cmd : '', placeholder: 'npm run seed' });
  const part = h('select', { class: 'select' }, h('option', { value: '' }, '(project folder)'), ...(S.scan ? S.scan.parts.filter((y) => y.rel && y.kind !== 'docker') : []).map((y) => h('option', { value: y.rel, selected: x && x.part === y.rel }, y.rel)));
  let long = !!(x && x.long);
  const sw = h('button', { class: 'switch' + (long ? ' on' : ''), onclick: () => { long = !long; sw.classList.toggle('on', long); } });
  const r = await modal({ icon: 'zap', title: x ? 'Edit button' : 'New button', body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    h('label', { class: 'field' }, 'Name', lab), h('label', { class: 'field' }, 'Command', cmd), h('label', { class: 'field' }, 'Run it in', part),
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, sw, h('span', {}, 'It keeps running (a server or watcher)'))),
  buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Save', kind: 'primary', value: 'ok', onClick: () => { if (!lab.value.trim() || !cmd.value.trim()) { toast('Give it a name and a command', 'warn'); return false; } return true; } }] });
  if (r !== 'ok') return;
  const item = { id: x ? x.id : Date.now().toString(36), label: lab.value.trim(), cmd: cmd.value.trim(), part: part.value, long };
  const list = (p.buttons || []).filter((y) => y.id !== item.id); list.push(item);
  await dp.projectUpdate(p.id, { buttons: list }); await refreshProjects(); renderTab();
}
async function editProfile(x) {
  const p = proj();
  const name = h('input', { class: 'input', value: x ? x.name : '', placeholder: 'Backend only' });
  const sel = new Set(x ? x.parts : []);
  const parts = (S.scan ? S.scan.parts : []).filter((y) => y.commands.dev);
  const r = await modal({ icon: 'layers', title: x ? 'Edit profile' : 'New profile', body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, h('label', { class: 'field' }, 'Name', name),
    h('div', { class: 'field' }, 'Parts it starts', h('div', { class: 'card rows' }, ...parts.map((y) => h('label', { class: 'row', style: { cursor: 'pointer' } }, h('input', { type: 'checkbox', checked: sel.has(y.rel), style: { accentColor: 'var(--accent)', width: '16px', height: '16px' }, onchange: (e) => { e.target.checked ? sel.add(y.rel) : sel.delete(y.rel); } }), fwBadge(y.framework), h('b', { class: 'grow' }, y.rel || `${y.name} (root)`)))))),
  buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Save', kind: 'primary', value: 'ok', onClick: () => { if (!name.value.trim() || !sel.size) { toast('Give it a name and choose parts', 'warn'); return false; } return true; } }] });
  if (r !== 'ok') return;
  const item = { id: x ? x.id : Date.now().toString(36), name: name.value.trim(), parts: [...sel] };
  const list = (p.profiles || []).filter((y) => y.id !== item.id); list.push(item);
  await dp.projectUpdate(p.id, { profiles: list }); await refreshProjects(); renderTab(); renderHeaderOnly();
}

// ------------------------------------------------------------------ ports page
let portsTimer = null;
const SYSPROC = /^(system|svchost|lsass|wininit|services|spoolsv|smss|csrss|winlogon|dwm|explorer|searchindexer|msmpeng|nissrv|mdnsresponder|registry|memory compression)(\.exe)?$/i;
async function renderPorts(v) {
  crumb(h('b', {}, 'Ports'));
  const q = h('input', { class: 'input', placeholder: 'Filter by port or program…', value: S.portQ, style: { width: '280px' }, oninput: (e) => { S.portQ = e.target.value; drawPortRows(); } });
  v.append(h('div', { class: 'phead' }, h('div', { class: 'hic', style: { width: '52px', height: '52px', borderRadius: '15px', display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' } }, I('port', 'lg')),
    h('div', { class: 'title' }, h('h1', {}, 'Ports in use'), h('div', { class: 'muted' }, 'Every program listening on a port on this PC. Stop the one blocking your server.')),
    h('div', { class: 'acts' }, q, h('button', { class: 'btn', onclick: (e) => busyBtn(e.currentTarget, loadPorts) }, I('refresh', 'sm'), 'Refresh'))),
  h('div', { class: 'card', style: { overflow: 'hidden' } }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', { style: { width: '90px' } }, 'Port'), h('th', {}, 'Program'), h('th', { style: { width: '90px' } }, 'PID'), h('th', {}, 'Address'), h('th', {}, 'Started by DevPilot'), h('th', { style: { width: '110px' } }, ''))), h('tbody', { id: 'portRows' }))));
  await loadPorts();
  clearInterval(portsTimer);
  portsTimer = setInterval(() => { if (S.page === 'ports') loadPorts().catch(() => {}); else clearInterval(portsTimer); }, 5000);
}
async function loadPorts() { S.ports = await dp.ports(); drawPortRows(); }
function drawPortRows() {
  const tb = $('#portRows'); if (!tb) return;
  const q = S.portQ.trim().toLowerCase();
  const DEV = new Set([3000, 3001, 4000, 4200, 5000, 5173, 5174, 8000, 8080, 8081, 8084, 8086, 8888, 9000]);
  const rows = (S.ports || []).filter((x) => !q || String(x.port).includes(q) || x.name.toLowerCase().includes(q) || (x.mine || '').toLowerCase().includes(q));
  if (!S.ports) { tb.replaceChildren(h('tr', {}, h('td', { colspan: 6 }, h('div', { class: 'empty' }, h('span', { class: 'spin' }))))); return; }
  tb.replaceChildren(...rows.map((x) => h('tr', {},
    h('td', {}, h('b', { class: 'mono', style: { color: DEV.has(x.port) || x.mine ? 'var(--accent)' : '' } }, x.port)),
    h('td', {}, h('b', {}, x.name)), h('td', { class: 'mono muted' }, x.pid), h('td', { class: 'mono faint' }, x.address),
    h('td', {}, x.mine ? h('span', { class: 'chip ok' }, x.mine) : h('span', { class: 'faint' }, '—')),
    h('td', { style: { textAlign: 'right' } }, SYSPROC.test(x.name) || x.pid === 4 ? h('span', { class: 'chip', title: 'A Windows program: DevPilot never stops it' }, I('shield', 'sm'), 'Windows') : h('button', { class: 'btn sm danger', onclick: async (e) => {
      if (!await confirmBox(`Stop ${x.name}?`, `This stops <b>${esc(x.name)}</b> (PID ${x.pid}) and everything it started, which frees port <b>${x.port}</b>.${/^(svchost|system|lsass|wininit|services|spoolsv)/i.test(x.name) ? '<br><br><b style="color:var(--bad)">This is a Windows program. Stopping it can break your PC: better not.</b>' : ''}`, 'Stop it', 'solid-bad', 'stop')) return;
      busyBtn(e.currentTarget, async () => { const r = await dp.kill(x.pid); toast(r.ok ? `${x.name} stopped` : (r.message || 'Could not stop it'), r.ok ? 'ok' : 'bad'); await loadPorts(); });
    } }, I('stop', 'sm'), 'Stop')))));
  if (!rows.length) tb.append(h('tr', {}, h('td', { colspan: 6 }, h('div', { class: 'empty' }, 'No port matches.'))));
}

// ------------------------------------------------------------------ settings
function renderSettings(v) {
  crumb(h('b', {}, 'Settings'));
  const st = S.settings;
  const setS = async (patch) => { S.settings = await dp.settings(patch); renderSettings($('#view')); };
  const toggle = (k) => h('button', { class: 'switch' + (st[k] ? ' on' : ''), onclick: () => setS({ [k]: !st[k] }) });
  v.replaceChildren(h('div', { style: { maxWidth: '820px' } },
    h('div', { class: 'phead' }, h('div', { class: 'title' }, h('h1', {}, 'Settings'), h('div', { class: 'muted' }, 'DevPilot · version ' + (S.version || '')))),
    h('div', { class: 'sec' }, h('h3', {}, 'Look'), h('div', { class: 'card' }, h('div', { class: 'setrow' }, h('div', { class: 'grow' }, h('b', {}, 'Theme'), h('small', {}, 'Dark, light, or follow Windows')),
      h('div', { class: 'seg' }, ...[['dark', 'moon', 'Dark'], ['light', 'sun', 'Light'], ['system', 'monitor', 'System']].map(([k, i, l]) => h('button', { class: st.theme === k ? 'on' : '', onclick: () => setS({ theme: k }) }, I(i, 'sm'), l)))))),
    h('div', { class: 'sec' }, h('h3', {}, 'Running'), h('div', { class: 'card' },
      h('div', { class: 'setrow' }, h('div', { class: 'grow' }, h('b', {}, 'Restart a server when it crashes'), h('small', {}, 'At most 3 times in a minute, then it waits for you')), toggle('autoRestart')),
      h('div', { class: 'setrow' }, h('div', { class: 'grow' }, h('b', {}, 'Notify me when something crashes'), h('small', {}, 'A Windows notification with the error line')), toggle('notifications')),
      h('div', { class: 'setrow' }, h('div', { class: 'grow' }, h('b', {}, 'Stop everything when DevPilot quits'), h('small', {}, 'Closing the window keeps servers running in the tray; “Quit” stops them')), toggle('stopOnQuit')))),
    h('div', { class: 'sec' }, h('h3', {}, 'Editor'), h('div', { class: 'card' }, h('div', { class: 'setrow' }, h('div', { class: 'grow' }, h('b', {}, 'VS Code location'), h('small', { class: 'mono' }, st.vscode || 'Found automatically')),
      h('button', { class: 'btn sm', onclick: async () => { const f = await dp.pickFile(); if (f) setS({ vscode: f }); } }, I('folder', 'sm'), 'Choose…'), st.vscode ? h('button', { class: 'btn sm ghost', onclick: () => setS({ vscode: '' }) }, 'Automatic') : null))),
    h('div', { class: 'sec' }, h('h3', {}, 'Data'), h('div', { class: 'card' }, h('div', { class: 'setrow' }, h('div', { class: 'grow' }, h('b', {}, 'DevPilot’s folder'), h('small', { class: 'mono' }, S.data || '')),
      h('button', { class: 'btn sm', onclick: () => dp.openFolder(S.data) }, I('folder', 'sm'), 'Open')))),
    h('div', { class: 'note info' }, I('shield', 'sm'), h('span', { class: 'grow' }, 'Everything stays on this PC. DevPilot needs no internet and no account.'))));
}

// ------------------------------------------------------------------ live events
dp.on('proc-state', (s) => {
  S.procs.set(s.key, s);
  if (s.project === S.cur && S.page === 'project') {
    if (S.tab === 'overview') drawCards();
    if (S.tab === 'logs') { drawLogList(); if (s.key === S.logKey) { const t = $('.ctool .chip'); if (t) t.textContent = s.status; } }
    renderTabs(); renderHeaderOnly();
  }
  renderSideSoon();
});
dp.on('proc-logs', appendLogs);
dp.on('toast', (t) => toast(t.text, t.kind));
dp.on('theme', (t) => applyTheme(t.dark));
dp.on('focus-logs', (key) => { const pid = key.split('|')[0]; S.logKey = key; if (S.cur !== pid) openProject(pid, 'logs').then(() => { S.logKey = key; renderTab(); }); else showLogs(key); });
let sideTimer = null;
function renderSideSoon() { clearTimeout(sideTimer); sideTimer = setTimeout(renderSide, 250); }
setInterval(() => { if (S.page === 'project' && S.tab === 'overview' && [...S.procs.values()].some(isUp)) drawCards(); }, 5000);   // uptime

// ------------------------------------------------------------------ start
$('#sideQ').addEventListener('input', (e) => { S.q = e.target.value; renderSide(); });
$('#btnAdd').addEventListener('click', addProject);
$('#btnFind').addEventListener('click', findProjectsModal);
$$('.nav-item').forEach((b) => b.addEventListener('click', () => setPage(b.dataset.page)));
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'f' && S.tab === 'logs' && S.page === 'project') { const i = $('.ctool .input'); if (i) { e.preventDefault(); i.focus(); } }
});
(async function init() {
  try {
    const st = await dp.state();
    S.settings = st.settings; S.projects = st.projects; S.version = st.version; S.data = st.data;
    for (const s of st.procs) S.procs.set(s.key, s);
    applyTheme(st.dark);
    renderSide();
    const last = st.last && st.projects.find((p) => p.id === st.last);
    if (last) openProject(last.id); else if (st.projects.length) openProject(st.projects[0].id); else renderView();
  } catch (e) { document.body.append(h('pre', { style: { padding: '20px', color: 'var(--bad)' } }, 'DevPilot could not start: ' + e.message)); }
})();
