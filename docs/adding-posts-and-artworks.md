# Adding Journal posts and Visuals (artworks)

Everything is plain HTML. Copy a file or block, edit the text, run `npm run build`, commit and push. GitHub Pages publishes it.

## Add a Journal post (about 5 minutes)

1. Copy `blog/_template/index.html` to `blog/<post-slug>/index.html` (lowercase, hyphens, no spaces). The folder name becomes the URL: `/blog/<post-slug>/`.
2. In the copy, delete the `<meta name="robots" content="noindex">` line and the comment above `<html>`.
3. Search for `EDIT` and replace each one: title, description, canonical URL, date, read time, tag, standfirst, cover image.
4. Write the body inside the `POST BODY` block with plain tags: `<p>`, `<h2>`, `<h3>`, `<ul><li>`, `<a>`, `<img>`. `.prose-site` styles them. For a pull quote, copy the `<blockquote>` from the template.
5. Put images in `assets/img/blog/` (about 2400px wide for covers) and reference them as `/assets/img/blog/name.jpg`.
6. In `blog/index.html`, copy one `<li>…</li>` post card, paste it at the **top** of the list, and change the link, date, tag, title and summary.
7. `npm run build`, then commit and push.

`blog/designing-under-nda/` is a sample post. Delete that folder and its card once your first real post is up.

## Add an artwork

1. Put the image in `assets/img/artworks/` (long edge about 2400px, JPG or WebP).
2. In `artworks/index.html`, copy a whole `<li id="thumb-N">…</li>` block.
3. Change the number in `thumb-N`, `#art-N` and `id="art-N"` to the next free number.
4. Update the image path (twice: thumbnail and full view), `width`/`height`, `alt`, title, medium and year.
5. Fix Prev/Next so the chain loops: the previous last item points to the new one, and the new one's Next points to `#art-1`.

The full-screen view is pure CSS (`:target`), with no JavaScript.

## Showing or hiding Visuals

Visuals is optional. To hide it, delete the `Visuals` `<li>` lines in `partials/header.html` (two: desktop and mobile) and `partials/footer.html`, then run `npm run build`. Put them back to show it again. To remove the section entirely, also delete `artworks/` and `assets/img/artworks/`.

> The homepage shows the newest 3 entries of the Journal list automatically after `npm run build`. Two "Coming soon" placeholder entries (marked `EDIT: placeholder post`) sit in that list until real posts replace them.
