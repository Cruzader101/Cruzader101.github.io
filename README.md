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

These are the two blocks the home page scrolls through. Open `data/site.json`,
edit the `now` block, and bump `updated` to today:

```json
"now": {
  "updated": "2026-09-15",
  "book": {
    "title": "...", "author": "...",
    "cover": "img/covers/your-book.jpg",
    "coverAlt": "describe the cover",
    "rating": 4.5,
    "note": "...",
    "link": "",
    "tint": null
  },
  "album": { "title": "...", "artist": "...", "cover": "...", "rating": 5, "...": "..." }
}
```

- **`rating`** is out of 5 and takes halves — `4.5` renders four and a half stars.
  Any fraction works (`4.2` fills the fifth star 20%). Leave it out to show no rating.
- **`cover`** points at a file in `img/covers/`. The book is shown at 2:3, the album
  at 1:1, and the album art doubles as the label on the spinning record.
  **The two files there now are generated placeholders — replace them.**
- **`coverAlt`** is the alt text. Write a real description; it is what a screen reader
  announces and what shows if the file goes missing.
- **`tint`** overrides the background colour for that block, as a hex string like
  `"#7a4b2a"`. Leave it `null` and the colour is sampled from the cover art instead,
  which is usually what you want.

When you move on, cut the old entry into the `archive` array — that is what
`now.html` lists:

```json
{ "type": "book", "title": "...", "creator": "...", "finished": "2026-08",
  "rating": 4, "note": "..." }
```

`finished` accepts `YYYY-MM` or a full `YYYY-MM-DD`.

## How the scrolling background works

`js/ambience.js` samples a dominant colour from each cover, then pushes it to a fixed
lightness and a capped saturation for the current theme. The hue survives; the
lightness does not. That is deliberate — it means no cover, however saturated, can
drag the background somewhere that text stops being readable. Every text colour was
checked against the tinted background in both themes and clears WCAG AA, though that
was measured with the placeholder covers — worth a re-check if you drop in art that
is far more saturated.

As you scroll, the background interpolates continuously between the colours of the
blocks either side of the viewport centre, and returns to the plain theme background
before the projects grid.

If the reader's OS asks for reduced motion, the colour stays but stops following the
scroll: each block's tint settles in as that block reaches the middle of the screen,
and the record slides out but does not turn. Nothing is lost, it just stops moving
continuously.

If a cover fails to load, or the browser blocks reading pixels from it, that block
falls back to the untinted background rather than breaking.

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
index.html      intro, then the book and album blocks, then featured projects
projects.html   all projects, filterable by tag
now.html        the archive of past books and albums
writing.html    post index
post.html       post reader (?p=slug)
css/style.css   design tokens, light and dark, all components
js/site.js      content loading, page chrome, theme, helpers
js/render.js    cards, the book/album blocks, stars, the record, archive, posts
js/ambience.js  scroll-driven background tint sampled from the cover art
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
- The record's slide and spin are driven by an IntersectionObserver, so they run
  when the block is actually on screen rather than before anyone has scrolled to it.
- Every string from `site.json` is inserted as text, not markup, so an angle bracket
  in a blurb cannot break the page.
