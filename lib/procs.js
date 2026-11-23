'use strict';
// Runs project commands (dev servers, builds, installs, custom buttons) with live logs, ready detection,
// crash detection, optional auto-restart, whole-tree kill and CPU / memory per part.
const { spawn } = require('child_process');
const EventEmitter = require('events');
const os = require('os');
const { BIN, run } = require('./util');
const ports = require('./ports');

const MAX_LINES = 5000;
const URL_RX = /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]|(?:\d{1,3}\.){3}\d{1,3}):(\d{2,5})[^\s'"<>)]*)/i;
const PORT_RX = /(?:listening|running|started|server|ready|available)[^\n]{0,40}?\bport\b\D{0,6}(\d{2,5})/i;
const ERR_RX = /\b(error|failed|exception|cannot find|not found|unhandled|ERR!|EADDRINUSE|ECONNREFUSED|traceback)\b/i;
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

class Procs extends EventEmitter {
  constructor() {
    super();
    this.items = new Map();        // key -> { key, kind: 'server'|'task', status, pid, child, lines, ... }
    this.pending = new Map();      // key -> lines waiting to be sent to the window
    this.flushTimer = setInterval(() => this.flush(), 120);
    this.cpuPrev = new Map();
    this.autoRestart = false;
  }

  state(key) {
    const it = this.items.get(key);
    if (!it) return null;
    const { child, lines, timers, ...rest } = it;   // eslint-disable-line no-unused-vars
    return rest;
  }
  states() { return [...this.items.keys()].map((k) => this.state(k)); }
  logs(key) { const it = this.items.get(key); return it ? it.lines.slice() : []; }
  clearLogs(key) { const it = this.items.get(key); if (it) { it.lines = []; it.errors = 0; this.emitState(it); } }
  running(key) { const it = this.items.get(key); return !!it && ['starting', 'running'].includes(it.status); }

  // kind 'server' stays up (dev / start), kind 'task' ends (build, install, custom)
  start(key, opt) {
    const old = this.items.get(key);
    if (old && ['starting', 'running'].includes(old.status)) return this.state(key);
    const it = {
      key, kind: opt.kind || 'server', label: opt.label || '', cmd: opt.cmd, cwd: opt.cwd, project: opt.project, part: opt.part, action: opt.action || 'dev',
      status: 'starting', pid: null, code: null, startedAt: Date.now(), endedAt: null, port: opt.port || null, url: opt.port ? `http://localhost:${opt.port}` : null,
      urlFromLogs: false, errors: 0, lastError: '', restarts: old ? old.restarts || 0 : 0, restartTimes: old ? old.restartTimes || [] : [], manualStop: false,
      cpu: 0, mem: 0, lines: old && opt.keepLogs ? old.lines : [], timers: [], buf: { out: '', err: '' }, env: opt.env || {},
    };
    this.items.set(key, it);
    this.line(it, `▶ ${opt.cmd}`, 'sys');
    this.line(it, `  in ${opt.cwd}`, 'sys');
    let child;
    try {
      child = spawn(BIN.cmd, ['/d', '/s', '/c', `"${opt.cmd}"`], {
        cwd: opt.cwd, windowsHide: true, windowsVerbatimArguments: true,
        env: { ...process.env, FORCE_COLOR: '1', BROWSER: 'none', CI: '', ...it.env },
      });
    } catch (e) {
      it.status = 'crashed'; it.lastError = String(e.message || e); this.line(it, '✖ ' + it.lastError, 'err'); this.emitState(it); return this.state(key);
    }
    it.child = child; it.pid = child.pid;
    child.stdout.on('data', (d) => this.data(it, d, 'out'));
    child.stderr.on('data', (d) => this.data(it, d, 'err'));
    child.on('error', (e) => { it.lastError = String(e.message || e); this.line(it, '✖ ' + it.lastError, 'err'); });
    child.on('close', (code) => this.closed(it, code));
    if (it.kind === 'server') this.watchReady(it);
    else { it.status = 'running'; }
    this.emitState(it);
    return this.state(key);
  }

  data(it, chunk, stream) {
    const text = it.buf[stream] + chunk.toString('utf8');
    const parts = text.split(/\r?\n/);
    it.buf[stream] = parts.pop();
    for (let p of parts) {
      const cr = p.lastIndexOf('\r'); if (cr >= 0) p = p.slice(cr + 1);   // progress bars redraw with \r: keep the last state
      this.line(it, p, stream);
    }
    if (it.buf[stream].length > 4000) { this.line(it, it.buf[stream], stream); it.buf[stream] = ''; }
  }

  line(it, raw, stream) {
    const plain = raw.replace(ANSI, '');
    const isErr = stream === 'err' && ERR_RX.test(plain) || stream === 'out' && /\b(ERR!|error\b|Error:|failed to compile|EADDRINUSE)/i.test(plain) && !/0 errors?|no errors?|errors?: 0/i.test(plain);
    const entry = { t: Date.now(), s: isErr ? 'err' : stream, text: raw };
    it.lines.push(entry);
    if (it.lines.length > MAX_LINES) it.lines.splice(0, it.lines.length - MAX_LINES);
    if (isErr) { it.errors++; it.lastError = plain.trim().slice(0, 300); }
    if (stream !== 'sys' && it.kind === 'server') {
      const u = URL_RX.exec(plain);
      if (u && !it.urlFromLogs && !/\/\/(?:\d{1,3}\.){3}\d{1,3}:/.test(u[1].replace('127.0.0.1', '')) ) {
        it.url = u[1].replace('0.0.0.0', 'localhost').replace(/\/+$/, '/'); it.port = +u[2]; it.urlFromLogs = true; this.emitState(it);
      } else if (!it.urlFromLogs) {
        const p = PORT_RX.exec(plain);
        if (p) { it.port = +p[1]; it.url = `http://localhost:${it.port}`; it.urlFromLogs = true; this.emitState(it); }
      }
      if (/EADDRINUSE|already in use|address in use/i.test(plain)) { it.portBusy = true; this.emitState(it); }
    }
    let q = this.pending.get(it.key); if (!q) { q = []; this.pending.set(it.key, q); }
    q.push(entry);
  }

  flush() {
    if (!this.pending.size) return;
    const batch = {};
    for (const [k, q] of this.pending) batch[k] = q;
    this.pending.clear();
    this.emit('logs', batch);
  }

  // "running" = its port answers (or, without a port, still alive after a few seconds)
  watchReady(it) {
    const t0 = Date.now();
    const tick = async () => {
      if (it.status !== 'starting') return;
      if (it.port && await ports.isOpen(it.port)) { this.ready(it); return; }
      if (!it.port && Date.now() - t0 > 4000) { this.ready(it); return; }
      if (Date.now() - t0 > 180000) { this.ready(it, true); return; }   // slow first compile: show running anyway after 3 min
      it.timers.push(setTimeout(tick, 600));
    };
    it.timers.push(setTimeout(tick, 800));
  }
  ready(it, unsure) {
    if (it.status !== 'starting') return;
    it.status = 'running'; it.readyAt = Date.now(); it.unsure = !!unsure;
    this.line(it, `✔ ready${it.url ? ' at ' + it.url : ''} (${((it.readyAt - it.startedAt) / 1000).toFixed(1)} s)`, 'sys');
    this.emitState(it);
  }
  async waitReady(key, ms = 120000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const it = this.items.get(key);
      if (!it || it.status === 'running') return true;
      if (['crashed', 'stopped', 'exited', 'failed', 'done'].includes(it.status)) return false;
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  }

  closed(it, code) {
    for (const t of it.timers) clearTimeout(t);
    it.timers = [];
    for (const s of ['out', 'err']) if (it.buf[s]) { this.line(it, it.buf[s], s); it.buf[s] = ''; }
    it.code = code; it.endedAt = Date.now(); it.child = null;
    if (it.kind === 'task') {
      it.status = code === 0 ? 'done' : 'failed';
      this.line(it, code === 0 ? `✔ finished in ${((it.endedAt - it.startedAt) / 1000).toFixed(1)} s` : `✖ failed (exit code ${code})`, code === 0 ? 'sys' : 'err');
      this.emitState(it);
      this.emit(code === 0 ? 'task-done' : 'task-failed', this.state(it.key));
      return;
    }
    if (it.manualStop) { it.status = 'stopped'; this.line(it, '■ stopped', 'sys'); this.emitState(it); return; }
    it.status = 'crashed';
    this.line(it, `✖ stopped by itself (exit code ${code})`, 'err');
    this.emitState(it);
    this.emit('crash', this.state(it.key));
    if (this.autoRestart) {
      const now = Date.now();
      it.restartTimes = (it.restartTimes || []).filter((t) => now - t < 60000);
      if (it.restartTimes.length < 3) {
        it.restartTimes.push(now); it.restarts = (it.restarts || 0) + 1;
        this.line(it, '↻ restarting by itself in 2 s…', 'sys');
        setTimeout(() => { if (this.items.get(it.key) === it && it.status === 'crashed') this.start(it.key, { ...it, keepLogs: true, kind: 'server' }); }, 2000);
      } else this.line(it, '↻ not restarting again: it crashed 3 times in a minute', 'err');
    }
  }

  async stop(key) {
    const it = this.items.get(key);
    if (!it || !it.child && !['starting', 'running'].includes(it.status)) return true;
    it.manualStop = true;
    for (const t of it.timers) clearTimeout(t);
    if (it.pid) await ports.killPid(it.pid);
    const t0 = Date.now();
    while (it.child && Date.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 150));
    if (it.child) { it.child = null; it.status = 'stopped'; this.emitState(it); }
    return true;
  }
  async stopAll(filter = () => true) {
    await Promise.all([...this.items.values()].filter((it) => (it.child || ['starting', 'running'].includes(it.status)) && filter(it)).map((it) => this.stop(it.key)));
  }
  anyRunning() { return [...this.items.values()].some((it) => it.child); }

  emitState(it) { this.emit('state', this.state(it.key)); }

  // CPU % and memory (MB) of each running item's whole process tree
  async metrics() {
    const live = [...this.items.values()].filter((it) => it.child && it.pid);
    if (!live.length) return;
    const r = await run(BIN.powershell, ['-NoProfile', '-NonInteractive', '-Command',
      'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId),$($_.ParentProcessId),$($_.WorkingSetSize),$($_.KernelModeTime),$($_.UserModeTime)" }'], { timeout: 20000 });
    if (!r.ok) return;
    const kids = new Map(), info = new Map();
    for (const l of r.out.split(/\r?\n/)) {
      const [pid, ppid, ws, k, u] = l.split(',').map(Number);
      if (!pid) continue;
      info.set(pid, { ws: ws || 0, t: (k || 0) + (u || 0) });
      if (!kids.has(ppid)) kids.set(ppid, []);
      kids.get(ppid).push(pid);
    }
    const now = Date.now(), cores = os.cpus().length || 1;
    for (const it of live) {
      let mem = 0, t = 0;
      const stack = [it.pid], seen = new Set();
      while (stack.length) { const p = stack.pop(); if (seen.has(p)) continue; seen.add(p); const i = info.get(p); if (i) { mem += i.ws; t += i.t; } for (const c of kids.get(p) || []) stack.push(c); }
      const prev = this.cpuPrev.get(it.key);
      it.mem = Math.round(mem / 1048576);
      it.cpu = prev ? Math.max(0, Math.min(100, Math.round(((t - prev.t) / 1e4) / (now - prev.at) / cores * 100))) : 0;   // 100-ns units -> ms
      this.cpuPrev.set(it.key, { t, at: now });
      this.emitState(it);
    }
  }

  dispose() { clearInterval(this.flushTimer); }
}

module.exports = { Procs };
