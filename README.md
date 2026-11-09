# ojasvapurv.com

Portfolio site for Ojasv Apurv. Plain HTML + Tailwind CSS, hosted on GitHub Pages at **https://ojasvapurv.com**.

## Structure

```
index.html              Homepage (scroll-triggered wave hero)
about/index.html        Profile          → /about/
projects/index.html     Work             → /projects/   (case studies: projects/<slug>/index.html)
blog/index.html         Journal          → /blog/       (posts: blog/<slug>/index.html)
artworks/index.html     Visuals          → /artworks/
404.html
partials/header.html    Shared header + nav (source of truth)
partials/footer.html    Shared footer (source of truth)
assets/css/input.css    Tailwind source: design tokens (@theme), custom utilities, base styles
assets/css/site.css     Built CSS (committed; the only stylesheet pages link). Don't edit by hand.
assets/js/site.js       Menu toggle, header background on scroll, footer year (every page)
assets/js/wave-scroll.js, shore-scroll.js   Homepage hero animation
assets/img/<section>/   Images, grouped by section
scripts/sync-partials.mjs   Copies partials into every page
CNAME, .nojekyll        GitHub Pages config
```

All links and asset paths are root-absolute (`/assets/...`, `/projects/`), so pages work at any folder depth.

## Working on it

```bash
npm install
npm run dev      # sync header/footer into pages, then rebuild CSS on every change
npm run serve    # http://localhost:8080 (in a second terminal)
npm run build    # sync + minified CSS; run before every commit
```

### Adding a page

1. Copy `about/index.html` to `<section>/<slug>/index.html`.
2. Update `<title>`, `<meta name="description">` and the canonical URL.
3. Replace everything between `<!-- PAGE CONTENT START -->` and `<!-- PAGE CONTENT END -->`.
4. `npm run build` and commit both the HTML and `assets/css/site.css`.

Never edit the markup between `<!-- include:header -->` / `<!-- /include:header -->` (or the footer markers) inside a page; edit `partials/` and run `npm run sync`. The sync also marks the current section in the nav (`aria-current="page"`).

### Design tokens (Tailwind classes)

| Token | Use |
| --- | --- |
| `bg-ink` (#161826), `bg-surface` | Page ground, raised panels |
| `text-paper` (#e9e9ed) | Primary text |
| `mist-100…900` | Neutrals for muted text, borders, fills |
| `accent-100…900` (500 = #968ae0) | Lines, links (`text-accent-300`), focus rings. Never a large fill. |
| `font-serif` (Playfair Display), `font-sans` (Inter) | Display vs body |
| `gutter`, `wrap` | Page side padding, max content width |
| `eyebrow`, `nav-link`, `btn`, `rule`, `.prose-site` | Small caps label, nav link, outlined button, fading divider, long-form text |

### Up to 4K

Extra breakpoints `3xl` (1920px), `4xl` (2560px), `5xl` (3840px). The root font size also steps up at 1920 / 2560 / 3840px (18 / 24 / 36px), so anything sized in Tailwind units (rem) scales with the screen. Size things with Tailwind units, not `px`. Provide images at least 2400px wide for full-bleed use (the hero ships 1200 / 2400 / 3600px versions).

### NDA work

Case studies link to password-protected Figma prototypes. Never commit a prototype password or any NDA material to this repo; it is public.

## Hosting (GitHub Pages + ojasvapurv.com)

1. Repo **Settings → Pages**: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
2. At the domain registrar, set DNS for `ojasvapurv.com`:
   - `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - optional `AAAA` for `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
   - `CNAME` for `www`: `ojasv-peepal.github.io`
   - remove any other A/AAAA/CNAME records on `@` and `www` (e.g. registrar parking).
3. **Settings → Pages → Custom domain**: `ojasvapurv.com` (the `CNAME` file already sets it). After the DNS check passes, tick **Enforce HTTPS** (the certificate can take up to an hour).
4. Recommended: verify the domain under your GitHub account **Settings → Pages → Verified domains** so nobody else can claim it.
