const { scanProject, findProjects } = require('../lib/scan');
for (const p of ['D:/backpack', 'D:/magical', 'D:/chtruth', 'D:/hosting', 'D:/storycast', 'D:/polychat-landing']) {
  const r = scanProject(p); console.log('\n##', p, r.git ? '(git)' : '');
  for (const x of r.parts) console.log(' ', x.role.padEnd(8), (x.rel || '(root)').padEnd(10), x.framework.padEnd(12), x.pm.padEnd(5), 'installed:', String(x.installed).padEnd(5), 'port:', x.port, '(' + x.portFrom + ')', '| dev:', x.commands.dev, '| build:', x.commands.build);
}
const f = findProjects('D:/'); console.log('\nfound projects in D:', f.length, f.slice(0, 8).map((x) => x.name).join(', '));
