'use strict';
// Ports in use on this PC (netstat), the program behind each one (tasklist), kill, and "wait until it answers".
const net = require('net');
const { BIN, run } = require('./util');

async function processNames() {
  const r = await run(BIN.tasklist, ['/FO', 'CSV', '/NH'], { timeout: 15000 });
  const map = new Map();
  for (const line of r.out.split(/\r?\n/)) {
    const m = /^"([^"]+)","(\d+)"/.exec(line);
    if (m) map.set(+m[2], m[1]);
  }
  return map;
}

// [{ port, pid, address, name }] for every listening TCP port
async function listening() {
  const [r, names] = await Promise.all([run(BIN.netstat, ['-ano', '-p', 'TCP'], { timeout: 15000 }), processNames()]);
  const r6 = await run(BIN.netstat, ['-ano', '-p', 'TCPv6'], { timeout: 15000 });
  const seen = new Map();
  for (const line of (r.out + '\n' + r6.out).split(/\r?\n/)) {
    const m = /^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)/i.exec(line);
    if (!m) continue;
    const port = +m[2], pid = +m[3];
    if (!pid) continue;
    const key = port + ':' + pid;
    if (!seen.has(key)) seen.set(key, { port, pid, address: m[1].replace(/^\[|\]$/g, ''), name: names.get(pid) || 'unknown' });
  }
  return [...seen.values()].sort((a, b) => a.port - b.port);
}

async function whoUses(port) {
  return (await listening()).filter((x) => x.port === +port);
}

async function killPid(pid) {
  const r = await run(BIN.taskkill, ['/PID', String(pid), '/T', '/F'], { timeout: 20000 });
  return { ok: r.ok || /not found|no running instance/i.test(r.err + r.out), message: (r.out + r.err).trim() };
}

function canConnect(port, host, ms = 700) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(ms, () => done(false));
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
  });
}
async function isOpen(port) {
  if (!port) return false;
  return (await canConnect(port, '127.0.0.1')) || (await canConnect(port, '::1'));
}

module.exports = { listening, whoUses, killPid, isOpen, processNames };
