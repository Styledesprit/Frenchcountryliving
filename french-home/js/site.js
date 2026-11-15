/* The French Country Club — public site.
 * Reads content/site.json and draws one of these views from the address after #:
 *   #/                 home
 *   #/journal          all stories      #/journal/<category-id>  one category
 *   #/article/<slug>   one story
 *   #/gallery          photo gallery
 *   #/about            about the club
 *   #/credits          photo credits
 */
(function () {
  'use strict';

  var MD = window.FCCMarkdown;
  var esc = MD.escapeHtml;
  var data = null;
  var T = window.FCCLabels.make();   // the site's wording; replaced once site.json is loaded
  var main = document.getElementById('main');
  var lightboxList = [];
  var lightboxIndex = 0;
  var lastFocus = null;

  // ---------- helpers ----------

  function published() {
    return (data.articles || [])
      .filter(function (a) { return a.status !== 'draft'; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
  }

  function photo(ref) {
    if (!ref) return null;
    var list = data.photos || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === ref) return list[i];
    for (var j = 0; j < list.length; j++) if (list[j].src === ref) return list[j];
    if (/\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(ref)) return { src: ref, caption: '', credit: '' };
    return null;
  }

  // In the admin's Preview tab, photos uploaded but not yet published are shown from the
  // admin's memory (blob: URLs). imageMap maps a stored src to such a URL.
  var imageMap = {};
  function url(src) {
    var s = MD.safeUrl(src);
    return (s && imageMap[s]) || s;
  }

  function category(id) {
    return (data.categories || []).filter(function (c) { return c.id === id; })[0] || null;
  }

  function img(ref, opts) {
    opts = opts || {};
    var p = photo(ref);
    if (!p || !MD.safeUrl(p.src)) return '<div class="ph" aria-hidden="true"></div>';
    return '<img src="' + esc(url(p.src)) + '" alt="' + esc(opts.alt != null ? opts.alt : (p.caption || '')) + '"' +
      (opts.eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async">';
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return esc(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function catLabel(a, asLink) {
    var c = category(a.category);
    if (!c) return '';
    return asLink
      ? '<a class="kicker" href="#/journal/' + encodeURIComponent(c.id) + '">' + esc(c.name) + '</a>'
      : '<span class="kicker">' + esc(c.name) + '</span>';
  }

  function articleHref(a) { return '#/article/' + encodeURIComponent(a.slug); }

  function card(a) {
    return '<a class="card" href="' + articleHref(a) + '">' +
      '<div class="ratio r-3x2">' + img(a.cover, { alt: '' }) + '</div>' +
      catLabel(a) +
      '<h3>' + esc(a.title) + '</h3>' +
      (a.dek ? '<p>' + esc(a.dek) + '</p>' : '') +
      '<div class="meta">' + fmtDate(a.date) + '<span class="dot">·</span>' + MD.readingMinutes(a.body) + ' ' + esc(T('minRead')) + '</div>' +
      '</a>';
  }

  function setTitle(t) {
    document.title = t ? t + ' — ' + data.site.name : data.site.name + ' — ' + data.site.tagline;
  }

  // ---------- views ----------

  function viewHome() {
    var list = published();
    if (!list.length) return '<div class="wrap"><p class="empty">' + esc(T('noStories')) + '</p></div>';
    var hero = list.filter(function (a) { return a.featured; })[0] || list[0];
    var rest = list.filter(function (a) { return a !== hero; });
    var latest = rest.slice(0, 3);
    var feature = rest[3];
    var more = rest.slice(4, 10);
    var strip = (data.photos || []).filter(function (p) { return p.gallery; }).slice(0, 6);
    var s = data.site;
    var html = '';

    html += '<section class="hero">' +
      '<div class="hero-media">' + img(hero.cover, { eager: true, alt: '' }) + '</div>' +
      '<div class="hero-text"><div class="wrap">' +
      catLabel(hero) +
      '<h1><a href="' + articleHref(hero) + '">' + esc(hero.title) + '</a></h1>' +
      (hero.dek ? '<p class="dek">' + esc(hero.dek) + '</p>' : '') +
      '<a class="btn" href="' + articleHref(hero) + '">' + esc(T('heroButton')) + '</a>' +
      '</div></div></section>';

    if (latest.length) {
      html += '<section class="section wrap"><div class="section-head"><h2>' + esc(T('latestTitle')) + '</h2>' +
        '<a href="#/journal">' + esc(T('latestLink')) + '</a></div><div class="cards">' + latest.map(card).join('') + '</div></section>';
    }

    if ((data.categories || []).length) {
      html += '<section class="section wrap"><div class="section-head"><h2>' + esc(T('exploreTitle')) + '</h2></div><div class="tiles">' +
        data.categories.map(function (c) {
          return '<a class="tile" href="#/journal/' + encodeURIComponent(c.id) + '"><div class="ratio">' + img(c.photo, { alt: '' }) + '</div>' +
            '<div class="tile-text"><strong>' + esc(c.name) + '</strong>' + (c.blurb ? '<span>' + esc(c.blurb) + '</span>' : '') + '</div></a>';
        }).join('') + '</div></section>';
    }

    if (feature) {
      html += '<section class="section wrap"><a class="feature" href="' + articleHref(feature) + '">' +
        '<div class="ratio">' + img(feature.cover, { alt: '' }) + '</div>' +
        '<div class="feature-text">' + catLabel(feature) + '<h2>' + esc(feature.title) + '</h2>' +
        (feature.dek ? '<p class="dek">' + esc(feature.dek) + '</p>' : '') +
        '<div class="meta">' + fmtDate(feature.date) + '<span class="dot">·</span>' + MD.readingMinutes(feature.body) + ' ' + esc(T('minRead')) + '</div>' +
        '</div></a></section>';
    }

    if (s.quote) {
      html += '<section class="pull"><blockquote>' + esc(s.quote) + '</blockquote>' +
        (s.quoteBy ? '<cite>' + esc(s.quoteBy) + '</cite>' : '') + '</section>';
    }

    if (more.length) {
      html += '<section class="section wrap"><div class="section-head"><h2>' + esc(T('moreTitle')) + '</h2>' +
        '<a href="#/journal">' + esc(T('moreLink')) + '</a></div><div class="cards">' + more.map(card).join('') + '</div></section>';
    }

    if (strip.length) {
      html += '<section class="section wrap"><div class="section-head"><h2>' + esc(T('stripTitle')) + '</h2>' +
        '<a href="#/gallery">' + esc(T('stripLink')) + '</a></div><div class="strip">' +
        strip.map(function (p) {
          return '<a href="#/gallery" aria-label="' + esc(p.caption || 'Open the gallery') + '"><div class="ratio r-1x1">' + img(p.id) + '</div></a>';
        }).join('') + '</div></section>';
    }
    setTitle('');
    return html;
  }

  function viewJournal(catId) {
    var c = catId ? category(catId) : null;
    var list = published().filter(function (a) { return !catId || a.category === catId; });
    var head = c
      ? '<div class="page-head wrap"><span class="kicker">' + esc(T('journalKicker')) + '</span><h1>' + esc(c.name) + '</h1>' + (c.blurb ? '<p>' + esc(c.blurb) + '</p>' : '') + '</div>'
      : '<div class="page-head wrap"><span class="kicker">' + esc(data.site.name) + '</span><h1>' + esc(T('journalTitle')) + '</h1><p>' + esc(T('journalIntro')) + '</p></div>';
    var filters = '<ul class="filters"><li><a href="#/journal"' + (!catId ? ' aria-current="true"' : '') + '>' + esc(T('allStories')) + '</a></li>' +
      (data.categories || []).map(function (x) {
        return '<li><a href="#/journal/' + encodeURIComponent(x.id) + '"' + (x.id === catId ? ' aria-current="true"' : '') + '>' + esc(x.name) + '</a></li>';
      }).join('') + '</ul>';
    setTitle(c ? c.name : T('journalTitle'));
    if (catId && !c) return viewNotFound();
    return head + '<div class="wrap">' + filters +
      (list.length ? '<div class="cards">' + list.map(card).join('') + '</div>' : '<p class="empty">' + esc(T('emptyCategory')) + '</p>') +
      '</div>';
  }

  function viewArticle(slug) {
    var list = published();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) { idx = i; break; }
    if (idx < 0) return viewNotFound();
    var a = list[idx];
    var cover = photo(a.cover);
    var newer = list[idx - 1];
    var older = list[idx + 1];
    var related = list.filter(function (x) { return x !== a && x.category === a.category; });
    list.forEach(function (x) { if (x !== a && related.indexOf(x) < 0) related.push(x); });
    related = related.slice(0, 3);

    var body = MD.render(a.body, { photo: photo, imageUrl: url });
    setTitle(a.title);
    return '<article>' +
      (cover ? '<figure class="article-cover"><div class="img-wrap">' + img(a.cover, { eager: true }) + '</div>' +
        ((cover.caption || cover.credit) ? '<figcaption class="figcap">' + (cover.caption ? '<span class="cap">' + esc(cover.caption) + '</span>' : '') +
          (cover.credit ? ' <span class="credit">' + esc(cover.credit) + '</span>' : '') + '</figcaption>' : '') + '</figure>' : '') +
      '<header class="article-head">' + catLabel(a, true) + '<h1>' + esc(a.title) + '</h1>' +
      (a.dek ? '<p class="dek">' + esc(a.dek) + '</p>' : '') +
      '<div class="meta">' + (a.author ? esc(T('byline')) + ' ' + esc(a.author) + '<span class="dot">·</span>' : '') +
      '<time datetime="' + esc(a.date) + '">' + fmtDate(a.date) + '</time><span class="dot">·</span>' + MD.readingMinutes(a.body) + ' ' + esc(T('minRead')) + '</div></header>' +
      '<div class="prose">' + body + '</div>' +
      '<div class="article-foot"><div class="byline-box">' + esc(T('shareLine')) + ' ' +
      (data.site.email ? '<a href="mailto:' + esc(data.site.email) + '">' + esc(T('shareLink')) + '</a>.' : esc(T('shareLink')) + '.') + '</div>' +
      '<nav class="prevnext" aria-label="More stories">' +
      (older ? '<a class="prev" href="' + articleHref(older) + '"><span>&larr; ' + esc(T('prevStory')) + '</span><strong>' + esc(older.title) + '</strong></a>' : '<div class="blank"></div>') +
      (newer ? '<a class="next" href="' + articleHref(newer) + '"><span>' + esc(T('nextStory')) + ' &rarr;</span><strong>' + esc(newer.title) + '</strong></a>' : '<div class="blank"></div>') +
      '</nav></div></article>' +
      (related.length ? '<section class="section wrap"><div class="section-head"><h2>' + esc(T('relatedTitle')) + '</h2><a href="#/journal">' + esc(T('latestLink')) + '</a></div>' +
        '<div class="cards">' + related.map(card).join('') + '</div></section>' : '');
  }

  function galleryPhotos() {
    return (data.photos || []).filter(function (p) { return p.gallery && MD.safeUrl(p.src); });
  }

  function viewGallery() {
    var list = galleryPhotos();
    setTitle(T('galleryTitle'));
    return '<div class="page-head wrap"><span class="kicker">' + esc(data.site.name) + '</span><h1>' + esc(T('galleryTitle')) + '</h1>' +
      (data.site.galleryIntro ? '<p>' + esc(data.site.galleryIntro) + '</p>' : '') + '</div>' +
      '<div class="wrap">' + (list.length ? '<div class="masonry">' + list.map(function (p, i) {
        return '<button type="button" data-lb="' + i + '" aria-label="View larger: ' + esc(p.caption || 'photo') + '">' + img(p.id) +
          (p.caption ? '<span class="g-cap">' + esc(p.caption) + '</span>' : '') + '</button>';
      }).join('') + '</div>' : '<p class="empty">' + esc(T('noPhotos')) + '</p>') + '</div>';
  }

  function viewAbout() {
    var s = data.site;
    var p = photo(s.aboutPhoto);
    setTitle(s.aboutTitle || T('aboutKicker'));
    return '<div class="page-head wrap"><span class="kicker">' + esc(T('aboutKicker')) + '</span><h1>' + esc(s.aboutTitle || 'About the club') + '</h1>' +
      (s.description ? '<p>' + esc(s.description) + '</p>' : '') + '</div>' +
      (p ? '<figure class="about-photo">' + img(s.aboutPhoto, { eager: true }) +
        (p.caption || p.credit ? '<figcaption>' + esc(p.caption || '') + (p.credit ? ' · ' + esc(p.credit) : '') + '</figcaption>' : '') + '</figure>' : '') +
      '<div class="prose">' + MD.render(s.about, { photo: photo, imageUrl: url }) + '</div>' +
      '<aside class="write-in"><h2>' + esc(T('writeInTitle')) + '</h2><p>' + esc(T('writeInText')) +
      (s.email ? ' Write to <a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a>' : '') +
      (s.instagram ? (s.email ? ' or' : '') + ' find us on Instagram at <a href="https://www.instagram.com/' + esc(encodeURIComponent(s.instagram.replace(/^@/, ''))) + '/" target="_blank" rel="noopener noreferrer">@' + esc(s.instagram.replace(/^@/, '')) + '</a>' : '') +
      '.</p></aside>';
  }

  function viewCredits() {
    setTitle(T('creditsTitle'));
    var list = (data.photos || []).filter(function (p) { return MD.safeUrl(p.src); });
    return '<div class="page-head wrap"><span class="kicker">' + esc(data.site.name) + '</span><h1>' + esc(T('creditsTitle')) + '</h1>' +
      '<p>' + esc(T('creditsIntro')) + '</p></div>' +
      '<ul class="credits wrap">' + list.map(function (p) {
        var src = MD.safeUrl(p.sourceUrl);
        return '<li><div class="ratio">' + img(p.id, { alt: '' }) + '</div><div>' +
          '<h3>' + esc(p.caption || 'Untitled') + '</h3>' +
          '<p>' + (p.credit ? 'Photo: ' + esc(p.credit) : 'Photo: the club') + (p.license ? ' · Licence: ' + esc(p.license) : '') + '</p>' +
          (src ? '<p><a href="' + esc(src) + '" target="_blank" rel="noopener noreferrer">Source</a></p>' : '') +
          '</div></li>';
      }).join('') + '</ul>';
  }

  function viewNotFound() {
    setTitle(T('notFoundTitle'));
    return '<div class="page-head wrap"><h1>' + esc(T('notFoundTitle')) + '</h1><p>' + esc(T('notFoundText')) + '</p>' +
      '<p style="margin-top:28px"><a class="btn" href="#/">' + esc(T('notFoundButton')) + '</a></p></div>';
  }

  // ---------- chrome ----------

  function drawNav(route) {
    var hidden = data.site.menuHidden || [];
    var items = [{ href: '#/', label: T('navHome'), key: 'home' }]
      .concat((data.categories || []).map(function (c) { return { href: '#/journal/' + encodeURIComponent(c.id), label: c.name, key: 'cat:' + c.id }; }))
      .concat([{ href: '#/gallery', label: T('navGallery'), key: 'gallery' }, { href: '#/about', label: T('navAbout'), key: 'about' }])
      .filter(function (it) { return hidden.indexOf(it.key) < 0; });
    var current = route.name === 'home' ? 'home' : route.name === 'journal' && route.arg ? 'cat:' + route.arg :
      route.name === 'article' ? 'cat:' + ((published().filter(function (a) { return a.slug === route.arg; })[0] || {}).category) : route.name;
    document.getElementById('nav-list').innerHTML = items.map(function (it) {
      return '<li><a href="' + it.href + '"' + (it.key === current ? ' aria-current="page"' : '') + '>' + esc(it.label) + '</a></li>';
    }).join('');
  }

  function drawFooter() {
    var s = data.site;
    var ig = s.instagram ? s.instagram.replace(/^@/, '') : '';
    document.getElementById('footer').innerHTML = '<div class="wrap"><div class="footer-grid">' +
      '<div><p class="f-name">' + esc(s.name) + '</p><p class="f-tag">' + esc(s.tagline) + '</p><p>' + esc(s.description || '') + '</p></div>' +
      '<div><h2>' + esc(T('footerJournal')) + '</h2><ul>' + (data.categories || []).map(function (c) {
        return '<li><a href="#/journal/' + encodeURIComponent(c.id) + '">' + esc(c.name) + '</a></li>';
      }).join('') + '<li><a href="#/gallery">' + esc(T('navGallery')) + '</a></li></ul></div>' +
      '<div><h2>' + esc(T('footerContact')) + '</h2><ul>' +
      (s.email ? '<li><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></li>' : '') +
      (ig ? '<li><a href="https://www.instagram.com/' + esc(encodeURIComponent(ig)) + '/" target="_blank" rel="noopener noreferrer">Instagram @' + esc(ig) + '</a></li>' : '') +
      '<li><a href="#/about">' + esc(T('footerAbout')) + '</a></li>' +
      '<li><a href="#/credits">' + esc(T('footerCredits')) + '</a></li></ul></div>' +
      '</div><div class="footer-bottom"><span>&copy; ' + new Date().getFullYear() + ' ' + esc(s.name) + (s.author ? ' · ' + esc(s.author) : '') + '</span>' +
      '<span><a href="#/credits">' + esc(T('footerCredits')) + '</a> · <a href="login/">' + esc(T('footerAdmin')) + '</a></span></div></div>';
  }

  function parseRoute() {
    var h = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
    var parts = h.split('/').filter(Boolean);
    var name = parts[0] || 'home';
    return { name: name, arg: parts.slice(1).join('/') };
  }

  function route() {
    var r = parseRoute();
    var html;
    switch (r.name) {
      case 'home': html = viewHome(); break;
      case 'journal': html = viewJournal(r.arg); break;
      case 'article': html = viewArticle(r.arg); break;
      case 'gallery': html = viewGallery(); break;
      case 'about': html = viewAbout(); break;
      case 'credits': html = viewCredits(); break;
      default: html = viewNotFound();
    }
    main.innerHTML = html;
    drawNav(r);
    closeMenu();
    window.scrollTo(0, 0);
    if (r.name === 'gallery') lightboxList = galleryPhotos();
  }

  document.querySelector('.skip-link').addEventListener('click', function (e) {
    e.preventDefault();
    main.focus();
  });

  // ---------- menu ----------

  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  function closeMenu() { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
  toggle.addEventListener('click', function () {
    var open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  // ---------- lightbox ----------

  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lb-img');
  var lbCap = document.getElementById('lb-cap');
  var lbCount = document.getElementById('lb-count');

  function showLightbox(i) {
    if (!lightboxList.length) return;
    lightboxIndex = (i + lightboxList.length) % lightboxList.length;
    var p = lightboxList[lightboxIndex];
    lbImg.src = url(p.src);
    lbImg.alt = p.caption || '';
    lbCap.innerHTML = esc(p.caption || '') + (p.credit ? '<small>' + esc(p.credit) + (p.license ? ' · ' + esc(p.license) : '') + '</small>' : '');
    lbCount.textContent = (lightboxIndex + 1) + ' / ' + lightboxList.length;
  }
  function openLightbox(i) {
    lastFocus = document.activeElement;
    lb.hidden = false;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    showLightbox(i);
    lb.querySelector('.lb-close').focus();
  }
  function closeLightbox() {
    lb.classList.remove('open');
    lb.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  main.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lb]');
    if (b) openLightbox(+b.getAttribute('data-lb'));
  });
  lb.querySelector('.lb-close').addEventListener('click', closeLightbox);
  lb.querySelector('.lb-prev').addEventListener('click', function () { showLightbox(lightboxIndex - 1); });
  lb.querySelector('.lb-next').addEventListener('click', function () { showLightbox(lightboxIndex + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'FIGURE') closeLightbox(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('open')) {
      if (e.key === 'Escape') closeMenu();
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); showLightbox(lightboxIndex - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); showLightbox(lightboxIndex + 1); }
    else if (e.key === 'Tab') {
      var f = Array.prototype.slice.call(lb.querySelectorAll('button'));
      var at = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });

  // ---------- start ----------

  function fillStatic() {
    document.getElementById('menu-label').textContent = T('menuButton');
    document.querySelectorAll('[data-site]').forEach(function (el) {
      var v = data.site[el.getAttribute('data-site')];
      if (v) el.textContent = v;
    });
    document.getElementById('masthead-date').textContent =
      new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    var meta = document.querySelector('meta[name="description"]');
    if (meta && data.site.description) meta.setAttribute('content', data.site.description);
  }

  // Maintenance mode: switched on from the admin (Site settings). Visitors see only a notice.
  // Adding ?preview to the address shows the site anyway (handy for the editor; it is not a password).
  function showMaintenance() {
    document.body.classList.add('maintenance');
    var robots = document.createElement('meta');
    robots.name = 'robots'; robots.content = 'noindex';
    document.head.appendChild(robots);
    document.title = data.site.name + ' — ' + T('maintTitle');
    main.innerHTML = '<div class="page-head wrap maintenance-note"><span class="kicker">' + esc(data.site.name) + '</span>' +
      '<h1>' + esc(T('maintTitle')) + '</h1><p>' + esc(data.site.maintenanceMessage ||
        'The shutters are closed for a little while as we tidy the house. Please come back soon.') + '</p>' +
      (data.site.email ? '<p class="maint-contact"><a href="mailto:' + esc(data.site.email) + '">' + esc(data.site.email) + '</a></p>' : '') + '</div>';
  }

  var started = false;
  function start(json, ignoreMaintenance) {
    data = json;
    data.site = data.site || {};
    T = window.FCCLabels.make(data.site.labels);
    fillStatic();
    if (data.site.maintenance && !ignoreMaintenance && !/[?&]preview(=|&|$)/.test(location.search)) { showMaintenance(); return; }
    drawFooter();
    var y = window.scrollY;
    route();
    if (started) window.scrollTo(0, y);   // a live preview refresh keeps the reader's place
    if (!started) window.addEventListener('hashchange', route);
    started = true;
  }

  // Admin preview: inside the admin's Preview tab the page shows the admin's unpublished
  // content, sent by the admin page (same site only), instead of content/site.json.
  if (/[?&]adminpreview(=|&|$)/.test(location.search) && window.parent !== window) {
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      var msg = e.data || {};
      if (msg.type !== 'fcc-preview-data' || !msg.data) return;
      imageMap = msg.images || {};
      start(msg.data, true);
    });
    window.parent.postMessage({ type: 'fcc-preview-ready' }, location.origin);
    return;
  }

  fetch('content/site.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (json) { start(json, false); })
    .catch(function (err) {
      main.innerHTML = '<div class="page-head wrap"><h1>The journal is resting</h1><p>The stories could not be loaded just now (' +
        esc(err.message) + '). Please try again in a moment.</p></div>';
    });
})();
