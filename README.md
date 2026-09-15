# Personal site

Static HTML, CSS, and vanilla JS. No build step, no dependencies, no framework.
All content lives in `data/site.json` — routine updates never touch the markup.

## Running it locally

The pages load content with `fetch`, which browsers block on `file://`, so opening
`index.html` by double-clicking it will show an error box. Serve it over HTTP instead:

```
cd personal-site
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Changing the book or the album

Open `data/site.json`, edit the `now` block, and bump `updated` to today:

```json
"now": {
  "updated": "2026-09-15",
  "book":  { "title": "...", "author": "...", "cover": "img/covers/book.jpg", "note": "..." },
  "album": { "title": "...", "artist": "...", "cover": "img/covers/album.jpg", "note": "..." }
}
```

`cover` is optional — leave it as `""` and a dashed placeholder shows instead. If you do
add art, put the file in `img/covers/` and fill in `coverAlt` with a real description.
Book covers are displayed at 2:3, album art at 1:1.

When you move on, cut the old entry into the `archive` array so the history accumulates:

```json
{ "type": "book", "title": "...", "creator": "...", "finished": "2026-08", "note": "..." }
```

`finished` accepts `YYYY-MM` or a full `YYYY-MM-DD`.

## Adding a project

Append to the `projects` array. Only `slug`, `title`, and `blurb` are required.

- `blurb` shows on the cards, `description` on the projects page.
- `image` — put a screenshot in `img/projects/` and point at it, or set it to `null`
  to get a colored placeholder keyed to the slug. Always write `imageAlt`.
- `featured: true` puts it on the home page.
- `tags` feed the filter buttons on the projects page automatically.

## Adding a post

1. Write `posts/your-slug.md`.
2. Add `{ "slug": "your-slug", "title": "...", "date": "2026-09-15", "summary": "..." }`
   to the `posts` array.

Only slugs listed in `site.json` can be loaded, so step 2 is what publishes it.
The renderer (`js/md.js`) supports headings, bold, italic, inline and fenced code,
lists, blockquotes, links, images, and horizontal rules. Raw HTML is escaped, not
executed.

## Layout

```
index.html      hero, featured projects, "currently" panel
projects.html   all projects, filterable by tag
now.html        current book and album, then the archive
writing.html    post index
post.html       post reader (?p=slug)
css/style.css   design tokens, light and dark, all components
js/site.js      content loading, page chrome, theme, helpers
js/render.js    card, now, archive, and post-list renderers
js/md.js        Markdown subset renderer
data/site.json  all content
```

## Deploying

Pushing to the default branch of a repo named `Cruzader101.github.io` publishes to
<https://cruzader101.github.io>. No Action or build is needed — GitHub Pages serves
these files as they are.

## Notes

- Check that `data/site.json` still parses after editing it:
  `python -c "import json; json.load(open('data/site.json', encoding='utf-8'))"`
- The theme follows the operating system until someone uses the toggle, after which
  their choice is remembered in `localStorage`.
- Every string from `site.json` is inserted as text, not markup, so an angle bracket
  in a blurb cannot break the page.
