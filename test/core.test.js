'use strict';
// DevPilot core tests (no Electron needed):  node --test test/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { scanProject } = require('../lib/scan');
const urls = require('../lib/urls');
const images = require('../lib/images');
const { Procs } = require('../lib/procs');
const ports = require('../lib/ports');

const W = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-test-'));
  W(root, 'server/package.json', JSON.stringify({ scripts: { start: 'node src/server.js', build: 'tsc' }, dependencies: { express: '4' } }));
  W(root, 'server/yarn.lock', '');
  W(root, 'server/src/server.js', '// const PORT = 9999;\r\nconst PORT = process.env.PORT || 8086;\r\napp.listen(PORT);\r\n');
  W(root, 'admin/package.json', JSON.stringify({ scripts: { start: 'npm run start:localhost', 'start:localhost': 'react-scripts start', build: 'react-scripts build' }, dependencies: { 'react-scripts': '5' } }));
  W(root, 'admin/package-lock.json', '{}');
  W(root, 'platform/package.json', JSON.stringify({ scripts: { dev: 'vite', build: 'vite build' }, dependencies: { vite: '5', 'react-scripts': '5' } }));
  W(root, 'platform/vite.config.ts', 'export default {\r\n  // server:{host:"1.2.3.4",port:80},\r\n};\r\n');
  fs.mkdirSync(path.join(root, 'platform', 'node_modules'), { recursive: true });
  W(root, 'package.json', JSON.stringify({ scripts: { dev: 'concurrently "npm --prefix server run start" "npm --prefix platform run dev"' } }));
  W(root, 'platform/src/axios.tsx', 'const a = Axios.create({\r\n  baseURL: "https://api.shop.com/api",\r\n  // baseURL: "http://localhost:8086/api",\r\n});\r\nconst ext = { url: "https://api.binance.com/api/v3" };\r\n');
  W(root, 'platform/.env', 'VITE_API_URL=https://api.shop.com/api\n# VITE_OLD=https://old.shop.com\n');
  W(root, 'platform/src/App.tsx', 'export const A = () => <img src="/img/logo.png"/>;\nconst f = (c) => `/img/flag-${c}.png`;\nconst broken = "/img/nothere.png";\n');
  for (const n of ['logo', 'old', 'flag-fr', 'copy-a']) fs.writeFileSync(W(root, `platform/public/img/${n}.png`, ''), PNG);
  fs.writeFileSync(path.join(root, 'platform/public/img/copy-b.png'), PNG);
  W(root, 'platform/public/favicon.ico', 'x');
  W(root, 'platform/public/uploads/user1.png', 'x');
  return root;
}

test('scan: parts, package managers, ports, framework by command, orchestrator', () => {
  const root = makeProject();
  const s = scanProject(root);
  const by = Object.fromEntries(s.parts.map((p) => [p.rel || '(root)', p]));
  assert.equal(by.server.role, 'backend');
  assert.equal(by.server.pm, 'yarn');
  assert.equal(by.server.port, 8086, 'the commented 9999 must be ignored');
  assert.equal(by.server.commands.dev, 'yarn start');
  assert.equal(by.admin.framework, 'React (CRA)');
  assert.equal(by.admin.commands.dev, 'npm run start:localhost');
  assert.equal(by.platform.framework, 'Vite', 'the dev script runs vite');
  assert.equal(by.platform.port, 5173, 'the commented port 80 must be ignored');
  assert.equal(by.platform.installed, true);
  assert.equal(by.admin.installed, false);
  assert.equal(by['(root)'].orchestrator, true);
  assert.equal(by['(root)'].inStartAll, false);
  assert.equal(s.parts[0].role, 'backend', 'the server comes first');
});

test('urls: toggle your localhost line, replace .env, skip outside services, restore byte-identical', () => {
  const root = makeProject();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-data-'));
  const s = scanProject(root);
  const r = urls.find(s);
  assert.equal(r.serverPort, 8086);
  const ax = r.items.find((g) => g.key === 'baseURL');
  assert.equal(ax.mode, 'toggle'); assert.equal(ax.recommended, true); assert.equal(ax.local, 'http://localhost:8086/api');
  const env = r.items.find((g) => g.key === 'VITE_API_URL');
  assert.equal(env.mode, 'replace'); assert.equal(env.recommended, true); assert.equal(env.local, 'http://localhost:8086/api');
  const ext = r.items.find((g) => /binance/.test(g.prod || ''));
  assert.ok(!ext || (!ext.recommended && ext.external), 'outside services are never recommended');
  const files = [path.join(root, 'platform/src/axios.tsx'), path.join(root, 'platform/.env')];
  const before = files.map((f) => fs.readFileSync(f));
  const proj = { id: 'p1', path: root };
  const res = urls.toLocal(data, proj, { ...r, parts: s.parts }, r.items.filter((g) => g.recommended).map((g) => g.id));
  assert.equal(res.files, 2);
  const ax2 = fs.readFileSync(files[0], 'utf8');
  assert.match(ax2, /\/\/ baseURL: "https:\/\/api\.shop\.com\/api"/);
  assert.match(ax2, /\n  baseURL: "http:\/\/localhost:8086\/api"/);
  assert.match(ax2, /\r\n/, 'Windows line endings kept');
  assert.equal(fs.readFileSync(files[1], 'utf8').split('\n')[0], 'VITE_API_URL=http://localhost:8086/api');
  assert.ok(urls.status(data, 'p1'));
  assert.throws(() => urls.toLocal(data, proj, { ...r, parts: s.parts }, [ax.id]), /already/);
  // you edit the file while LOCAL: your edit stays, our lines are undone
  fs.appendFileSync(files[0], '// my edit\r\n');
  const back = urls.toProd(data, proj);
  assert.equal(back.restored, 2);
  assert.equal(back.conflicts.length, 0);
  assert.equal(fs.readFileSync(files[0], 'utf8'), before[0].toString() + '// my edit\r\n');
  assert.deepEqual(fs.readFileSync(files[1]), before[1]);
  assert.equal(urls.status(data, 'p1'), null);
});

test('urls: git guard blocks commits only while LOCAL, and keeps your own hook', () => {
  const root = makeProject();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-data-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  const s = scanProject(root); const r = urls.find(s);
  const proj = { id: 'g1', path: root };
  const res = urls.toLocal(data, proj, { ...r, parts: s.parts }, r.items.filter((g) => g.recommended).map((g) => g.id));
  assert.equal(res.hook, 'on');
  assert.ok(fs.existsSync(path.join(root, '.git/hooks/pre-commit')));
  urls.toProd(data, proj);
  assert.ok(!fs.existsSync(path.join(root, '.git/hooks/pre-commit')));
  W(root, '.git/hooks/pre-commit', '#!/bin/sh\necho mine\n');
  const res2 = urls.toLocal(data, proj, { ...r, parts: s.parts }, r.items.filter((g) => g.recommended).map((g) => g.id));
  assert.match(res2.hook, /your own/);
  urls.toProd(data, proj);
  assert.equal(fs.readFileSync(path.join(root, '.git/hooks/pre-commit'), 'utf8'), '#!/bin/sh\necho mine\n');
});

test('images: unused / maybe / special / duplicates / missing; uploads skipped; trash + restore', () => {
  const root = makeProject();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-data-'));
  const r = images.scan(root);
  const names = (l) => l.map((x) => x.name).sort();
  assert.deepEqual(names(r.unused), ['copy-a.png', 'copy-b.png', 'old.png']);
  assert.deepEqual(names(r.maybe), ['flag-fr.png']);
  assert.ok(names(r.special).includes('favicon.ico'));
  assert.ok(!r.unused.concat(r.maybe, r.special).some((x) => /uploads/.test(x.rel)), 'uploads are never listed');
  assert.equal(r.duplicates.length, 1);
  assert.ok(r.missing.some((m) => m.ref === '/img/nothere.png'));
  assert.ok(!r.missing.some((m) => m.ref === '/img/logo.png'));
  const files = r.unused.map((x) => x.full);
  const t = images.moveToTrash(data, 'p', root, files);
  assert.equal(t.moved.length, 3);
  assert.ok(files.every((f) => !fs.existsSync(f)));
  assert.equal(images.batches(data, 'p').length, 1);
  assert.equal(images.moveToTrash(data, 'p', root, [path.join(os.tmpdir(), 'outside.png')]).moved.length, 0, 'never a file outside the project');
  const back = images.restore(data, 'p', t.batch);
  assert.equal(back.restored.length, 3);
  assert.ok(files.every((f) => fs.existsSync(f)));
  assert.equal(images.batches(data, 'p').length, 0);
});

test('procs: start, ready from the port, stop the whole tree, crash detected', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-proc-'));
  W(dir, 'srv.js', "require('http').createServer((q,r)=>r.end('ok')).listen(+process.env.PORT,()=>console.log('Server listening on port '+process.env.PORT)); if(process.env.CRASH) setTimeout(()=>{console.error('Error: boom');process.exit(2)},800);");
  const P = new Procs();
  try {
    P.start('a', { cmd: 'node srv.js', cwd: dir, port: 47391, env: { PORT: '47391' } });
    assert.equal(await P.waitReady('a', 15000), true);
    assert.equal(P.state('a').url, 'http://localhost:47391');
    await P.stop('a');
    assert.equal(P.state('a').status, 'stopped');
    assert.equal(await ports.isOpen(47391), false, 'the port is free after Stop');
    let crashed = null; P.on('crash', (s) => { crashed = s; });
    P.start('b', { cmd: 'node srv.js', cwd: dir, port: 47392, env: { PORT: '47392', CRASH: '1' } });
    await new Promise((r) => setTimeout(r, 3500));
    assert.equal(P.state('b').status, 'crashed');
    assert.ok(crashed && /boom/.test(crashed.lastError));
    P.start('t', { kind: 'task', cmd: 'node -e "process.exit(0)"', cwd: dir });
    await new Promise((r) => setTimeout(r, 2000));
    assert.equal(P.state('t').status, 'done');
  } finally { await P.stopAll(); P.dispose(); }
});
