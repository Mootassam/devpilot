'use strict';
// Small shared helpers (Windows-first, no dependencies).
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const SYS = process.env.SystemRoot || 'C:\\Windows';
const BIN = {
  cmd: process.env.ComSpec || path.join(SYS, 'System32', 'cmd.exe'),
  taskkill: path.join(SYS, 'System32', 'taskkill.exe'),
  netstat: path.join(SYS, 'System32', 'NETSTAT.EXE'),
  tasklist: path.join(SYS, 'System32', 'tasklist.exe'),
  powershell: path.join(SYS, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
};

// folders never scanned (dependencies, build output, caches)
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.output', 'out', 'coverage', '.cache',
  '.turbo', '.vercel', '.idea', '.vscode', 'vendor', '__pycache__', '.venv', 'venv', 'env', '.svelte-kit', 'bower_components', '.parcel-cache', 'tmp', '.tmp']);

function run(file, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: opts.timeout || 30000, cwd: opts.cwd, env: opts.env, encoding: 'utf8' },
      (err, stdout, stderr) => resolve({ ok: !err, code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: stdout || '', err: stderr || (err && !stdout ? String(err.message) : '') }));
  });
}

function readText(p, max = 2 * 1024 * 1024) {
  try {
    const st = fs.statSync(p);
    if (!st.isFile() || st.size > max) return null;
    return fs.readFileSync(p, 'utf8');
  } catch (_) { return null; }
}

function readJson(p) {
  const t = readText(p);
  if (t == null) return null;
  try { return JSON.parse(t.replace(/^\uFEFF/, '')); } catch (_) { return null; }
}

const exists = (p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch (_) { return false; } };

// atomic write: a crash never leaves half a file
function writeAtomic(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, p);
}

// walk a folder, skipping SKIP_DIRS and extra names; calls onFile(fullPath, relPath, dirent)
function walk(root, onFile, opts = {}) {
  const skip = opts.skip || SKIP_DIRS;
  const extra = new Set((opts.skipRel || []).map((s) => s.replace(/\\/g, '/').toLowerCase()));
  const maxFiles = opts.maxFiles || 200000;
  let count = 0;
  const stack = [''];
  while (stack.length) {
    const rel = stack.pop();
    let ents;
    try { ents = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch (_) { continue; }
    for (const e of ents) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) {
        if (skip.has(e.name) || e.name.startsWith('.') && e.name !== '.well-known' || extra.has(r.toLowerCase())) continue;
        stack.push(r);
      } else if (e.isFile()) {
        if (++count > maxFiles) return;
        onFile(path.join(root, r), r, e);
      }
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

module.exports = { BIN, SKIP_DIRS, run, readText, readJson, exists, isDir, writeAtomic, walk, sleep, id };
