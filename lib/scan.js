'use strict';
// Reads a project folder and works out its parts (backend, admin, platform…), how to run each one, and its port.
// No AI: package.json scripts + dependencies, lock files, .env files, vite config and the server's own code.
const fs = require('fs');
const path = require('path');
const { readText, readJson, exists, isDir, SKIP_DIRS } = require('./util');

const FRONT = [['next', 'Next.js', 3000], ['nuxt', 'Nuxt', 3000], ['@angular/core', 'Angular', 4200], ['react-scripts', 'React (CRA)', 3000],
  ['vite', 'Vite', 5173], ['@sveltejs/kit', 'SvelteKit', 5173], ['gatsby', 'Gatsby', 8000], ['@vue/cli-service', 'Vue CLI', 8080],
  ['expo', 'Expo', 8081], ['astro', 'Astro', 4321], ['webpack-dev-server', 'Webpack', 8080], ['parcel', 'Parcel', 1234]];
const BACK = [['@nestjs/core', 'NestJS', 3000], ['express', 'Express', 3000], ['fastify', 'Fastify', 3000], ['koa', 'Koa', 3000],
  ['@hapi/hapi', 'Hapi', 3000], ['apollo-server', 'Apollo', 4000], ['@apollo/server', 'Apollo', 4000], ['hono', 'Hono', 3000]];
const DEV_SCRIPTS = ['dev', 'start:dev', 'develop', 'serve', 'start:local', 'start:localhost', 'watch', 'start'];
const PROD_SCRIPTS = ['start:prod', 'prod', 'start:production', 'serve:prod', 'preview'];
const BACKEND_NAMES = /^(server|backend|api|service|services|core-api)$/i;

function lockOf(dir) {
  const locks = [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['package-lock.json', 'npm'], ['bun.lockb', 'bun'], ['bun.lock', 'bun']];
  const found = locks.map(([f, pm]) => { try { return { pm, t: fs.statSync(path.join(dir, f)).mtimeMs }; } catch (_) { return null; } }).filter(Boolean);
  if (!found.length) return null;
  found.sort((a, b) => b.t - a.t);              // both npm and yarn lock files: the one used last
  return { pm: found[0].pm, all: found.map((f) => f.pm) };
}

const runCmd = (pm, script) => (pm === 'yarn' ? `yarn ${script}` : `${pm} run ${script}`);
const installCmd = (pm) => (pm === 'yarn' ? 'yarn install' : `${pm} install`);

function envPort(dir) {
  for (const f of ['.env.local', '.env.development.local', '.env.development', '.env']) {
    const t = readText(path.join(dir, f));
    if (!t) continue;
    const m = /^\s*(?:export\s+)?PORT\s*=\s*["']?(\d{2,5})/m.exec(t);
    if (m) return { port: +m[1], from: f };
  }
  return null;
}

function scriptPort(script) {
  const m = /(?:--port[=\s]+|-p\s+|\bPORT=)(\d{2,5})/.exec(script || '');
  return m ? +m[1] : null;
}

// remove // and /* */ comments (keeps "http://" in strings): commented-out config must not count
function stripComments(t) {
  return String(t || '').replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
}

function vitePort(dir) {
  for (const f of ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs']) {
    const t = stripComments(readText(path.join(dir, f)));
    if (!t) continue;
    const m = /server\s*:\s*\{[^}]*?\bport\s*:\s*(\d{2,5})/s.exec(t);
    if (m) return +m[1];
  }
  return null;
}

// the port a backend listens on, from its own code: `process.env.PORT || 8086`, `listen(4000)`, `PORT ?? 5000`
function codePort(dir) {
  const files = [];
  const roots = ['src', 'server', 'app', '.'];
  for (const r of roots) {
    const base = path.join(dir, r);
    if (!isDir(base)) continue;
    const stack = [[base, 0]];
    while (stack.length && files.length < 400) {
      const [d, depth] = stack.pop();
      let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { continue; }
      for (const e of ents) {
        if (e.isDirectory()) { if (depth < 3 && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) stack.push([path.join(d, e.name), depth + 1]); }
        else if (/\.(c|m)?(js|ts)$/.test(e.name) && !/\.(test|spec|d)\.[cm]?[jt]s$/.test(e.name)) files.push(path.join(d, e.name));
      }
    }
    if (r === '.') break;
  }
  // likely entry files first
  files.sort((a, b) => score(b) - score(a));
  for (const f of files.slice(0, 400)) {
    const t = stripComments(readText(f, 400 * 1024));
    if (!t) continue;
    let m = /PORT\s*(?:\|\||\?\?)\s*["']?(\d{2,5})/.exec(t) || /\.listen\(\s*(\d{2,5})\s*[,)]/.exec(t) || /\bport\s*[:=]\s*(?:process\.env\.\w+\s*(?:\|\||\?\?)\s*)?(\d{4,5})\b/i.exec(t);
    if (m) return { port: +m[1], from: path.relative(dir, f).replace(/\\/g, '/') };
  }
  return null;
}
const score = (f) => (/(server|index|main|app)\.[cm]?[jt]s$/i.test(f) ? 2 : 0) + (/[\\/]src[\\/][^\\/]+$/.test(f) ? 1 : 0);

function nodePart(projectDir, rel, pkg, rootLock) {
  const dir = path.join(projectDir, rel);
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const scripts = pkg.scripts || {};
  // the framework the dev script really runs (a project can list both vite and react-scripts)
  const devCmd = DEV_SCRIPTS.map((s) => scripts[s]).find(Boolean) || '';
  const BY_CMD = [[/\bvite\b/, 'vite'], [/\bnext\b/, 'next'], [/\breact-scripts\b/, 'react-scripts'], [/\bng\s+serve\b/, '@angular/core'], [/\bnuxt\b/, 'nuxt'],
    [/vue-cli-service/, '@vue/cli-service'], [/\bgatsby\b/, 'gatsby'], [/\bastro\b/, 'astro'], [/\bexpo\b/, 'expo']];
  const hit = BY_CMD.find(([rx, d]) => rx.test(devCmd) && deps[d]);
  const fw = (hit && FRONT.find(([d]) => d === hit[1])) || FRONT.find(([d]) => deps[d]) || null;
  const bk = BACK.find(([d]) => deps[d]) || null;
  const name = rel || path.basename(projectDir);
  let role = 'other';
  if (bk && (!fw || BACKEND_NAMES.test(path.basename(dir)))) role = 'backend';
  else if (fw) role = 'frontend';
  else if (BACKEND_NAMES.test(path.basename(dir))) role = 'backend';
  if (deps.electron && !fw) role = 'app';
  const lock = lockOf(dir) || rootLock;
  const pm = lock ? lock.pm : 'npm';
  const dev = DEV_SCRIPTS.find((s) => scripts[s]) || null;
  const prod = (scripts.start && dev !== 'start') ? 'start' : (PROD_SCRIPTS.find((s) => scripts[s] && s !== dev) || null);
  const build = scripts.build ? 'build' : null;
  // port: the dev script, .env, vite config, the backend's own code, the framework default
  let port = null, portFrom = '';
  const sp = scriptPort(dev && scripts[dev]);
  if (sp) { port = sp; portFrom = `script "${dev}"`; }
  if (!port) { const e = envPort(dir); if (e) { port = e.port; portFrom = e.from; } }
  if (!port && deps.vite) { const v = vitePort(dir); if (v) { port = v; portFrom = 'vite.config'; } }
  if (!port && role === 'backend') { const c = codePort(dir); if (c) { port = c.port; portFrom = c.from; } }
  if (!port && (fw || bk)) { port = (fw || bk)[2]; portFrom = `${(fw || bk)[1]} default`; }
  // a root script that starts the other parts itself (concurrently, npm-run-all, --prefix, turbo…): its own button, never in "Start all"
  const orchestrator = !rel && /concurrently|npm-run-all|\brun-p\b|--prefix\s|\bturbo\b|\blerna\b|\bnx\s|\bcd\s+\S+\s*&&/.test(devCmd);
  if (orchestrator) role = 'other';
  return {
    rel, name, dir, kind: 'node', role, orchestrator, inStartAll: !orchestrator, framework: fw ? fw[1] : (bk ? bk[1] : (deps.electron ? 'Electron' : 'Node.js')),
    pm, pmAll: lock ? lock.all : [], installed: exists(path.join(dir, 'node_modules')) || (rel && exists(path.join(projectDir, 'node_modules')) && !!pkg.name && !!rootLock),
    scripts, dev, prod, build, port, portFrom,
    commands: {
      dev: dev ? runCmd(pm, dev) : null, prod: prod ? runCmd(pm, prod) : null, build: build ? runCmd(pm, build) : null, install: installCmd(pm),
    },
  };
}

function pythonPart(projectDir, rel) {
  const dir = path.join(projectDir, rel);
  const has = (f) => exists(path.join(dir, f));
  const entry = has('manage.py') ? 'python manage.py runserver' : ['app.py', 'main.py', 'server.py', 'run.py'].filter(has).map((f) => `python ${f}`)[0] || null;
  const req = has('requirements.txt') ? 'pip install -r requirements.txt' : (has('pyproject.toml') ? 'pip install -e .' : null);
  const reqText = readText(path.join(dir, 'requirements.txt')) || '';
  const port = has('manage.py') ? 8000 : (/flask/i.test(reqText) ? 5000 : (/fastapi|uvicorn/i.test(reqText) ? 8000 : null));
  return { rel, name: rel || path.basename(projectDir), dir, kind: 'python', role: 'backend', framework: has('manage.py') ? 'Django' : (/fastapi/i.test(reqText) ? 'FastAPI' : (/flask/i.test(reqText) ? 'Flask' : 'Python')),
    pm: 'pip', pmAll: [], installed: true, scripts: {}, dev: entry ? 'run' : null, prod: null, build: null, port, portFrom: port ? 'framework default' : '',
    commands: { dev: entry, prod: null, build: null, install: req } };
}

function dockerPart(projectDir) {
  const f = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'].find((x) => exists(path.join(projectDir, x)));
  if (!f) return null;
  return { rel: '#docker', name: 'Docker', dir: projectDir, kind: 'docker', role: 'docker', framework: 'Docker Compose', pm: 'docker', pmAll: [], installed: true,
    scripts: {}, dev: 'up', prod: null, build: 'build', port: null, portFrom: '', inStartAll: false,
    commands: { dev: 'docker compose up', prod: null, build: 'docker compose build', install: null, down: 'docker compose down' } };
}

const isPython = (dir) => ['requirements.txt', 'pyproject.toml', 'manage.py'].some((f) => exists(path.join(dir, f)));

function scanProject(projectDir) {
  const parts = [];
  const rootPkg = readJson(path.join(projectDir, 'package.json'));
  const rootLock = lockOf(projectDir);
  const seen = new Set();
  const consider = (rel) => {
    const dir = path.join(projectDir, rel);
    if (seen.has(dir.toLowerCase())) return;
    const pkg = readJson(path.join(dir, 'package.json'));
    if (pkg) {
      // a root package.json that only holds workspaces / tooling, with no scripts: not a runnable part
      if (rel || Object.keys(pkg.scripts || {}).length) { parts.push(nodePart(projectDir, rel, pkg, rel ? null : rootLock)); seen.add(dir.toLowerCase()); }
      return;
    }
    if (isPython(dir)) { parts.push(pythonPart(projectDir, rel)); seen.add(dir.toLowerCase()); }
  };
  consider('');
  const kids = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')).map((e) => e.name); } catch (_) { return []; } };
  for (const a of kids(projectDir)) {
    consider(a);
    if (!exists(path.join(projectDir, a, 'package.json'))) for (const b of kids(path.join(projectDir, a))) consider(a + '/' + b);   // apps/web, packages/api
  }
  if (rootPkg && rootPkg.workspaces) for (const p of parts) if (p.rel && !p.installed && exists(path.join(projectDir, 'node_modules'))) p.installed = true;
  const dk = dockerPart(projectDir);
  if (dk) parts.push(dk);
  const order = { backend: 0, app: 1, frontend: 2, other: 3, docker: 4 };
  parts.sort((a, b) => (order[a.role] - order[b.role]) || a.name.localeCompare(b.name));
  return { path: projectDir, name: path.basename(projectDir), parts, git: exists(path.join(projectDir, '.git')), monorepo: !!(rootPkg && rootPkg.workspaces), scannedAt: Date.now() };
}

// projects inside a folder (e.g. D:\): folders with a package.json / Python / git at their root or one level down
function findProjects(base, max = 300) {
  const out = [];
  let ents; try { ents = fs.readdirSync(base, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of ents) {
    if (!e.isDirectory() || SKIP_DIRS.has(e.name) || /^(\$|System Volume|Windows|Program Files|ProgramData|Recovery|PerfLogs)/i.test(e.name) || e.name.startsWith('.')) continue;
    const dir = path.join(base, e.name);
    let hit = exists(path.join(dir, 'package.json')) || isPython(dir);
    let sub = 0;
    if (!hit) for (const k of (() => { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return []; } })()) {
      if (k.isDirectory() && !SKIP_DIRS.has(k.name) && exists(path.join(dir, k.name, 'package.json'))) sub++;
    }
    if (hit || sub) {
      let t = 0; try { t = fs.statSync(dir).mtimeMs; } catch (_) {}
      out.push({ path: dir, name: e.name, parts: hit ? 1 : sub, git: exists(path.join(dir, '.git')), modified: t });
    }
    if (out.length >= max) break;
  }
  return out.sort((a, b) => b.modified - a.modified);
}

module.exports = { scanProject, findProjects, runCmd, installCmd, lockOf };
