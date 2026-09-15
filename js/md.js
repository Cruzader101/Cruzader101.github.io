/* A small Markdown subset — enough for devlogs, with no dependency to vendor.
   Supports: headings, paragraphs, bold, italic, inline and fenced code,
   unordered and ordered lists, blockquotes, links, images, horizontal rules.

   HTML is escaped up front, so raw HTML in a post renders as text rather than
   executing. Link and image URLs are scheme-checked before reaching an href. */

const Markdown = (() => {
  'use strict';

  // Sentinel wrapping stashed code spans and fenced blocks. A control character,
  // so it cannot collide with anything a post legitimately contains.
  const NUL = String.fromCharCode(0);

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Allows http(s), mailto, fragments, and same-origin relative paths.
     Anything else — javascript:, data: — is dropped. */
  function safeUrl(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) return null;
    if (/^(https?:|mailto:|#|\/)/i.test(trimmed)) return trimmed;
    if (/^[\w./-]+$/.test(trimmed)) return trimmed;   // relative path
    return null;
  }

  function stash(store, html) {
    store.push(html);
    return NUL + (store.length - 1) + NUL;
  }

  function inline(text, store) {
    let out = text;

    // Inline code first, so emphasis markers inside it stay literal.
    out = out.replace(/`([^`\n]+)`/g, (_, code) => stash(store, `<code>${code}</code>`));

    // Images before links — the syntax differs only by the leading "!".
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, src) => {
      const url = safeUrl(src);
      return url ? `<img src="${url}" alt="${alt}" loading="lazy" decoding="async">` : match;
    });

    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => {
      const url = safeUrl(href);
      if (!url) return match;
      const external = /^https?:/i.test(url);
      return `<a href="${url}"${external ? ' rel="noopener"' : ''}>${label}</a>`;
    });

    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');

    return out;
  }

  function restore(html, store) {
    return html.replace(new RegExp(NUL + '(\\d+)' + NUL, 'g'), (_, i) => store[Number(i)]);
  }

  function render(source) {
    const escaped = escapeHtml(String(source).replace(/\r\n?/g, '\n'));
    const store = [];

    // Pull fenced blocks out whole, before any block-level splitting.
    const withoutFences = escaped.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const cls = lang ? ` class="language-${lang}"` : '';
      const token = stash(store, `<pre><code${cls}>${code.replace(/\n$/, '')}</code></pre>`);
      return `\n\n${token}\n\n`;
    });

    const html = withoutFences
      .split(/\n{2,}/)
      .map((block) => renderBlock(block.trim(), store))
      .filter(Boolean)
      .join('\n');

    return restore(html, store);
  }

  function renderBlock(block, store) {
    if (!block) return '';

    // A block that is only a stashed fence passes straight through.
    if (new RegExp('^' + NUL + '\\d+' + NUL + '$').test(block)) return block;

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(block)) return '<hr>';

    const heading = block.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      return `<h${level}>${inline(heading[2].trim(), store)}</h${level}>`;
    }

    const lines = block.split('\n');

    // Escaping has already run by this point, so the quote marker is "&gt;".
    if (lines.every((line) => /^&gt;\s?/.test(line))) {
      const inner = lines.map((l) => l.replace(/^&gt;\s?/, '')).join('\n');
      return `<blockquote>${renderBlock(inner.trim(), store)}</blockquote>`;
    }

    if (lines.every((line) => /^\s*[-*+]\s+/.test(line))) {
      const items = lines.map((l) => `<li>${inline(l.replace(/^\s*[-*+]\s+/, ''), store)}</li>`);
      return `<ul>${items.join('')}</ul>`;
    }

    if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
      const items = lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''), store)}</li>`);
      return `<ol>${items.join('')}</ol>`;
    }

    // Paragraph. Leading indent goes, but trailing spaces have to survive long
    // enough for the two-space line-break rule to see them.
    const body = lines
      .map((l) => l.replace(/^\s+/, ''))
      .join('\n')
      .replace(/ {2,}\n/g, '<br>\n')
      .trim();
    return `<p>${inline(body, store)}</p>`;
  }

  return { render };
})();
