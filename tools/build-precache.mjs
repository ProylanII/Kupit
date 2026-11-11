// Writes precache.json: every file the game needs offline, plus a version hash of their contents, and stamps
// that version into sw.js (a changed sw.js is how browsers notice an update). Run `npm run build` before
// deploying, after any change.
import { readdirSync, statSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, ok) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, ok) : ok(n) ? [p] : [];
  });
}

export function precacheList() {
  const files = [
    'index.html', 'css/style.css', 'manifest.webmanifest',
    ...walk(join(root, 'src'), (n) => /\.(js|json)$/.test(n)).map((p) => relative(root, p)),
    ...walk(join(root, 'icons'), (n) => n.endsWith('.png')).map((p) => relative(root, p)),
    ...walk(join(root, 'assets'), (n) => /\.(png|json)$/.test(n)).map((p) => relative(root, p)),
  ].map((f) => f.split(sep).join('/')).sort();
  // the version changes whenever any file's contents change, not just when files are added
  const h = createHash('sha1');
  for (const f of files) { h.update(f); h.update(readFileSync(join(root, f))); }
  return { version: h.digest('hex').slice(0, 8), files };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const list = precacheList();
  writeFileSync(join(root, 'precache.json'), JSON.stringify(list, null, 2) + '\n');
  const swPath = join(root, 'sw.js');
  writeFileSync(swPath, readFileSync(swPath, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${list.version}';`));
  console.log(`precache.json: ${list.files.length} files (v${list.version}), sw.js stamped`);
}
