'use strict';
// Unused images: image FILES inside the project that no code mentions. Nothing outside the project folder is looked at
// (no cloud, no server, no database). Removing = moving to DevPilot's Trash, with one-click restore.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { walk, readText, readJson, writeAtomic, exists, SKIP_DIRS } = require('./util');

const IMG = /\.(png|jpe?g|gif|svg|webp|ico|avif|bmp|tiff?)$/i;
const IMG_ALT = 'png|jpe?g|gif|svg|webp|ico|avif|bmp|tiff?';
const CODE = /\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte|astro|html?|css|scss|sass|less|styl|json|webmanifest|md|mdx|ejs|hbs|handlebars|pug|php|py|rb|go|java|kt|swift|dart|xml|ya?ml|toml|txt|env|liquid|twig)$/i;
const UPLOAD_DIRS = /(^|\/)(uploads?|storage|user[-_]?uploads?|media[\\/]uploads|attachments?)(\/|$)/i;
const SPECIAL = /^(favicon|apple-touch-icon|android-chrome|mstile|safari-pinned-tab|maskable|icon-\d+|icons?-\d+x\d+|logo\d{2,3}|og[-_]?image|twitter[-_]?image|opengraph|splash|launch|ms-icon|browserconfig)/i;

const norm = (s) => s.replace(/\\/g, '/');
const decode = (s) => { try { return decodeURIComponent(s); } catch (_) { return s; } };

function scan(projectDir, opts = {}) {
  const skipRel = (opts.exclude || []).map(norm);
  const images = [], code = [];
  walk(projectDir, (full, rel) => {
    rel = norm(rel);
    if (IMG.test(rel)) {
      if (UPLOAD_DIRS.test(rel) && !opts.includeUploads) return;
      let size = 0; try { size = fs.statSync(full).size; } catch (_) {}
      images.push({ full, rel, name: path.basename(rel), size });
    }
    if (CODE.test(rel) || /(^|\/)\.env/.test(rel)) code.push(full);
  }, { skipRel, maxFiles: 300000 });

  // every image name mentioned anywhere in the code (with and without folders), + dynamic patterns
  const mentioned = new Set();     // lower-case base names
  const mentionedPaths = new Set();
  const patterns = [];             // { dir, prefix, suffix } from `flag-${x}.png`, 'img/' + n + '.jpg', import.meta.glob(...)
  const missing = [];
  const nameRx = new RegExp(`[\\w@%.~+-]+\\.(?:${IMG_ALT})(?![\\w])`, 'gi');
  const tplRx = new RegExp(`([\\w@./~-]*)\\$\\{[^}]{1,80}\\}([\\w@.-]*\\.(?:${IMG_ALT}))`, 'gi');
  const catRx = new RegExp(`["'\`]([\\w@./~-]*)["'\`]\\s*\\+\\s*[^+;\\n]{1,60}?\\+\\s*["'\`]([\\w@.-]*\\.(?:${IMG_ALT}))["'\`]`, 'gi');
  const globRx = /(?:import\.meta\.glob(?:Eager)?|require\.context)\(\s*["'`]([^"'`]+)["'`]/g;
  const pathRx = new RegExp(`["'\`(]((?:\\.{1,2}/|/)[^"'\`()\\s$]+\\.(?:${IMG_ALT}))["'\`)?#]`, 'gi');
  for (const f of code) {
    const t = readText(f, 3 * 1024 * 1024);
    if (!t) continue;
    let m;
    nameRx.lastIndex = 0;
    while ((m = nameRx.exec(t))) mentioned.add(decode(m[0]).toLowerCase());
    tplRx.lastIndex = 0;
    while ((m = tplRx.exec(t))) patterns.push({ prefix: path.posix.basename(m[1] + 'x').slice(0, -1).toLowerCase(), dir: path.posix.dirname(m[1] + 'x').toLowerCase(), suffix: m[2].toLowerCase(), from: f });
    catRx.lastIndex = 0;
    while ((m = catRx.exec(t))) patterns.push({ prefix: path.posix.basename(m[1] + 'x').slice(0, -1).toLowerCase(), dir: path.posix.dirname(m[1] + 'x').toLowerCase(), suffix: m[2].toLowerCase(), from: f });
    globRx.lastIndex = 0;
    while ((m = globRx.exec(t))) patterns.push({ glob: norm(path.resolve(path.dirname(f), m[1].replace(/\*.*$/, ''))).toLowerCase(), from: f });
    // local paths that point to a file which does not exist (a broken image on the page)
    pathRx.lastIndex = 0;
    while ((m = pathRx.exec(t))) {
      const ref = decode(m[1].split('?')[0]);
      if (/^\/\//.test(ref)) continue;
      // "/img/x.png" = from the public folder; "./img/x.png" = next to the code file (import) OR, in a page, from the public folder
      const cands = ref.startsWith('/') ? publicRoots(projectDir, f).map((r) => path.join(r, ref))
        : [path.resolve(path.dirname(f), ref), ...publicRoots(projectDir, f).map((r) => path.join(r, ref.replace(/^(\.\.?\/)+/, '')))];
      mentionedPaths.add(norm(ref).toLowerCase());
      if (!cands.some(exists)) missing.push({ ref, file: norm(path.relative(projectDir, f)) });
    }
  }

  // sort each image into a group
  const out = { unused: [], maybe: [], special: [], used: 0, images: images.length, codeFiles: code.length };
  for (const im of images) {
    const low = im.name.toLowerCase();
    const relLow = im.rel.toLowerCase();
    if (mentioned.has(low) || mentioned.has(encodeURI(im.name).toLowerCase())) { out.used++; continue; }
    if (SPECIAL.test(im.name) && /(^|\/)(public|static|assets?)?\/?[^/]+$/.test(im.rel)) { out.special.push({ ...im, why: 'browser / app icon' }); continue; }
    // `flag-${code}.png` -> prefix "flag-", suffix ".png": flag-fr.png matches. A bare `${x}.png` (no prefix) matches any .png in that folder.
    const pat = patterns.find((p) => {
      if (p.glob) return norm(im.full).toLowerCase().startsWith(p.glob);
      if (!low.startsWith(p.prefix) || !low.endsWith(p.suffix)) return false;
      if (p.prefix.length + p.suffix.length > 4) return true;
      const dir = p.dir.replace(/^\.?\/?/, '').replace(/^(\.\.\/)+/, '');
      return !!dir && dir !== '.' && relLow.includes(dir + '/');
    });
    if (pat) { out.maybe.push({ ...im, why: pat.glob ? 'loaded by a folder pattern (glob)' : `name built in code: ${pat.prefix || '…'}*${pat.suffix}`, from: norm(path.relative(projectDir, pat.from)) }); continue; }
    out.unused.push({ ...im, why: 'not mentioned anywhere in the code' });
  }
  // duplicates (same bytes, different files) and big images, across all images
  const byHash = new Map();
  for (const im of images) {
    if (im.size > 30 * 1024 * 1024) continue;
    try { const h = crypto.createHash('sha1').update(fs.readFileSync(im.full)).digest('hex'); if (!byHash.has(h)) byHash.set(h, []); byHash.get(h).push(im); } catch (_) {}
  }
  out.duplicates = [...byHash.values()].filter((g) => g.length > 1).map((g) => ({ size: g[0].size, files: g.map((x) => ({ rel: x.rel, full: x.full })) }));
  out.big = images.filter((im) => im.size >= (opts.bigKB || 500) * 1024 && !/\.svg$/i.test(im.name)).sort((a, b) => b.size - a.size).map((im) => ({ ...im }));
  const seenMiss = new Set();
  out.missing = missing.filter((x) => { const k = x.ref + '|' + x.file; if (seenMiss.has(k)) return false; seenMiss.add(k); return true; }).slice(0, 500);
  out.bytesUnused = out.unused.reduce((n, x) => n + x.size, 0);
  return out;
}

// where "/img/logo.png" is served from: the public / static folder of the part the file belongs to (and the project root)
function publicRoots(projectDir, file) {
  const roots = [];
  let d = path.dirname(file);
  while (d.length >= projectDir.length) {
    if (exists(path.join(d, 'package.json')) || d === projectDir) { for (const p of ['public', 'static', 'assets', 'src/assets', 'src', 'www', '']) roots.push(path.join(d, p)); if (d !== projectDir) break; }
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  roots.push(path.join(projectDir, 'public'));
  return roots;
}

// ---- Trash: removed files are moved here, never deleted
function trashDir(dataDir, projectId) { return path.join(dataDir, 'trash', projectId); }

function moveToTrash(dataDir, projectId, projectDir, files, label = 'unused images') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(trashDir(dataDir, projectId), stamp);
  const moved = [];
  for (const full of files) {
    const rel = norm(path.relative(projectDir, full));
    if (rel.startsWith('..') || path.isAbsolute(rel)) continue;          // never anything outside the project
    const dest = path.join(base, 'files', rel);
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try { fs.renameSync(full, dest); } catch (e) { if (e.code !== 'EXDEV') throw e; fs.copyFileSync(full, dest); fs.unlinkSync(full); }
      moved.push(rel);
    } catch (_) { /* locked file: left in place */ }
  }
  if (moved.length) writeAtomic(path.join(base, 'batch.json'), JSON.stringify({ at: Date.now(), label, project: projectDir, files: moved }, null, 1));
  return { batch: stamp, moved };
}

function batches(dataDir, projectId) {
  const d = trashDir(dataDir, projectId);
  let ents = []; try { ents = fs.readdirSync(d); } catch (_) {}
  return ents.map((b) => { const j = readJson(path.join(d, b, 'batch.json')); return j ? { batch: b, ...j, count: j.files.length } : null; }).filter(Boolean).sort((a, b) => b.at - a.at);
}

function restore(dataDir, projectId, batch) {
  const base = path.join(trashDir(dataDir, projectId), batch);
  const j = readJson(path.join(base, 'batch.json'));
  if (!j) throw new Error('This Trash batch is gone.');
  const restored = [], skipped = [];
  for (const rel of j.files) {
    const src = path.join(base, 'files', rel), dest = path.join(j.project, rel);
    if (!exists(src)) continue;
    if (exists(dest)) { skipped.push(rel); continue; }                    // a new file with the same name: never overwritten
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try { fs.renameSync(src, dest); } catch (e) { if (e.code !== 'EXDEV') throw e; fs.copyFileSync(src, dest); fs.unlinkSync(src); }
    restored.push(rel);
  }
  if (!skipped.length) fs.rmSync(base, { recursive: true, force: true });
  return { restored, skipped };
}

function emptyBatch(dataDir, projectId, batch) { fs.rmSync(path.join(trashDir(dataDir, projectId), batch), { recursive: true, force: true }); }

module.exports = { scan, moveToTrash, batches, restore, emptyBatch, SKIP_DIRS };
