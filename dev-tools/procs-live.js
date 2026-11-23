const { Procs } = require('../lib/procs'); const ports = require('../lib/ports'); const path = require('path');
(async () => {
  const P = new Procs(); const cwd = path.join(__dirname, 'tmp'); const ev = [];
  P.on('crash', (s) => ev.push('crash:' + s.key)); P.on('state', (s) => {});
  P.start('a', { cmd: 'node srv.js', cwd, port: 47123 });
  const ok = await P.waitReady('a', 15000); const s = P.state('a');
  console.log('ready:', ok, s.status, s.url, 'pid', s.pid);
  console.log('port open:', await ports.isOpen(47123), '| who uses:', (await ports.whoUses(47123)).map((x) => x.name + ' ' + x.pid).join(','));
  await P.metrics(); console.log('metrics mem MB:', P.state('a').mem);
  await P.stop('a'); await new Promise((r) => setTimeout(r, 500));
  console.log('after stop:', P.state('a').status, '| port open:', await ports.isOpen(47123));
  P.start('b', { cmd: 'node srv.js', cwd, port: 47124, env: { PORT: '47124', CRASH: '1' } });
  await new Promise((r) => setTimeout(r, 4000));
  console.log('crash detected:', P.state('b').status, ev, '| last error:', P.state('b').lastError);
  console.log('log lines:', P.logs('a').map((l) => l.text.replace(/\x1b\[[0-9;]*m/g, '')).join(' | '));
  P.dispose(); process.exit(0);
})();
