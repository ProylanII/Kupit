// One command for the whole Blender batch: build the characters, render every frame, pack the sheet.
//   npm run art:blender            (BLENDER=<path to blender.exe> if it is not on PATH or in a usual folder)
//   node tools/blender/run.mjs --kinds mama,jun --skip-build
// Then: npm run build (offline list) and npm test (art lock).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const kinds = args.includes('--kinds') ? ['--kinds', args[args.indexOf('--kinds') + 1]] : [];

function findBlender() {
  if (process.env.BLENDER && existsSync(process.env.BLENDER)) return process.env.BLENDER;
  const dirs = [
    join(process.env.LOCALAPPDATA || '', 'Programs'), 'C:/Program Files/Blender Foundation', 'C:/Program Files',
    '/Applications', '/usr/bin', '/usr/local/bin', '/snap/bin',
  ];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const n of readdirSync(d).filter((n) => /blender/i.test(n)).sort().reverse()) {
      for (const exe of [join(d, n, 'blender.exe'), join(d, n, 'Contents/MacOS/Blender'), join(d, n)]) if (existsSync(exe) && !exe.endsWith(n + '/')) return exe;
    }
  }
  return 'blender'; // hope it is on PATH
}

const run = (cmd, a, what) => {
  console.log(`\n== ${what}`);
  const r = spawnSync(cmd, a, { cwd: root, stdio: 'inherit', shell: false });
  if (r.status !== 0) { console.error(`${what} failed (${r.error?.message || 'exit ' + r.status})`); process.exit(1); }
};

const blender = findBlender();
const blend = join(root, 'art/blend/characters.blend');
if (!args.includes('--skip-build')) run(blender, ['-b', '-P', 'tools/blender/build_characters.py'], `build characters with ${blender}`);
run(blender, ['-b', blend, '-P', 'tools/blender/render_sprites.py', '--', '--out', 'art/renders', ...kinds], 'render sprites');
const py = process.platform === 'win32' ? ['py', ['-3']] : ['python3', []];
run(py[0], [...py[1], 'tools/pack_atlas.py', 'art/renders'], 'pack the atlas');
console.log('\ndone: now `npm run build` and `npm test`');
