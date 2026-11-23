const I = require('../lib/images'); const path = require('path');
for (const p of [path.join(__dirname, 'tmp', 'bp'), 'D:/magical', 'D:/hosting']) {
  const t0 = Date.now(); const r = I.scan(p);
  console.log(`\n## ${p}  (${Date.now() - t0} ms) images ${r.images}, code files ${r.codeFiles}, used ${r.used}, UNUSED ${r.unused.length} (${(r.bytesUnused / 1048576).toFixed(1)} MB), maybe ${r.maybe.length}, special ${r.special.length}, dup groups ${r.duplicates.length}, big ${r.big.length}, missing ${r.missing.length}`);
  console.log('  unused e.g.:', r.unused.slice(0, 5).map((x) => x.rel).join(' | '));
  console.log('  maybe e.g.:', r.maybe.slice(0, 3).map((x) => x.rel + ' <- ' + x.why).join(' | '));
  console.log('  special e.g.:', r.special.slice(0, 4).map((x) => x.rel).join(' | '));
  console.log('  missing e.g.:', r.missing.slice(0, 3).map((x) => x.ref + ' in ' + x.file).join(' | '));
}
