import { readdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let removed = 0;

async function clean(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await clean(file);
    else if (entry.isFile() && entry.name.startsWith('._')) {
      const handle = await open(file, 'r');
      const header = Buffer.alloc(4);
      try { await handle.read(header, 0, 4, 0); } finally { await handle.close(); }
      // The external drive stores macOS resource metadata in AppleDouble files.
      // Remove only a verified sidecar, never a similarly named source file.
      if (header.readUInt32BE(0) === 0x00051607) { await unlink(file); removed++; }
    }
  }
}

for (const relative of ['src', 'test', 'scripts', 'static/app/src', 'static/app/public', 'static/app/dist', 'static/app/dist-demo']) await clean(path.join(root, relative));
console.log(`Prepared Forge source; removed ${removed} verified metadata sidecars.`);
