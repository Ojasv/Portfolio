#!/usr/bin/env node
// Copies partials/header.html and partials/footer.html into every page between marker comments:
//   <!-- include:header --> … <!-- /include:header -->
//   <!-- include:footer --> … <!-- /include:footer -->
// marks the current section's nav links with aria-current="page" (by matching data-nav to the first path folder),
// and rewrites root-absolute URLs ("/assets/…", "/projects/") in attributes to relative ones ("../assets/…"), so the
// same files work at https://ojasvapurv.com/ and at a sub-path like https://ojasv.github.io/Portfolio/.
// Also inserts breadcrumbs + a back button at the top of <main> on pages below the homepage (see crumbs()).
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

// Breadcrumbs + back button, inserted at the top of <main> on every page below the homepage, between
// <!-- crumbs --> … <!-- /crumbs -->. Generated from the folder path; the page's own name comes from its <title>.
const sectionNames = { projects: 'Work', artworks: 'Visuals', blog: 'Journal', about: 'Profile' };
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function crumbs(rel, html) {
  const parts = rel.split(sep).slice(0, -1);            // folders above index.html
  if (!parts.length || rel === '404.html') return null;
  const title = ((/<title>([^<]*)<\/title>/.exec(html) || [])[1] || '').split(' · ')[0].trim();
  const trail = [{ name: 'Home', href: '/' }];
  parts.forEach((part, i) => trail.push({
    name: i === 0 ? (sectionNames[part] || part) : (title || part),
    href: '/' + parts.slice(0, i + 1).join('/') + '/',
  }));
  const parent = trail[trail.length - 2];
  const items = trail.map((c, i) => i === trail.length - 1
    ? `<li class="min-w-0"><span aria-current="page" class="block truncate text-paper">${esc(c.name)}</span></li>`
    : `<li class="flex items-center gap-2"><a class="hover:text-accent-300" href="${c.href}">${esc(c.name)}</a><span aria-hidden="true" class="text-mist-700">/</span></li>`
  ).join('\n      ');
  return `<div class="crumbs mb-12 flex flex-wrap items-center gap-x-6 gap-y-4 md:mb-16">
    <a href="${parent.href}" class="group inline-flex items-center gap-3 rounded-full border border-mist-600 py-2 pr-5 pl-3 text-sm font-medium text-paper transition-colors hover:border-accent-400 hover:bg-accent-900">
      <svg aria-hidden="true" class="size-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8H3M7 4 3 8l4 4"/></svg>
      Back to ${esc(parent.name)}
    </a>
    <nav aria-label="Breadcrumb" class="min-w-0">
      <ol class="eyebrow flex min-w-0 items-center gap-2 text-mist-500">
      ${items}
      </ol>
    </nav>
  </div>`;
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
  const crumb = crumbs(rel, html);
  if (crumb) {
    if (/<!-- crumbs -->/.test(html)) html = html.replace(/<!-- crumbs -->[\s\S]*?<!-- \/crumbs -->/, `<!-- crumbs -->\n  ${crumb}\n  <!-- /crumbs -->`);
    else html = html.replace(/(<main\b[^>]*>)/, `$1\n  <!-- crumbs -->\n  ${crumb}\n  <!-- /crumbs -->`);
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
