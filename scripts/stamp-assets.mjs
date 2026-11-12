// Cache-busting: appends ?v=<content hash> to every local CSS/JS reference (assets/css/*.css, assets/js/*.js) in the
// HTML pages, so browsers and GitHub Pages' cache fetch a fresh file whenever it changes. Runs last in `npm run build`.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['node_modules', '.git', 'partials']);
const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) pages.push(p);
  }
})(root);

const hashes = new Map();
const hashOf = (file) => {
  if (!hashes.has(file)) hashes.set(file, existsSync(file) ? createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8) : null);
  return hashes.get(file);
};

let changed = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const out = html.replace(/((?:href|src)=")((?:\.{1,2}\/)*|\/)(assets\/(?:css|js)\/[\w.-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")/g,
    (m, attr, prefix, path, end) => {
      const h = hashOf(join(root, path));
      return h ? `${attr}${prefix}${path}?v=${h}${end}` : m;
    });
  if (out !== html) { writeFileSync(page, out); changed++; }
}
console.log(`stamp-assets: ${changed} page(s) updated`);
