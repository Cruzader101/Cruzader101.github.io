/* Scroll-driven background tint.

   Each marked section carries a colour — sampled from its cover art, or taken
   from an explicit "tint" in site.json. As the page scrolls, the background
   blends continuously between the colours of the sections either side of the
   viewport centre.

   Two rules keep this from wrecking legibility:
   - A sampled colour is never used raw. It is pushed to a fixed lightness and
     a capped saturation for the active theme, so it reads as a tint of the
     page background rather than as a coloured panel. Text contrast therefore
     stays where the palette put it.
   - Everything degrades: no canvas, a cross-origin image, a failed decode, or
     prefers-reduced-motion all fall back to the untinted theme background. */

const Ambience = (() => {
  'use strict';

  // Where a tint is allowed to land, per theme. Cards sit slightly off the page
  // ground, so surfaces get their own band rather than reusing the page one.
  const RANGE = {
    light: { l: 95.5, maxS: 42, surfaceL: 99, surfaceS: 30 },
    dark: { l: 10.5, maxS: 34, surfaceL: 14, surfaceS: 26 }
  };

  let sections = [];
  let ticking = false;
  // 'scroll'   — the tint is interpolated continuously against scroll position.
  // 'discrete' — reduced-motion: the same tints, but they settle per section via
  //              a short CSS transition instead of repainting as you scroll.
  let mode = 'scroll';
  let observer = null;

  /* ------------------------------------------------------------- colour -- */

  function hexToRgb(hex) {
    const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s * 100, l * 100];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] =
      h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
      h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r + m, g + m, b + m].map((v) => Math.round(v * 255));
  }

  /* The safety valve: keep the hue, throw away the lightness and most of the
     saturation, so any cover art lands in a narrow, legible band. */
  function toTint(rgb, theme) {
    const [h, s] = rgbToHsl(rgb);
    const range = RANGE[theme] || RANGE.light;
    return hslToRgb(h, Math.min(s, range.maxS), range.l);
  }

  function toSurfaceTint(rgb, theme) {
    const [h, s] = rgbToHsl(rgb);
    const range = RANGE[theme] || RANGE.light;
    return hslToRgb(h, Math.min(s, range.surfaceS), range.surfaceL);
  }

  function mix(a, b, t) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * t));
  }

  function css(rgb) {
    return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
  }

  /* --------------------------------------------------------- extraction -- */

  /* Dominant colour by coarse hue bucket, weighted towards saturated pixels so
     a mostly-grey sleeve with one strong colour still reads as that colour. */
  function dominantColor(img) {
    const SIZE = 36;
    let canvas;
    try {
      canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

      const buckets = new Map();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const rgb = [data[i], data[i + 1], data[i + 2]];
        const [h, s, l] = rgbToHsl(rgb);
        if (l < 8 || l > 94) continue;            // near-black and near-white carry no hue
        const key = Math.round(h / 20);
        const weight = 1 + (s / 100) * 3;
        const acc = buckets.get(key) || { w: 0, r: 0, g: 0, b: 0 };
        acc.w += weight;
        acc.r += rgb[0] * weight;
        acc.g += rgb[1] * weight;
        acc.b += rgb[2] * weight;
        buckets.set(key, acc);
      }
      if (!buckets.size) return null;

      let best = null;
      for (const acc of buckets.values()) {
        if (!best || acc.w > best.w) best = acc;
      }
      return [best.r / best.w, best.g / best.w, best.b / best.w].map(Math.round);
    } catch {
      return null;   // tainted canvas, or getImageData blocked
    }
  }

  function colorFor(section) {
    const explicit = hexToRgb(section.dataset.tint);
    if (explicit) return explicit;
    const img = section.querySelector('[data-tint-source]');
    if (img && img.complete && img.naturalWidth) return dominantColor(img);
    return null;
  }

  /* ------------------------------------------------------------- scroll -- */

  function baseColors() {
    const s = getComputedStyle(document.documentElement);
    const read = (name, fallback) => (s.getPropertyValue(name) || s.getPropertyValue(fallback)).trim();
    return {
      bg: read('--bg-base', '--bg'),
      surface: read('--surface-base', '--surface'),
      theme: Site.activeTheme()
    };
  }

  function measure() {
    const { bg, surface, theme } = baseColors();
    const neutral = hexToRgb(bg) || [250, 250, 248];
    const neutralSurface = hexToRgb(surface) || neutral;

    sections = [...document.querySelectorAll('[data-ambient]')].map((el) => {
      const raw = colorFor(el);
      return {
        el,
        color: raw ? toTint(raw, theme) : neutral,
        surface: raw ? toSurfaceTint(raw, theme) : neutralSurface
      };
    });

    // Bookend with the untinted background so the page fades into colour as the
    // first block approaches and is fully back to neutral once the last one has
    // gone — rather than dragging a tint across the projects grid below.
    if (sections.length) {
      const rects = sections.map((s) => s.el.getBoundingClientRect());
      const margin = window.innerHeight * 0.55;
      const fadeIn = rects[0].top + window.scrollY - margin;
      const fadeOut = rects[rects.length - 1].bottom + window.scrollY + margin;

      sections.unshift({ el: null, anchor: Math.max(0, fadeIn), color: neutral, surface: neutralSurface });
      sections.push({ el: null, anchor: fadeOut, color: neutral, surface: neutralSurface });
    }

    if (mode === 'discrete') observeDiscrete();
    else update();
  }

  function anchorOf(entry) {
    if (entry.el) {
      const r = entry.el.getBoundingClientRect();
      return r.top + window.scrollY + r.height / 2;
    }
    return entry.anchor;
  }

  function paint(color, surface) {
    const root = document.documentElement.style;
    root.setProperty('--bg', css(color));
    root.setProperty('--surface', css(surface));
  }

  /* Reduced motion: no scroll coupling. Whichever section is most on screen
     owns the tint, and the body's own transition eases between them. */
  function observeDiscrete() {
    if (observer) observer.disconnect();
    const neutral = sections.find((s) => !s.el);
    const tinted = sections.filter((s) => s.el);
    if (!tinted.length || !('IntersectionObserver' in window)) return;

    /* The root is squeezed to a band across the middle of the viewport, so
       "which section is the reader looking at" is decided by how much of that
       band a section covers. Using intersectionRatio instead would fail for any
       section taller than the viewport, which can never reach a high ratio. */
    const covered = new Map();
    observer = new IntersectionObserver((entries) => {
      entries.forEach((e) =>
        covered.set(e.target, e.isIntersecting ? e.intersectionRect.height : 0));

      let best = null, bestHeight = 0;
      for (const [el, height] of covered) {
        if (height > bestHeight) { bestHeight = height; best = el; }
      }
      const chosen = (best && tinted.find((s) => s.el === best)) || neutral;
      if (chosen) paint(chosen.color, chosen.surface);
    }, { rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.01, 0.5, 1] });

    tinted.forEach((s) => observer.observe(s.el));
  }

  function update() {
    ticking = false;
    if (mode !== 'scroll' || sections.length < 2) return;

    const focus = window.scrollY + window.innerHeight / 2;
    const points = sections
      .map((s) => ({ at: anchorOf(s), color: s.color, surface: s.surface }))
      .sort((a, b) => a.at - b.at);

    let color, surface;
    if (focus <= points[0].at) {
      ({ color, surface } = points[0]);
    } else if (focus >= points[points.length - 1].at) {
      ({ color, surface } = points[points.length - 1]);
    } else {
      let i = 0;
      while (i < points.length - 1 && points[i + 1].at < focus) i++;
      const a = points[i], b = points[i + 1];
      const t = (focus - a.at) / Math.max(1, b.at - a.at);
      color = mix(a.color, b.color, t);
      surface = mix(a.surface, b.surface, t);
    }

    paint(color, surface);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  /* --------------------------------------------------------------- init -- */

  function init() {
    if (!document.querySelector('[data-ambient]')) return;

    // Reduced motion keeps the colour but drops the scroll coupling: the tint
    // is the point of the page, the continuous repaint is what's uncomfortable.
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyPreference = () => {
      mode = calm.matches ? 'discrete' : 'scroll';
      if (observer) { observer.disconnect(); observer = null; }
      measure();
    };
    applyPreference();
    calm.addEventListener('change', applyPreference);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);

    // Covers may still be decoding when this first runs.
    document.querySelectorAll('[data-tint-source]').forEach((img) => {
      if (!img.complete) img.addEventListener('load', measure, { once: true });
    });

    // The theme toggle changes which lightness band tints must land in.
    const toggle = document.querySelector('.theme-toggle');
    if (toggle) toggle.addEventListener('click', () => setTimeout(measure, 0));
  }

  return { init, measure, dominantColor, toTint };
})();
