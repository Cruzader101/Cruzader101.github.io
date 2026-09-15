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

  /* ----------------------------------------------------------------- now -- */

  const NOW_SHAPE = {
    book: { kind: 'Reading', creatorKey: 'author', cls: 'is-book', blank: 'No cover yet' },
    album: { kind: 'Listening to', creatorKey: 'artist', cls: 'is-album', blank: 'No cover yet' }
  };

  function nowCard(type, item) {
    const shape = NOW_SHAPE[type];
    const cover = clean(item.cover);

    const art = cover
      ? el('img', {
          class: 'now-cover',
          attrs: {
            src: cover,
            alt: item.coverAlt || `Cover of ${item.title}.`,
            loading: 'lazy',
            decoding: 'async'
          }
        })
      : el('div', { class: 'now-cover is-blank', text: shape.blank, attrs: { 'aria-hidden': 'true' } });

    const head = el('div', {},
      el('p', { class: 'now-kind', text: shape.kind }),
      el('h2', { class: 'now-title' },
        clean(item.link)
          ? el('a', { text: item.title, attrs: { href: item.link, rel: 'noopener' } })
          : document.createTextNode(item.title || '')
      ),
      item[shape.creatorKey]
        ? el('p', { class: 'now-creator', text: item[shape.creatorKey] })
        : null
    );

    return el('article', { class: `now-card ${shape.cls}` },
      art,
      head,
      item.note ? el('p', { class: 'now-note', text: item.note }) : null
    );
  }

  function now(container, data) {
    const n = data.now || {};
    const cards = [];
    if (n.book) cards.push(nowCard('book', n.book));
    if (n.album) cards.push(nowCard('album', n.album));
    container.replaceChildren(...cards);

    const stamp = document.querySelector('[data-now-updated]');
    if (stamp && n.updated) {
      stamp.replaceChildren(
        document.createTextNode('Updated '),
        el('time', { text: fmtDate(n.updated), attrs: { datetime: isoAttr(n.updated) } })
      );
    }
  }

  /* Compact two-line version of "now" for the home page hero. */
  function nowPeek(container, data) {
    const n = data.now || {};
    const rows = [];
    for (const [type, item] of [['book', n.book], ['album', n.album]]) {
      if (!item || !item.title) continue;
      const shape = NOW_SHAPE[type];
      rows.push(el('li', {},
        el('span', { class: 'kind', text: type === 'book' ? 'Book' : 'Album' }),
        el('span', {},
          el('span', { class: 'what', text: item.title }),
          el('span', { class: 'who', text: item[shape.creatorKey] || '' })
        )
      ));
    }
    container.replaceChildren(...rows);
  }

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

  return { projects, projectCard, projectFilters, now, nowPeek, archive, postList };
})();
