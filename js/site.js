/* Shared machinery: content loading, page chrome, theme, small helpers.
   Loaded by every page before render.js. */

const Site = (() => {
  'use strict';

  const DATA_URL = 'data/site.json';
  let cache = null;

  /* ------------------------------------------------------------- content -- */

  async function load() {
    if (cache) return cache;
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${DATA_URL} -> HTTP ${res.status}`);
    cache = await res.json();
    return cache;
  }

  /* Wraps a page's render function so a bad site.json shows a readable message
     instead of a silently blank page. */
  function page(fn) {
    document.addEventListener('DOMContentLoaded', async () => {
      initChrome();
      try {
        const data = await load();
        fillChrome(data);
        await fn(data);
      } catch (err) {
        console.error(err);
        showLoadError(err);
      }
    });
  }

  function showLoadError(err) {
    const main = document.querySelector('main .wrap') || document.querySelector('main');
    if (!main) return;
    const box = document.createElement('div');
    box.className = 'note';
    box.setAttribute('role', 'alert');
    box.style.margin = '2rem 0';
    const strong = document.createElement('strong');
    strong.textContent = 'Could not load site content. ';
    box.append(strong);
    box.append(document.createTextNode(
      'If you opened this file directly, serve it over HTTP instead: run ' +
      '"python -m http.server 8000" in the project folder and visit ' +
      'http://localhost:8000. (' + err.message + ')'
    ));
    main.prepend(box);
  }

  /* --------------------------------------------------------------- theme -- */

  const THEME_KEY = 'cm-theme';

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch { return null; }
  }

  function storeTheme(value) {
    try {
      if (value) localStorage.setItem(THEME_KEY, value);
      else localStorage.removeItem(THEME_KEY);
    } catch { /* private mode, or site data blocked — the toggle still works for this pageview */ }
  }

  /* What the page is showing right now, whether that came from a stored choice
     or from the OS. */
  function activeTheme() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(value) {
    document.documentElement.setAttribute('data-theme', value);
    storeTheme(value);
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.setAttribute('aria-label', `Switch to ${value === 'dark' ? 'light' : 'dark'} theme`);
  }

  /* -------------------------------------------------------------- chrome -- */

  function initChrome() {
    // Mark the nav item for the current page.
    const here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.site-nav a').forEach((a) => {
      const target = a.getAttribute('href');
      if (target === here || (here === 'post.html' && target === 'writing.html')) {
        a.setAttribute('aria-current', 'page');
      }
    });

    const btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label', `Switch to ${activeTheme() === 'dark' ? 'light' : 'dark'} theme`);
      btn.addEventListener('click', () => {
        applyTheme(activeTheme() === 'dark' ? 'light' : 'dark');
      });
    }

    const year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();
  }

  /* Header and footer bits that come from site.json. */
  function fillChrome(data) {
    const p = data.profile || {};
    document.querySelectorAll('[data-profile-name]').forEach((n) => {
      if (p.name) n.textContent = p.name;
    });

    const links = p.links || {};
    document.querySelectorAll('[data-link]').forEach((a) => {
      const url = links[a.dataset.link];
      if (url && !isPlaceholder(url)) {
        a.href = a.dataset.link === 'email' && !url.startsWith('mailto:') ? `mailto:${url}` : url;
      } else {
        // No URL for this one — drop the whole list item, not just the anchor.
        (a.closest('li') || a).remove();
      }
    });
  }

  /* ------------------------------------------------------------- helpers -- */

  /* Builds an element. Text always goes in as textContent, never innerHTML. */
  function el(tag, opts = {}, ...children) {
    const node = document.createElement(tag);
    if (opts.class) node.className = opts.class;
    if (opts.text != null) node.textContent = opts.text;
    for (const [k, v] of Object.entries(opts.attrs || {})) {
      if (v != null) node.setAttribute(k, v);
    }
    for (const child of children.flat()) {
      if (child) node.append(child);
    }
    return node;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* Parses the string by hand rather than via Date(), which reads a bare
     YYYY-MM-DD as UTC midnight and can render the day before in the Americas. */
  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m) return String(iso);
    const month = MONTHS[m - 1] || '';
    return d ? `${d} ${month} ${y}` : `${month} ${y}`;
  }

  function isoAttr(iso) {
    return /^\d{4}(-\d{2}){0,2}$/.test(String(iso || '')) ? iso : null;
  }

  /* Stable hue per slug, so a placeholder keeps the same color across reloads. */
  function hueFrom(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  function monogram(title) {
    return String(title || '?')
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  /* Content that still carries a TODO placeholder should not be rendered as if
     it were real. */
  function isPlaceholder(value) {
    return typeof value === 'string' && value.trim().toUpperCase().startsWith('TODO');
  }

  function clean(value) {
    return isPlaceholder(value) ? '' : (value || '');
  }

  return { load, page, el, fmtDate, isoAttr, hueFrom, monogram, isPlaceholder, clean, applyTheme, activeTheme };
})();
