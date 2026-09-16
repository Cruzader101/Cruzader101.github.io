/* Renderers. Every string from site.json goes in as textContent, so a stray
   angle bracket in a blurb is text, not markup. */

const Render = (() => {
  'use strict';

  const { el, fmtDate, isoAttr, hueFrom, monogram, clean } = Site;

  /* ------------------------------------------------------------ projects -- */

  function cardMedia(project) {
    const image = clean(project.image);
    if (image) {
      const fit = project.imageFit === 'contain' ? ' fit-contain' : '';
      return el('div', { class: `card-media${fit}` },
        el('img', {
          attrs: {
            src: image,
            alt: project.imageAlt || `Screenshot from ${project.title}.`,
            loading: 'lazy',
            decoding: 'async'
          }
        })
      );
    }
    // No screenshot yet: a colored panel keyed to the slug, with a monogram.
    const media = el('div', {
      class: 'card-media is-placeholder',
      attrs: {
        'data-monogram': monogram(project.title),
        role: 'img',
        'aria-label': `${project.title} — no screenshot yet`
      }
    });
    media.style.setProperty('--ph-h', hueFrom(project.slug || project.title || ''));
    return media;
  }

  function projectCard(project, { detailed = false } = {}) {
    const body = el('div', { class: 'card-body' });

    const primary = (project.links || []).find((l) => clean(l.url));
    const heading = el('h3', { class: 'card-title' });
    if (primary) {
      heading.append(el('a', {
        text: project.title,
        attrs: { href: primary.url, rel: 'noopener' }
      }));
    } else {
      heading.textContent = project.title;
    }
    body.append(heading);

    const meta = el('div', { class: 'card-meta' });
    if (project.year) meta.append(el('span', { text: String(project.year) }));
    if (project.year && project.status) meta.append(el('span', { class: 'dot', text: '·' }));
    if (project.status) meta.append(el('span', { text: project.status }));
    if (meta.childNodes.length) body.append(meta);

    const copy = detailed ? (project.description || project.blurb) : project.blurb;
    if (copy) body.append(el('p', { class: detailed ? 'card-desc' : 'card-blurb', text: copy }));

    if (project.tags?.length) {
      body.append(el('ul', { class: 'tags' },
        project.tags.map((t) => el('li', { class: 'tag', text: t }))
      ));
    }

    const links = (project.links || []).filter((l) => clean(l.url));
    if (links.length) {
      body.append(el('ul', { class: 'card-links' },
        links.map((l) => el('li', {}, el('a', {
          text: l.label,
          attrs: { href: l.url, rel: 'noopener' }
        })))
      ));
    }

    return el('li', { class: 'card', attrs: { 'data-tags': (project.tags || []).join('|') } },
      cardMedia(project),
      body
    );
  }

  function projects(container, list, opts = {}) {
    container.replaceChildren(...list.map((p) => projectCard(p, opts)));
  }

  /* Tag filter above the projects grid. Buttons, not links — nothing navigates. */
  function projectFilters(container, list, grid, status) {
    const tags = [...new Set(list.flatMap((p) => p.tags || []))].sort();
    if (!tags.length) return;

    const makeBtn = (label, value, pressed) => {
      const btn = el('button', {
        class: 'filter-btn',
        text: label,
        attrs: { type: 'button', 'aria-pressed': String(pressed), 'data-tag': value }
      });
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-btn').forEach((b) =>
          b.setAttribute('aria-pressed', String(b === btn)));
        apply(value);
      });
      return el('li', {}, btn);
    };

    function apply(tag) {
      let shown = 0;
      grid.querySelectorAll('.card').forEach((card) => {
        const has = !tag || (card.dataset.tags || '').split('|').includes(tag);
        card.hidden = !has;
        if (has) shown++;
      });
      status.textContent = tag
        ? `Showing ${shown} ${shown === 1 ? 'project' : 'projects'} tagged ${tag}.`
        : `Showing all ${shown} projects.`;
    }

    container.replaceChildren(
      makeBtn('All', '', true),
      ...tags.map((t) => makeBtn(t, t, false))
    );
    apply('');
  }

  /* --------------------------------------------------------------- stars -- */

  const STAR_PATH = 'M12 2.6l2.95 5.98 6.6.96-4.775 4.655 1.127 6.574L12 17.67'
    + 'l-5.902 3.1 1.127-6.573L2.45 9.54l6.6-.96L12 2.6z';

  function starSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', STAR_PATH);
    path.setAttribute('fill', 'currentColor');
    svg.append(path);
    return svg;
  }

  /* Five stars, each filled by clipping an overlay to a width — so 4.5 works,
     and so would 4.2 if the scale ever changes. */
  function stars(value) {
    const score = Math.max(0, Math.min(5, Number(value)));
    if (!Number.isFinite(score)) return null;

    const icons = el('span', { class: 'stars-icons', attrs: { 'aria-hidden': 'true' } });
    for (let i = 0; i < 5; i++) {
      const filled = Math.max(0, Math.min(1, score - i));
      const star = el('span', { class: 'star' }, starSvg());
      if (filled > 0) {
        const fill = el('span', { class: 'star-fill' }, starSvg());
        fill.style.width = `${filled * 100}%`;
        star.append(fill);
      }
      icons.append(star);
    }

    // The number is the accessible version; the stars are decorative.
    const rounded = Number.isInteger(score) ? String(score) : score.toFixed(1);
    return el('span', { class: 'stars' },
      icons,
      el('span', { class: 'rating-value', text: `${rounded} out of 5` })
    );
  }

  /* ------------------------------------------------------------ showcase -- */

  function cover(item, { className, blankText }) {
    const src = clean(item.cover);
    if (!src) {
      return el('div', {
        class: `${className} cover-blank`,
        text: blankText,
        attrs: { 'aria-hidden': 'true' }
      });
    }
    return el('img', {
      class: className,
      attrs: {
        src,
        alt: item.coverAlt || `Cover of ${item.title}.`,
        decoding: 'async',
        'data-tint-source': ''
      }
    });
  }

  /* The record: sleeve in front, disc sliding out behind it and turning. */
  function vinyl(item) {
    const src = clean(item.cover);
    const label = src
      ? el('img', {
          class: 'vinyl-label',
          attrs: { src, alt: '', decoding: 'async', 'aria-hidden': 'true' }
        })
      : el('div', { class: 'vinyl-label-blank', attrs: { 'aria-hidden': 'true' } });

    const sleeve = src
      ? el('img', {
          class: 'vinyl-sleeve',
          attrs: {
            src,
            alt: item.coverAlt || `Cover of ${item.title}.`,
            decoding: 'async',
            'data-tint-source': ''
          }
        })
      : el('div', { class: 'vinyl-sleeve cover-blank', text: 'No cover yet', attrs: { 'aria-hidden': 'true' } });

    return el('div', { class: 'vinyl' },
      el('div', { class: 'vinyl-disc-wrap' }, el('div', { class: 'vinyl-disc' }, label)),
      sleeve
    );
  }

  const SHOWCASE = {
    book: { kind: 'Currently reading', creatorKey: 'author' },
    album: { kind: 'On repeat', creatorKey: 'artist' }
  };

  /* Favourite tracks off the album. Accepts either a list or one comma-separated
     string, since that is the shape a hand-edited site.json tends to end up in. */
  function favorites(value) {
    const list = (Array.isArray(value) ? value : String(value || '').split(','))
      .map((t) => clean(String(t)).trim())
      .filter(Boolean);
    if (!list.length) return null;

    return el('div', { class: 'showcase-favorites' },
      el('p', { class: 'favorites-label', text: 'Favorite tracks' }),
      el('ol', { class: 'favorites-list' },
        list.map((track, i) => el('li', {},
          el('span', { class: 'favorites-num', text: String(i + 1).padStart(2, '0') }),
          el('span', { class: 'favorites-track', text: track })
        ))
      )
    );
  }

  function showcase(section, type, item) {
    if (!item) { section.remove(); return; }
    const shape = SHOWCASE[type];
    section.setAttribute('aria-label', shape.kind);

    const media = section.querySelector('[data-showcase-media]');
    media.replaceChildren(
      type === 'album'
        ? vinyl(item)
        : cover(item, { className: 'book-cover', blankText: 'No cover yet' })
    );

    const body = section.querySelector('[data-showcase-body]');
    // replaceChildren() would stringify a null into the literal text "null",
    // so the optional rows are filtered out rather than passed through.
    body.replaceChildren(...[
      el('p', { class: 'showcase-kind', text: shape.kind }),
      el('h2', { class: 'showcase-title' },
        clean(item.link)
          ? el('a', { text: item.title, attrs: { href: item.link, rel: 'noopener' } })
          : document.createTextNode(item.title || '')
      ),
      item[shape.creatorKey] ? el('p', { class: 'showcase-creator', text: item[shape.creatorKey] }) : null,
      item.rating != null ? el('div', { class: 'showcase-rating' }, stars(item.rating)) : null,
      item.note ? el('p', { class: 'showcase-note', text: item.note }) : null,
      type === 'album' ? favorites(item.favorites) : null
    ].filter(Boolean));

    if (item.tint) section.dataset.tint = item.tint;
  }

  /* Slides the record out once the block is actually on screen, so the motion
     happens where it can be seen rather than before the reader arrives. */
  function armVinyl() {
    const discs = [...document.querySelectorAll('.vinyl')];
    if (!discs.length) return;

    if (!('IntersectionObserver' in window)) {
      discs.forEach((d) => d.classList.add('is-out'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-out', entry.isIntersecting));
    }, { threshold: 0.35 });
    discs.forEach((d) => io.observe(d));
  }

  /* ------------------------------------------------------------- archive -- */

  function archive(container, list) {
    if (!list?.length) {
      container.replaceChildren(el('p', { class: 'empty', text: 'Nothing archived yet.' }));
      return;
    }
    const rows = list.map((item) => el('li', {},
      el('span', { class: 'archive-kind', text: item.type || '' }),
      el('span', {},
        el('span', { class: 'archive-what', text: item.title || '' }),
        item.creator ? el('span', { class: 'archive-who', text: ` — ${item.creator}` }) : null,
        item.rating != null ? el('span', { class: 'archive-rating' }, stars(item.rating)) : null,
        item.note ? el('span', { class: 'archive-note', text: item.note }) : null
      ),
      el('span', { class: 'archive-when' },
        el('time', { text: fmtDate(item.finished), attrs: { datetime: isoAttr(item.finished) } })
      )
    ));
    container.replaceChildren(...rows);
  }

  /* ------------------------------------------------------------- writing -- */

  function postList(container, list) {
    if (!list?.length) {
      container.replaceChildren(el('p', { class: 'empty', text: 'No posts yet.' }));
      return;
    }
    const sorted = [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    container.replaceChildren(...sorted.map((post) => el('li', { class: 'post-item' },
      el('h3', {}, el('a', {
        text: post.title,
        attrs: { href: `post.html?p=${encodeURIComponent(post.slug)}` }
      })),
      el('time', { class: 'post-date', text: fmtDate(post.date), attrs: { datetime: isoAttr(post.date) } }),
      post.summary ? el('p', { class: 'post-summary', text: post.summary }) : null
    )));
  }

  return {
    projects, projectCard, projectFilters,
    stars, showcase, favorites, armVinyl,
    archive, postList
  };
})();
