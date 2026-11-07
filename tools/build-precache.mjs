// Writes precache.json: every file the game needs offline. Run with `npm run build` after adding files.
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
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
  const version = createHash('sha1').update(files.join('\n')).digest('hex').slice(0, 8);
  return { version, files };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const list = precacheList();
  writeFileSync(join(root, 'precache.json'), JSON.stringify(list, null, 2) + '\n');
  console.log(`precache.json: ${list.files.length} files (v${list.version})`);
}
