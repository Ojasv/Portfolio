#!/usr/bin/env node
// Copies partials/header.html and partials/footer.html into every page between marker comments:
//   <!-- include:header --> … <!-- /include:header -->
//   <!-- include:footer --> … <!-- /include:footer -->
// marks the current section's nav links with aria-current="page" (by matching data-nav to the first path folder),
// and rewrites root-absolute URLs ("/assets/…", "/projects/") in attributes to relative ones ("../assets/…"), so the
// same files work at https://ojasvapurv.com/ and at a sub-path like https://ojasv.github.io/Portfolio/.
// Write links root-absolute in pages and partials; this makes them relative. 404.html sets a <base> and gets the slash dropped.
// Run: npm run sync   (npm run build does this too)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const skip = new Set(['node_modules', '.git', 'partials', 'scripts', '.github']);
const partials = {
  header: readFileSync(join(root, 'partials/header.html'), 'utf8').trim(),
  footer: readFileSync(join(root, 'partials/footer.html'), 'utf8').trim(),
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  const rel = relative(root, file);
  const section = rel.includes(sep) ? rel.split(sep)[0] : '';
  let html = readFileSync(file, 'utf8');
  const before = html;
  for (const [name, body] of Object.entries(partials)) {
    const re = new RegExp(`(<!-- include:${name} -->)[\\s\\S]*?(<!-- /include:${name} -->)`, 'g');
    let block = body;
    if (section) block = block.replace(new RegExp(`data-nav="${section}"`, 'g'), `data-nav="${section}" aria-current="page"`);
    html = html.replace(re, `$1\n${block}\n$2`);
  }
  {
    // 404.html is served at any depth, so it relies on its <base> tag and resolves "./…" against it.
    const depth = rel.split(sep).length - 1;
    const prefix = rel === '404.html' ? './' : depth ? '../'.repeat(depth) : './';
    html = html.replace(/\b(href|src|srcset|imagesrcset|poster|action|data-[\w-]+)="([^"]*)"/g, (m, attr, val) =>
      `${attr}="${val.replace(/(^|,\s*)\/(?!\/)/g, `$1${prefix}`)}"`);
  }
  if (html !== before) { writeFileSync(file, html); changed++; console.log('synced', rel); }
}
console.log(`${changed} file(s) updated`);
