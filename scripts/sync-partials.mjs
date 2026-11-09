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
  return `<div class="crumbs mb-12 flex items-center gap-5 md:mb-16 md:gap-6">
    <a href="${parent.href}" aria-label="Back to ${esc(parent.name)}" title="Back to ${esc(parent.name)}" class="back-btn">
      <svg aria-hidden="true" class="size-6 md:size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H4M10 6l-6 6 6 6"/></svg>
    </a>
    <nav aria-label="Breadcrumb" class="min-w-0">
      <ol class="eyebrow flex min-w-0 items-center gap-2 text-mist-500">
      ${items}
      </ol>
    </nav>
  </div>`;
}

// Homepage "Journal" list: the newest 3 entries of the post list in blog/index.html, inserted into index.html
// between <!-- include:journal-latest --> … <!-- /include:journal-latest -->. Edit the Journal list, not the homepage.
function journalLatest() {
  const blog = readFileSync(join(root, 'blog/index.html'), 'utf8');
  const list = (/<ol\b[\s\S]*?<\/ol>/.exec(blog.slice(blog.indexOf('PAGE CONTENT START'))) || [''])[0];
  const posts = [...list.matchAll(/<article\b[\s\S]*?<\/article>/g)].slice(0, 3).map(([a]) => {
    const href = (/<h2[\s\S]*?<a [^>]*href="([^"]+)"/.exec(a) || [])[1];
    const title = (/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(a) || [, ''])[1].replace(/<[^>]+>/g, '').trim();
    const date = ((/<time[^>]*>([^<]*)<\/time>/.exec(a) || /<span class="eyebrow">([^<]*)<\/span>/.exec(a)) || [, ''])[1].trim();
    // hrefs in blog/index.html are relative to /blog/; make them root-absolute again (rewritten per page below)
    const abs = href && (href.startsWith('../') ? '/' + href.slice(3) : href.startsWith('./') ? '/blog/' + href.slice(2) : href);
    return { href: abs, title, date };
  });
  return posts.map(({ href, title, date }) => {
    const inner = `<span class="eyebrow text-mist-500 md:w-40 md:shrink-0">${date}</span>
          <span class="${href ? 'slant ' : ''}font-serif text-2xl leading-snug md:text-3xl">${title}</span>`;
    return href
      ? `<li><a href="${href}" class="group flex flex-col gap-2 py-6 transition-colors hover:text-accent-300 md:flex-row md:items-baseline md:gap-8">
          ${inner}
        </a></li>`
      : `<li class="flex flex-col gap-2 py-6 text-mist-400 md:flex-row md:items-baseline md:gap-8">
          ${inner}
        </li>`;
  }).join('\n        ');
}
partials['journal-latest'] = journalLatest();

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
