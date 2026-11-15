/*
 * The French Country Club — a tiny, safe Markdown renderer.
 *
 * Supports: ## and ### headings, **bold**, *italic*, > quotes, - lists,
 * [links](url), and ![caption](photo) on its own line for a full-width photo.
 *
 * Safety: every piece of text is HTML-escaped BEFORE any formatting is applied,
 * so nothing typed into a story can become HTML. Links are only allowed to
 * http(s), mailto, in-page (#...) and relative addresses.
 *
 * Shared by the public site (index.html) and the admin (admin.html).
 */
(function (global) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Returns a safe URL string, or '' when the URL is not allowed.
  // Works on the raw (unescaped) URL; the caller escapes the result.
  function safeUrl(url) {
    var u = String(url == null ? '' : url).trim();
    if (!u) return '';
    // Remove control characters and whitespace that browsers ignore inside schemes.
    var probe = u.replace(/[\u0000- \u007f-\u009f]/g, '');
    if (/^(https?:|mailto:)/i.test(probe)) return u;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(probe)) return ''; // javascript:, data:, vbscript: ...
    if (/^\\/.test(probe)) return '';
    return u; // relative path, #anchor, /path, //host
  }

  function isExternal(url) {
    return /^(https?:)?\/\//i.test(url);
  }

  // Inline formatting. Input is raw text; output is safe HTML.
  function inline(text) {
    // Pull links out first so their URLs are not touched by bold/italic rules.
    var links = [];
    var src = String(text).replace(/\u0000/g, '').replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (m, label, url) {
      links.push({ label: label, url: url });
      return '\u0000' + (links.length - 1) + '\u0000';
    });
    var out = format(escapeHtml(src));
    return out.replace(/\u0000(\d+)\u0000/g, function (m, i) {
      var link = links[+i];
      var url = safeUrl(link.url);
      var label = format(escapeHtml(link.label));
      if (!url) return label;
      var attrs = isExternal(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return '<a href="' + escapeHtml(url) + '"' + attrs + '>' + label + '</a>';
    });
  }

  // Bold and italic on already-escaped text.
  function format(escaped) {
    return escaped
      .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?![*\w])/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_(?=\S)([^_]*?\S)_(?![_\w])/g, '$1<em>$2</em>');
  }

  /**
   * render(markdown, options)
   *   options.photo(ref) -> { src, caption, credit } | null
   *       Resolves the target of ![caption](ref). ref may be a photo id or a path.
   *   options.imageUrl(src) -> string   (optional) turns a stored src into a usable URL.
   */
  function render(md, options) {
    options = options || {};
    var lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
    var html = [];
    var para = [];
    var list = null;
    var quote = null;

    function flushPara() {
      if (para.length) {
        html.push('<p>' + para.map(inline).join('<br>') + '</p>');
        para = [];
      }
    }
    function flushList() {
      if (list) {
        html.push('<ul>' + list.map(function (li) { return '<li>' + inline(li) + '</li>'; }).join('') + '</ul>');
        list = null;
      }
    }
    function flushQuote() {
      if (quote) {
        var body = quote.join('\n').split(/\n\s*\n/).map(function (p) {
          return '<p>' + p.split('\n').map(inline).join('<br>') + '</p>';
        }).join('');
        html.push('<blockquote>' + body + '</blockquote>');
        quote = null;
      }
    }
    function flushAll() { flushPara(); flushList(); flushQuote(); }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();
      var m;

      if (!trimmed) {
        flushPara(); flushList();
        // A blank line inside a quote only ends it if the next line is not a quote line.
        if (quote && !(lines[i + 1] && /^\s*>/.test(lines[i + 1]))) flushQuote();
        else if (quote) quote.push('');
        continue;
      }

      if ((m = /^(#{2,3})\s+(.+?)\s*#*$/.exec(trimmed))) {
        flushAll();
        var tag = m[1].length === 2 ? 'h2' : 'h3';
        html.push('<' + tag + '>' + inline(m[2]) + '</' + tag + '>');
        continue;
      }

      if ((m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(trimmed))) {
        flushAll();
        html.push(figure(m[1], m[2], options));
        continue;
      }

      if ((m = /^>\s?(.*)$/.exec(trimmed))) {
        flushPara(); flushList();
        if (!quote) quote = [];
        quote.push(m[1]);
        continue;
      }

      if ((m = /^[-*]\s+(.+)$/.exec(trimmed))) {
        flushPara(); flushQuote();
        if (!list) list = [];
        list.push(m[1]);
        continue;
      }

      flushList(); flushQuote();
      para.push(trimmed);
    }
    flushAll();
    return html.join('\n');
  }

  function figure(caption, ref, options) {
    var photo = options.photo ? options.photo(ref) : null;
    // An unknown photo id (for example a deleted photo) renders nothing rather than a broken image.
    if (!photo && options.photo && !/[\/.]/.test(ref)) return '';
    var src = photo ? photo.src : ref;
    var safe = safeUrl(src);
    if (!safe) return '';
    var url = options.imageUrl ? options.imageUrl(safe) : safe;
    var cap = caption || (photo && photo.caption) || '';
    var credit = photo && photo.credit ? photo.credit : '';
    var out = '<figure class="md-figure"><img src="' + escapeHtml(url) + '" data-src="' + escapeHtml(safe) +
      '" alt="' + escapeHtml(cap) + '" loading="lazy" decoding="async">';
    if (cap || credit) {
      out += '<figcaption>' + (cap ? '<span class="cap">' + inline(cap) + '</span>' : '') +
        (credit ? ' <span class="credit">' + escapeHtml(credit) + '</span>' : '') + '</figcaption>';
    }
    return out + '</figure>';
  }

  function plainText(md) {
    return String(md || '')
      .replace(/^!\[[^\]]*\]\([^)]*\)$/gm, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readingMinutes(md) {
    var words = plainText(md).split(' ').filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  }

  global.FCCMarkdown = {
    render: render,
    inline: inline,
    escapeHtml: escapeHtml,
    safeUrl: safeUrl,
    plainText: plainText,
    readingMinutes: readingMinutes
  };
})(typeof window !== 'undefined' ? window : globalThis);
