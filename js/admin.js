/* The French Country Club — admin.
 *
 * Edits content/site.json and photos in the browser, then publishes everything to
 * GitHub as ONE commit with the Git Data API (blobs → tree → commit → move branch).
 * There is no server: the GitHub token stays in this browser and is only sent to api.github.com.
 */
(function () {
  'use strict';

  const MD = window.FCCMarkdown;
  const esc = MD.escapeHtml;
  const API = 'https://api.github.com';
  const STORE_KEY = 'fcc-admin-auth';
  const MAX_PX = 2000;
  const JPEG_QUALITY = 0.85;

  const state = {
    mode: null,            // 'github' | 'preview'
    auth: null,            // { token, repo, branch, folder }
    data: null,            // working copy of site.json
    base: null,            // site.json as last loaded/published (for counting changes)
    baseSha: null,         // blob sha of site.json on GitHub when loaded/published
    newPhotos: new Map(),  // src -> Blob, uploaded but not yet published
    deleted: new Set(),    // repo-relative src of published photos to delete
    localUrls: new Map(),  // src -> object URL, so fresh photos show before GitHub Pages rebuilds
    tab: 'articles',
    previewMode: 'edits',  // 'edits' (unpublished, from the admin) | 'live' (what is published)
    previewDevice: 'desktop',
    editing: null,         // article id being edited
    search: '',
    slugFollowsTitle: new Set(),
    busy: false
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const view = () => $('#view');

  // ===================================================================
  // Small helpers
  // ===================================================================

  function slugify(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'untitled';
  }

  function randomId(n) {
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    const buf = new Uint8Array(n || 4);
    crypto.getRandomValues(buf);
    buf.forEach((b) => { out += chars[b % chars.length]; });
    return out;
  }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fmtDate(iso) {
    if (!iso) return 'No date';
    const d = new Date(iso + 'T12:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  let toastTimer;
  function toast(msg, isError) {
    let el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.toggle('err', !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 7000 : 3500);
  }

  // ---------- modal dialogs ----------

  function modal(html, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'modal-back';
      back.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
      const prevFocus = document.activeElement;
      document.body.appendChild(back);
      const box = $('.modal', back);
      function close(value) {
        document.removeEventListener('keydown', onKey, true);
        back.remove();
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        resolve(value);
      }
      function onKey(e) {
        if (e.key === 'Escape' && !opts.locked) { e.preventDefault(); e.stopPropagation(); close(null); }
      }
      document.addEventListener('keydown', onKey, true);
      back.addEventListener('click', (e) => { if (e.target === back && !opts.locked) close(null); });
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-close]');
        if (b) close(b.getAttribute('data-close'));
      });
      if (opts.setup) opts.setup(box, close);
      const first = $('[autofocus]', box) || $('input, textarea, select', box) || $('.btns button:last-child', box);
      if (first) first.focus();
    });
  }

  function confirmBox(title, bodyHtml, okLabel, danger) {
    return modal('<h2>' + esc(title) + '</h2>' + bodyHtml +
      '<div class="btns"><button type="button" data-close="no">Cancel</button>' +
      '<button type="button" class="' + (danger ? 'danger' : 'primary') + '" data-close="yes">' + esc(okLabel || 'OK') + '</button></div>')
      .then((v) => v === 'yes');
  }

  function alertBox(title, bodyHtml) {
    return modal('<h2>' + esc(title) + '</h2>' + bodyHtml + '<div class="btns"><button type="button" class="primary" data-close="ok">OK</button></div>');
  }

  function promptBox(title, label, value, hint) {
    return modal('<h2>' + esc(title) + '</h2><form><div class="field"><label for="pb-in">' + esc(label) + '</label>' +
      '<input type="text" id="pb-in" value="' + esc(value || '') + '" autofocus>' + (hint ? '<p class="hint">' + esc(hint) + '</p>' : '') + '</div>' +
      '<div class="btns"><button type="button" data-close="">Cancel</button><button type="submit" class="primary">OK</button></div></form>', {
      setup(box, close) {
        $('form', box).addEventListener('submit', (e) => { e.preventDefault(); close('=' + $('#pb-in', box).value); });
      }
    }).then((v) => (v && v.charAt(0) === '=' ? v.slice(1) : null));
  }

  // ===================================================================
  // Signing in
  // ===================================================================

  function detectRepo() {
    const m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
    const segs = location.pathname.split('/').filter(Boolean);
    if (segs.length && /\.html?$/i.test(segs[segs.length - 1])) segs.pop();
    if (!m) {
      // Elsewhere (Hostinger, your own domain, localhost): use the repository named in admin.html.
      const repo = (document.querySelector('meta[name="fcc-repo"]') || {}).content;
      const folder = (document.querySelector('meta[name="fcc-folder"]') || {}).content;
      return repo ? { repo, folder: folder != null ? folder : 'french-home/', fromMeta: true } : null;
    }
    if (!segs.length) return { repo: m[1] + '/' + m[1] + '.github.io', folder: '' };
    return { repo: m[1] + '/' + segs[0], folder: segs.slice(1).map((s) => s + '/').join('') };
  }

  function normFolder(f) {
    f = String(f || '').trim().replace(/^\/+/, '');
    if (f && !f.endsWith('/')) f += '/';
    return f;
  }

  function savedAuth() {
    for (const store of [localStorage, sessionStorage]) {
      try {
        const v = store.getItem(STORE_KEY);
        if (v) return JSON.parse(v);
      } catch (e) { /* storage unavailable */ }
    }
    return null;
  }

  function saveAuth(auth, remember) {
    try {
      localStorage.removeItem(STORE_KEY);
      sessionStorage.removeItem(STORE_KEY);
      (remember ? localStorage : sessionStorage).setItem(STORE_KEY, JSON.stringify(auth));
    } catch (e) { /* storage unavailable: stay signed in for this page only */ }
  }

  function clearAuth() {
    try { localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
  }

  function showSignin(errorMsg) {
    $('#app').hidden = true;
    $('#signin').hidden = false;
    const det = detectRepo();
    const saved = savedAuth();
    const err = $('#signin-error');
    err.hidden = !errorMsg;
    err.textContent = errorMsg || '';
    if (showSignin.filled) return;   // keep whatever the person has typed
    showSignin.filled = true;
    $('#repo').value = (saved && saved.repo) || (det && det.repo) || '';
    $('#folder').value = (saved && saved.folder != null ? saved.folder : det ? det.folder : 'french-home/');
    $('#branch').value = (saved && saved.branchChosen) || '';
    $('#repo-hint').textContent = det && det.fromMeta
      ? 'Filled in from the site’s settings. Change it only if it is wrong.'
      : det ? 'Found automatically from this page’s address. Change it only if it is wrong.'
      : 'Type it as owner/repository, e.g. jane/french-country-club.';
    if ($('#repo').value) $('#repo-name-step').textContent = $('#repo').value;
    else $('#more-options').open = true;   // nothing detected: the repository must be typed
    updateTokenLink();
  }

  // A link to GitHub's "new token" page with the name, owner and permission filled in.
  function updateTokenLink() {
    const repo = $('#repo').value.trim();
    const owner = repo.split('/')[0];
    const params = new URLSearchParams({
      name: 'French Country Club admin',
      description: 'Lets thefrenchcountryclub admin page publish to ' + (repo || 'the site repository'),
      expires_in: '365',
      contents: 'write'
    });
    if (owner) params.set('target_name', owner);
    $('#make-token').href = 'https://github.com/settings/personal-access-tokens/new?' + params.toString();
  }

  async function signIn(auth, remember, quiet) {
    const btn = $('#signin-btn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const info = await gh('GET', '/repos/' + auth.repo, null, auth);
      auth.branch = auth.branchChosen || info.default_branch;
      state.auth = auth;
      state.mode = 'github';
      await loadFromGitHub();
      saveAuth(auth, remember);
      startApp();
    } catch (e) {
      state.auth = null;
      if (quiet && e.status === 401) clearAuth();
      showSignin(friendlyError(e, auth));
    } finally {
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  }

  function friendlyError(e, auth) {
    if (e.status === 401) return 'GitHub did not accept that key. It may be mistyped, expired or deleted — make a new one with “First time here?” below.';
    if (e.status === 404) return 'GitHub could not find ' + (auth ? '“' + auth.repo + '”' : 'the repository') +
      ' with this token, or could not find the site’s content/site.json. Check the repository name, and that the token was given access to this repository (Repository access → Only select repositories).';
    if (e.status === 403) return 'GitHub refused the request: ' + e.message + '. Check the token has Contents: Read and write.';
    if (e.status === 0) return 'Could not reach GitHub. Check your internet connection and try again.';
    return 'Something went wrong: ' + e.message;
  }

  $('#signin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const token = $('#token').value.trim();
    const repo = $('#repo').value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/+$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { $('#more-options').open = true; showSignin('Please type the repository as owner/repository (under “More options”).'); return; }
    signIn({ token, repo, branchChosen: $('#branch').value.trim(), folder: normFolder($('#folder').value) }, $('#remember').checked);
  });

  $('#repo').addEventListener('input', () => { $('#repo-name-step').textContent = $('#repo').value || 'this site’s repository'; updateTokenLink(); });

  $('#try-btn').addEventListener('click', async () => {
    try {
      const r = await fetch('content/site.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      state.mode = 'preview';
      state.auth = null;
      setBase(await r.json(), null);
      startApp();
    } catch (e) {
      showSignin('Could not load the site’s content for the preview (' + e.message + ').');
    }
  });

  $('#signout-btn').addEventListener('click', async () => {
    if (changeCount() && !(await confirmBox('Sign out?', '<p>You have unpublished changes. They will be lost if you sign out now.</p>', 'Sign out and lose changes', true))) return;
    clearAuth();
    state.newPhotos.clear();
    state.deleted.clear();
    state.base = state.data = null;
    location.reload();
  });

  // ===================================================================
  // GitHub API
  // ===================================================================

  async function gh(method, path, body, auth) {
    auth = auth || state.auth;
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (auth && auth.token) headers.Authorization = 'Bearer ' + auth.token;
    if (body) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    } catch (e) {
      const err = new Error('network error'); err.status = 0; throw err;
    }
    if (!res.ok) {
      let msg = res.statusText;
      try { const j = await res.json(); msg = j.message || msg; } catch (e) { /* ignore */ }
      const err = new Error(msg || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  function repoPath(rel) { return state.auth.folder + rel; }
  function encPath(p) { return p.split('/').map(encodeURIComponent).join('/'); }

  async function readRemoteSiteJson() {
    const f = await gh('GET', '/repos/' + state.auth.repo + '/contents/' + encPath(repoPath('content/site.json')) + '?ref=' + encodeURIComponent(state.auth.branch));
    let text;
    if (f.content) {
      const bin = atob(f.content.replace(/\s/g, ''));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      text = new TextDecoder('utf-8').decode(bytes);
    } else {
      // Files over 1 MB come without content; fetch the blob instead.
      const b = await gh('GET', '/repos/' + state.auth.repo + '/git/blobs/' + f.sha);
      const bin = atob(b.content.replace(/\s/g, ''));
      text = new TextDecoder('utf-8').decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    }
    return { sha: f.sha, text };
  }

  async function loadFromGitHub() {
    const remote = await readRemoteSiteJson();
    let json;
    try { json = JSON.parse(remote.text); } catch (e) { throw new Error('content/site.json on GitHub is not valid JSON (' + e.message + ')'); }
    setBase(json, remote.sha);
  }

  function setBase(json, sha) {
    json.site = json.site || {};
    json.categories = json.categories || [];
    json.articles = json.articles || [];
    json.photos = json.photos || [];
    state.data = json;
    state.base = clone(json);
    state.baseSha = sha;
  }

  // Photos that GitHub Pages has not published yet (or that this browser just uploaded)
  // are fetched straight from the repository with the token.
  document.addEventListener('error', async (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || state.mode !== 'github') return;
    const src = img.getAttribute('data-src');
    if (!src || img.dataset.tried || !/^content\//.test(src)) return;
    img.dataset.tried = '1';
    try {
      const url = await repoImageUrl(src);
      if (url) img.src = url;
    } catch (err) { /* leave the broken image */ }
  }, true);

  const pendingImage = new Map();
  function repoImageUrl(src) {
    if (state.localUrls.has(src)) return Promise.resolve(state.localUrls.get(src));
    if (pendingImage.has(src)) return pendingImage.get(src);
    const p = fetch(API + '/repos/' + state.auth.repo + '/contents/' + encPath(repoPath(src)) + '?ref=' + encodeURIComponent(state.auth.branch), {
      headers: { Accept: 'application/vnd.github.raw', Authorization: 'Bearer ' + state.auth.token, 'X-GitHub-Api-Version': '2022-11-28' }
    }).then((r) => (r.ok ? r.blob() : null)).then((blob) => {
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      state.localUrls.set(src, url);
      return url;
    }).finally(() => pendingImage.delete(src));
    pendingImage.set(src, p);
    return p;
  }

  // ===================================================================
  // Photos: lookup, URLs, upload & resize
  // ===================================================================

  function findPhoto(ref) {
    if (!ref) return null;
    return state.data.photos.find((p) => p.id === ref) || state.data.photos.find((p) => p.src === ref) || null;
  }

  function imgUrl(src) {
    return state.localUrls.get(src) || src;
  }

  function imgTag(ref, alt) {
    const p = findPhoto(ref);
    if (!p || !MD.safeUrl(p.src)) return '';
    return '<img src="' + esc(imgUrl(MD.safeUrl(p.src))) + '" data-src="' + esc(p.src) + '" alt="' + esc(alt != null ? alt : p.caption || '') + '" loading="lazy">';
  }

  function renderMd(md) {
    return MD.render(md, { photo: findPhoto, imageUrl: imgUrl });
  }

  async function resizeToJpeg(file) {
    let source, w, h;
    try {
      source = await createImageBitmap(file, { imageOrientation: 'from-image' });
      w = source.width; h = source.height;
    } catch (e) {
      source = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('This file could not be read as a picture.'));
        im.src = URL.createObjectURL(file);
      });
      w = source.naturalWidth; h = source.naturalHeight;
    }
    const scale = Math.min(1, MAX_PX / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, cw, ch);
    if (source.close) source.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('The picture could not be converted.');
    return { blob, width: cw, height: ch };
  }

  async function addPhotoFiles(files) {
    const added = [];
    const list = Array.from(files || []).filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(f.name));
    if (!list.length) { toast('Please choose picture files (JPEG, PNG or WebP).', true); return added; }
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      toast('Preparing ' + (list.length > 1 ? 'photo ' + (i + 1) + ' of ' + list.length : f.name) + '…');
      try {
        const { blob } = await resizeToJpeg(f);
        const baseName = slugify(f.name.replace(/\.[^.]+$/, '')).slice(0, 40);
        let id, src;
        do {
          const tag = randomId(4);
          id = 'p-' + baseName + '-' + tag;
          src = 'content/photos/' + baseName + '-' + tag + '.jpg';
        } while (findPhoto(id) || findPhoto(src));
        state.newPhotos.set(src, blob);
        state.localUrls.set(src, URL.createObjectURL(blob));
        state.data.photos.unshift({
          id, src,
          caption: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim(),
          credit: state.data.site.author || '',
          license: 'All rights reserved',
          sourceUrl: '',
          gallery: true
        });
        added.push(id);
      } catch (e) {
        toast('Could not add ' + f.name + ': ' + e.message, true);
      }
    }
    if (added.length) toast(added.length === 1 ? 'Photo added. Remember to publish.' : added.length + ' photos added. Remember to publish.');
    changed();
    return added;
  }

  function pickFiles() {
    return new Promise((resolve) => {
      const input = $('#file-input');
      input.value = '';
      input.onchange = () => resolve(input.files);
      input.click();
    });
  }

  function photoUses(p) {
    const uses = [];
    const d = state.data;
    const refRe = new RegExp('\\]\\((' + escapeRe(p.id) + '|' + escapeRe(p.src) + ')\\)');
    d.articles.forEach((a) => {
      if (a.cover === p.id || a.cover === p.src) uses.push('Cover of “' + a.title + '”');
      if (refRe.test(a.body || '')) uses.push('Inside the story “' + a.title + '”');
    });
    d.categories.forEach((c) => { if (c.photo === p.id || c.photo === p.src) uses.push('Photo for the category “' + c.name + '”'); });
    if (d.site.aboutPhoto === p.id || d.site.aboutPhoto === p.src) uses.push('The about page');
    if (refRe.test(d.site.about || '')) uses.push('Inside the about page text');
    return uses;
  }

  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  async function deletePhoto(id) {
    const p = findPhoto(id);
    if (!p) return false;
    const uses = photoUses(p);
    const body = uses.length
      ? '<div class="error-box" style="margin-top:0"><strong>This photo is in use:</strong><ul>' + uses.map((u) => '<li>' + esc(u) + '</li>').join('') +
        '</ul>Those places will be left without a photo.</div>'
      : '<p>This photo is not used in any story.</p>';
    const ok = await confirmBox('Delete this photo?', '<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px"><div class="thumb">' + imgTag(id, '') +
      '</div><div>' + esc(p.caption || p.src) + '</div></div>' + body + '<p class="hint">The file is removed from the site when you next publish.</p>', 'Delete photo', true);
    if (!ok) return false;
    const d = state.data;
    d.photos = d.photos.filter((x) => x !== p);
    d.articles.forEach((a) => { if (a.cover === p.id || a.cover === p.src) a.cover = ''; });
    d.categories.forEach((c) => { if (c.photo === p.id || c.photo === p.src) c.photo = ''; });
    if (d.site.aboutPhoto === p.id || d.site.aboutPhoto === p.src) d.site.aboutPhoto = '';
    if (state.newPhotos.has(p.src)) state.newPhotos.delete(p.src);
    else if (/^content\//.test(p.src) && !d.photos.some((x) => x.src === p.src)) state.deleted.add(p.src);
    changed();
    toast('Photo deleted. Remember to publish.');
    return true;
  }

  // Photo chooser used by covers, "+ Photo", category and about photos.
  function choosePhoto(title, current, allowNone) {
    let selected = current || '';
    function grid() {
      return state.data.photos.map((p) =>
        '<button type="button" data-pick="' + esc(p.id) + '" aria-pressed="' + (p.id === selected) + '" title="' + esc(p.caption || '') + '">' +
        imgTag(p.id, '') + '<span>' + esc(p.caption || p.src) + '</span></button>').join('') ||
        '<p class="hint">No photos yet — upload one.</p>';
    }
    return modal('<h2>' + esc(title) + '</h2>' +
      '<div class="toolbar-row"><button type="button" class="primary" data-upload>Upload a new photo…</button>' +
      (allowNone ? '<button type="button" data-close="__none">No photo</button>' : '') + '</div>' +
      '<div class="picker">' + grid() + '</div>' +
      '<div class="btns"><button type="button" data-close="">Cancel</button><button type="button" class="primary" data-choose>Use this photo</button></div>', {
      wide: true,
      setup(box, close) {
        box.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-pick]');
          if (b) {
            selected = b.getAttribute('data-pick');
            $$('[data-pick]', box).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            if (e.detail === 2) close('=' + selected);
          }
          if (e.target.closest('[data-upload]')) {
            const ids = await addPhotoFiles(await pickFiles());
            if (ids.length) { selected = ids[0]; $('.picker', box).innerHTML = grid(); }
          }
          if (e.target.closest('[data-choose]')) close(selected ? '=' + selected : null);
        });
      }
    }).then((v) => (v === '__none' ? '' : v && v.charAt(0) === '=' ? v.slice(1) : null));
  }

  // ===================================================================
  // Counting unpublished changes
  // ===================================================================

  function diffById(a, b) {
    const ma = new Map((a || []).map((x) => [x.id, JSON.stringify(x)]));
    const mb = new Map((b || []).map((x) => [x.id, JSON.stringify(x)]));
    let n = 0;
    ma.forEach((v, k) => { if (!mb.has(k) || mb.get(k) !== v) n++; });
    mb.forEach((v, k) => { if (!ma.has(k)) n++; });
    const orderA = (a || []).map((x) => x.id).filter((k) => mb.has(k)).join('|');
    const orderB = (b || []).map((x) => x.id).filter((k) => ma.has(k)).join('|');
    if (orderA !== orderB) n++;
    return n;
  }

  function changeCount() {
    if (!state.data || !state.base) return 0;
    const d = state.data, b = state.base;
    let n = 0;
    const keys = new Set(Object.keys(d.site).concat(Object.keys(b.site)));
    keys.forEach((k) => { if (JSON.stringify(d.site[k]) !== JSON.stringify(b.site[k])) n++; });
    n += diffById(b.categories, d.categories);
    n += diffById(b.articles, d.articles);
    n += diffById(b.photos, d.photos);
    // Deleting a file whose record changed elsewhere is already counted with the record.
    return n;
  }

  function changed() {
    const n = changeCount();
    const flag = $('#maint-flag');
    if (flag) {
      const live = !!(state.base && state.base.site.maintenance), want = !!state.data.site.maintenance;
      flag.hidden = !live && !want;
      flag.textContent = live === want ? 'Site hidden (maintenance)' : want ? 'Maintenance on after publishing' : 'Site back after publishing';
    }
    $('#change-count').textContent = n;
    $('#publish-btn').title = n ? n + ' unpublished change' + (n === 1 ? '' : 's') : 'Everything is published';
  }

  window.addEventListener('beforeunload', (e) => {
    if (changeCount() > 0) { e.preventDefault(); e.returnValue = ''; }
  });

  // ===================================================================
  // App shell
  // ===================================================================

  function startApp() {
    $('#signin').hidden = true;
    $('#app').hidden = false;
    $('#token').value = '';
    $('#preview-banner').hidden = state.mode !== 'preview';
    $('#who').textContent = state.mode === 'preview' ? 'Preview mode' : state.auth.repo + ' · ' + state.auth.branch;
    $('#signout-btn').textContent = state.mode === 'preview' ? 'Leave preview' : 'Sign out';
    changed();
    render();
  }

  $$('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => {
    state.tab = b.getAttribute('data-tab');
    if (state.tab !== 'articles') state.editing = null;
    render();
  }));

  function render() {
    $$('.tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === state.tab)));
    if (state.tab === 'articles') state.editing ? renderEditor() : renderArticleList();
    else if (state.tab === 'photos') renderPhotos();
    else if (state.tab === 'settings') renderSettings();
    else if (state.tab === 'preview') renderPreview();
    else if (state.tab === 'wording') renderWording();
    else renderHelp();
  }

  function categoryName(id) {
    const c = state.data.categories.find((x) => x.id === id);
    return c ? c.name : 'No category';
  }

  // ===================================================================
  // Articles
  // ===================================================================

  function renderArticleList() {
    const q = state.search.trim().toLowerCase();
    const list = state.data.articles.slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .filter((a) => !q || [a.title, a.dek, a.author, categoryName(a.category), a.body].join(' ').toLowerCase().includes(q));
    view().innerHTML =
      '<div class="view-head"><h1>Stories</h1><button type="button" class="primary" id="new-article">+ New story</button></div>' +
      '<div class="toolbar-row"><input type="search" id="a-search" placeholder="Search stories…" aria-label="Search stories" value="' + esc(state.search) + '">' +
      '<span class="hint" style="margin:0">' + state.data.articles.length + ' stories · ' +
      state.data.articles.filter((a) => a.status === 'draft').length + ' drafts</span></div>' +
      (list.length ? '<ul class="alist">' + list.map((a) =>
        '<li><button type="button" data-edit="' + esc(a.id) + '">' +
        '<div class="thumb">' + imgTag(a.cover, '') + '</div>' +
        '<div><div class="t">' + esc(a.title || 'Untitled story') + '</div>' +
        '<div class="m">' + esc(categoryName(a.category)) + ' · ' + esc(fmtDate(a.date)) + '</div></div>' +
        '<div class="badges">' + (a.featured ? '<span class="badge feat">Featured</span>' : '') +
        (a.status === 'draft' ? '<span class="badge draft">Draft</span>' : '<span class="badge pub">Published</span>') + '</div>' +
        '</button></li>').join('') + '</ul>'
        : '<p class="hint">No stories match.</p>');

    const s = $('#a-search');
    s.addEventListener('input', () => {
      state.search = s.value;
      const pos = s.selectionStart;
      renderArticleList();
      const s2 = $('#a-search'); s2.focus(); s2.setSelectionRange(pos, pos);
    });
    $('#new-article').addEventListener('click', newArticle);
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => { state.editing = b.getAttribute('data-edit'); render(); window.scrollTo(0, 0); }));
  }

  function newArticle() {
    const id = 'a-' + Date.now().toString(36) + randomId(3);
    state.data.articles.unshift({
      id, slug: uniqueSlug('new-story', id), title: '', dek: '',
      category: (state.data.categories[0] || {}).id || '', date: today(),
      author: state.data.site.author || '', cover: '', body: '', featured: false, status: 'draft'
    });
    state.slugFollowsTitle.add(id);
    state.editing = id;
    changed();
    render();
    window.scrollTo(0, 0);
    $('#f-title').focus();
  }

  function uniqueSlug(base, ownId) {
    let slug = slugify(base), n = 2;
    const taken = (s) => state.data.articles.some((a) => a.slug === s && a.id !== ownId);
    while (taken(slug)) slug = slugify(base) + '-' + n++;
    return slug;
  }

  const TOOLS = [
    ['h2', 'Heading', 'Large heading'], ['h3', 'Subheading', 'Smaller heading'], ['b', '<b>B</b>', 'Bold'], ['i', '<i>I</i>', 'Italic'],
    ['quote', 'Quote', 'Quotation'], ['list', 'List', 'Bulleted list'], ['link', 'Link', 'Link to a web page'], ['photo', '+ Photo', 'Insert a full-width photo']
  ];

  function toolbarHtml(target) {
    return '<div class="mdtools" role="toolbar" aria-label="Formatting" data-for="' + target + '">' +
      TOOLS.map((t) => '<button type="button" data-md="' + t[0] + '" title="' + t[2] + '" aria-label="' + t[2] + '">' + t[1] + '</button>').join('') + '</div>';
  }

  async function applyTool(kind, ta) {
    const v = ta.value;
    let s = ta.selectionStart, e = ta.selectionEnd;
    const sel = v.slice(s, e);
    const replace = (text, selFrom, selTo) => {
      ta.focus();
      ta.setRangeText(text, s, e, 'end');
      if (selFrom != null) ta.setSelectionRange(s + selFrom, s + selTo);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    const prefixLines = (prefix) => {
      s = lineStart;
      let end = v.indexOf('\n', Math.max(e - (e > s && v[e - 1] === '\n' ? 1 : 0), s));
      if (end < 0) end = v.length;
      e = end;
      const block = v.slice(s, e).split('\n').map((l) => prefix + l.replace(/^(#{2,3}\s+|>\s?|[-*]\s+)/, '')).join('\n');
      replace(block);
    };
    const wrap = (mark, placeholder) => {
      const t = sel || placeholder;
      replace(mark + t + mark, mark.length, mark.length + t.length);
    };
    switch (kind) {
      case 'h2': prefixLines('## '); break;
      case 'h3': prefixLines('### '); break;
      case 'quote': prefixLines('> '); break;
      case 'list': prefixLines('- '); break;
      case 'b': wrap('**', 'bold text'); break;
      case 'i': wrap('*', 'italic text'); break;
      case 'link': {
        const url = await promptBox('Add a link', 'Web address', 'https://', 'For example https://www.example.com/page');
        if (!url || url === 'https://') return;
        if (!MD.safeUrl(url)) { toast('That address cannot be used as a link.', true); return; }
        const text = sel || 'link text';
        replace('[' + text + '](' + url.trim() + ')', 1, 1 + text.length);
        break;
      }
      case 'photo': {
        const id = await choosePhoto('Insert a photo', '', false);
        if (!id) return;
        const p = findPhoto(id);
        const before = s > 0 && v[s - 1] !== '\n' ? '\n\n' : (s > 1 && v[s - 2] !== '\n' ? '\n' : '');
        const after = v[e] === '\n' ? '\n' : '\n\n';
        replace(before + '![' + (p.caption || '').replace(/[[\]]/g, '') + '](' + id + ')' + after);
        break;
      }
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-md]');
    if (!b) return;
    const bar = b.closest('[data-for]');
    const ta = document.getElementById(bar.getAttribute('data-for'));
    if (ta) applyTool(b.getAttribute('data-md'), ta);
  });

  function renderEditor() {
    const a = state.data.articles.find((x) => x.id === state.editing);
    if (!a) { state.editing = null; renderArticleList(); return; }
    const cats = state.data.categories;
    view().innerHTML =
      '<div class="view-head"><button type="button" id="back-list">&larr; All stories</button>' +
      '<h1 style="margin-left:6px">' + esc(a.title || 'New story') + '</h1>' +
      '<a class="button" id="view-live" target="_blank" rel="noopener" href="index.html#/article/' + encodeURIComponent(a.slug) + '">View on site</a></div>' +
      '<div class="editor">' +
      '<div class="panel">' +
      '<div class="field"><label for="f-title">Title</label><input type="text" id="f-title" data-f="title" value="' + esc(a.title) + '" placeholder="A headline for the story"></div>' +
      '<div class="field"><label for="f-dek">Subtitle</label><input type="text" id="f-dek" data-f="dek" value="' + esc(a.dek) + '" placeholder="One line that draws the reader in"></div>' +
      '<div class="grid3">' +
      '<div class="field"><label for="f-category">Category</label><select id="f-category" data-f="category">' +
      cats.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === a.category ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') +
      (cats.some((c) => c.id === a.category) ? '' : '<option value="' + esc(a.category || '') + '" selected>(none)</option>') + '</select></div>' +
      '<div class="field"><label for="f-date">Date</label><input type="date" id="f-date" data-f="date" value="' + esc(a.date) + '"></div>' +
      '<div class="field"><label for="f-author">Author</label><input type="text" id="f-author" data-f="author" value="' + esc(a.author) + '"></div>' +
      '</div>' +
      '<div class="field"><label>Cover photo</label><div class="cover-pick"><div class="thumb" id="cover-thumb">' + imgTag(a.cover, '') + '</div>' +
      '<div><button type="button" id="cover-choose">' + (a.cover ? 'Change cover photo…' : 'Choose or upload a cover…') + '</button>' +
      '<p class="hint" id="cover-cap">' + esc((findPhoto(a.cover) || {}).caption || (a.cover ? '' : 'No cover photo yet')) + '</p></div></div></div>' +
      '</div>' +

      '<div class="panel"><label for="f-body">Story</label>' +
      '<div class="write-split"><div>' + toolbarHtml('f-body') +
      '<textarea id="f-body" data-f="body" placeholder="Start writing… Leave a blank line between paragraphs.">' + esc(a.body) + '</textarea>' +
      '<p class="hint">Blank line = new paragraph. ## Heading · ### Subheading · **bold** · *italic* · &gt; quote · - list item</p></div>' +
      '<div class="preview-pane" aria-live="polite"><div class="pv-label">Preview</div><div class="mini-prose" id="body-preview"></div></div></div></div>' +

      '<div class="panel">' +
      '<label class="check"><input type="checkbox" id="f-published"' + (a.status !== 'draft' ? ' checked' : '') + '> Published on the site</label>' +
      '<p class="hint" style="margin-bottom:12px">Untick to keep it as a draft — only you can see drafts, here in the admin.</p>' +
      '<label class="check"><input type="checkbox" id="f-featured"' + (a.featured ? ' checked' : '') + '> Feature on the home page</label>' +
      '<p class="hint" style="margin-bottom:16px">The featured story fills the large picture at the top of the home page. Only one story is featured at a time.</p>' +
      '<div class="field" style="max-width:640px"><label for="f-slug">Web address</label><div class="slug-row"><span>…#/article/</span>' +
      '<input type="text" id="f-slug" value="' + esc(a.slug) + '" spellcheck="false" autocapitalize="off"></div>' +
      '<p class="hint" id="slug-hint">Lowercase words joined by dashes. Changing it breaks links people may already have shared.</p></div>' +
      '<div class="editor-actions"><button type="button" class="danger" id="delete-article">Delete story</button>' +
      '<button type="button" class="primary" id="done-article">Done</button></div>' +
      '</div></div>';

    const preview = () => { $('#body-preview').innerHTML = renderMd(a.body) || '<p class="hint">Your story will appear here as you type.</p>'; };
    preview();

    $$('[data-f]').forEach((el) => el.addEventListener('input', () => {
      const f = el.getAttribute('data-f');
      a[f] = el.value;
      if (f === 'title') {
        $('.view-head h1').textContent = a.title || 'New story';
        if (state.slugFollowsTitle.has(a.id)) { a.slug = uniqueSlug(a.title || 'new-story', a.id); $('#f-slug').value = a.slug; updateLive(); }
      }
      if (f === 'body') preview();
      changed();
    }));
    const updateLive = () => { $('#view-live').href = 'index.html#/article/' + encodeURIComponent(a.slug); };

    $('#f-slug').addEventListener('input', (e) => {
      state.slugFollowsTitle.delete(a.id);
      const raw = e.target.value;
      const clean = slugify(raw);
      const dupe = state.data.articles.some((x) => x.slug === clean && x.id !== a.id);
      $('#slug-hint').textContent = dupe ? 'Another story already uses this address — it will get a number added.' :
        'Lowercase words joined by dashes. Changing it breaks links people may already have shared.';
    });
    $('#f-slug').addEventListener('change', (e) => {
      a.slug = uniqueSlug(e.target.value || a.title || 'story', a.id);
      e.target.value = a.slug;
      updateLive();
      changed();
    });

    $('#f-published').addEventListener('change', (e) => { a.status = e.target.checked ? 'published' : 'draft'; changed(); });
    $('#f-featured').addEventListener('change', (e) => {
      if (e.target.checked) {
        const others = state.data.articles.filter((x) => x !== a && x.featured);
        others.forEach((x) => { x.featured = false; });
        if (others.length) toast('“' + (others[0].title || 'Untitled') + '” is no longer featured.');
      }
      a.featured = e.target.checked;
      changed();
    });

    $('#cover-choose').addEventListener('click', async () => {
      const id = await choosePhoto('Cover photo', a.cover, true);
      if (id === null) return;
      a.cover = id;
      changed();
      $('#cover-thumb').innerHTML = imgTag(a.cover, '');
      $('#cover-cap').textContent = (findPhoto(a.cover) || {}).caption || (a.cover ? '' : 'No cover photo yet');
      $('#cover-choose').textContent = a.cover ? 'Change cover photo…' : 'Choose or upload a cover…';
    });

    $('#back-list').addEventListener('click', () => { state.editing = null; render(); });
    $('#done-article').addEventListener('click', () => {
      state.editing = null; render();
      if (changeCount()) toast('Saved in the admin. Press Publish to put it on the site.');
    });
    $('#delete-article').addEventListener('click', async () => {
      if (!(await confirmBox('Delete this story?', '<p>“' + esc(a.title || 'Untitled story') + '” will be removed from the site when you next publish. Its photos stay in the Photos tab.</p>', 'Delete story', true))) return;
      state.data.articles = state.data.articles.filter((x) => x !== a);
      state.editing = null;
      changed();
      render();
      toast('Story deleted. Remember to publish.');
    });
  }

  // ===================================================================
  // Photos tab
  // ===================================================================

  function renderPhotos() {
    const photos = state.data.photos;
    view().innerHTML =
      '<div class="view-head"><h1>Photos</h1><span class="hint" style="margin:0">' + photos.length + ' photos · ' +
      photos.filter((p) => p.gallery).length + ' in the gallery</span></div>' +
      '<div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Upload photos">' +
      '<strong>Drop photos here, or click to choose</strong>' +
      '<p>They are resized to ' + MAX_PX + ' pixels and saved as JPEG in your browser before uploading.</p></div>' +
      '<div class="pgrid">' + photos.map((p) =>
        '<div class="pcard" data-pid="' + esc(p.id) + '"><div class="img">' + imgTag(p.id, '') + '</div><div class="body">' +
        (state.newPhotos.has(p.src) ? '<span class="new">New — not yet published</span>' : '') +
        '<div><label for="cap-' + esc(p.id) + '">Caption</label><input type="text" id="cap-' + esc(p.id) + '" data-pf="caption" value="' + esc(p.caption) + '"></div>' +
        '<div><label for="cre-' + esc(p.id) + '">Credit</label><input type="text" id="cre-' + esc(p.id) + '" data-pf="credit" value="' + esc(p.credit) + '"></div>' +
        (p.license || p.sourceUrl ? '<div class="lic">' + esc(p.license || '') + (MD.safeUrl(p.sourceUrl) ? ' · <a href="' + esc(MD.safeUrl(p.sourceUrl)) + '" target="_blank" rel="noopener">source</a>' : '') + '</div>' : '') +
        '<div class="row"><label class="check"><input type="checkbox" data-pf="gallery"' + (p.gallery ? ' checked' : '') + '> Show in gallery</label>' +
        '<button type="button" class="danger small" data-del="' + esc(p.id) + '">Delete</button></div>' +
        '</div></div>').join('') + '</div>';

    const dz = $('#dropzone');
    dz.addEventListener('click', async () => { if ((await addPhotoFiles(await pickFiles())).length) renderPhotos(); });
    dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dz.click(); } });
    ['dragenter', 'dragover'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', async (e) => { if ((await addPhotoFiles(e.dataTransfer.files)).length) renderPhotos(); });

    $$('.pcard').forEach((card) => {
      const p = findPhoto(card.getAttribute('data-pid'));
      $$('[data-pf]', card).forEach((el) => {
        el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
          const f = el.getAttribute('data-pf');
          p[f] = el.type === 'checkbox' ? el.checked : el.value;
          changed();
        });
      });
    });
    $$('[data-del]').forEach((b) => b.addEventListener('click', async () => { if (await deletePhoto(b.getAttribute('data-del'))) renderPhotos(); }));
  }

  // Page-wide drop: stop the browser from opening a dropped file and losing the admin.
  ['dragover', 'drop'].forEach((t) => window.addEventListener(t, (e) => { if (!e.target.closest || !e.target.closest('#dropzone')) e.preventDefault(); }));

  // ===================================================================
  // Site settings
  // ===================================================================

  const SITE_FIELDS = [
    ['name', 'Magazine name', 'text'], ['tagline', 'Tagline', 'text'],
    ['description', 'Short description (footer, search engines, about page)', 'area'],
    ['author', 'Editor / author name', 'text'], ['email', 'Contact email', 'text'], ['instagram', 'Instagram handle', 'text'],
    ['quote', 'Home page quote', 'area'], ['quoteBy', 'Quote by', 'text'], ['galleryIntro', 'Gallery introduction', 'area']
  ];

  function renderSettings() {
    const s = state.data.site;
    view().innerHTML =
      '<div class="view-head"><h1>Site settings</h1></div>' +
      '<div class="panel maint-panel' + (s.maintenance ? ' on' : '') + '" style="margin-bottom:18px"><h2 style="font-size:26px;margin-bottom:10px">Maintenance mode</h2>' +
      '<label class="check"><input type="checkbox" id="s-maintenance"' + (s.maintenance ? ' checked' : '') + '> Hide the website and show a “back soon” notice</label>' +
      '<p class="hint">Takes effect once you press Publish (and GitHub Pages has rebuilt). Untick and publish again to bring the site back. ' +
      'You can still look at the site yourself by adding <code>?preview</code> to its address, e.g. <a href="index.html?preview" target="_blank" rel="noopener">index.html?preview</a>. ' +
      'This hides the site from visitors; it is not a password — the content files stay readable to anyone who knows where to look.</p>' +
      '<div class="field" style="margin-top:12px"><label for="s-maintenanceMessage">Message for visitors</label>' +
      '<textarea id="s-maintenanceMessage" data-sf="maintenanceMessage" rows="2" placeholder="The shutters are closed for a little while as we tidy the house. Please come back soon.">' + esc(s.maintenanceMessage || '') + '</textarea></div></div>' +
      '<div class="panel" style="margin-bottom:18px"><h2 style="font-size:26px;margin-bottom:14px">The magazine</h2><div class="grid2">' +
      SITE_FIELDS.map((f) => '<div class="field"' + (f[2] === 'area' ? ' style="grid-column:1/-1"' : '') + '><label for="s-' + f[0] + '">' + esc(f[1]) + '</label>' +
        (f[2] === 'area'
          ? '<textarea id="s-' + f[0] + '" data-sf="' + f[0] + '" rows="2">' + esc(s[f[0]] || '') + '</textarea>'
          : '<input type="text" id="s-' + f[0] + '" data-sf="' + f[0] + '" value="' + esc(s[f[0]] || '') + '">') + '</div>').join('') +
      '</div></div>' +

      '<div class="panel" style="margin-bottom:18px"><h2 style="font-size:26px;margin-bottom:14px">About page</h2>' +
      '<div class="field"><label for="s-aboutTitle">Title</label><input type="text" id="s-aboutTitle" data-sf="aboutTitle" value="' + esc(s.aboutTitle || '') + '"></div>' +
      '<div class="field"><label>Photo</label><div class="cover-pick"><div class="thumb" id="about-thumb">' + imgTag(s.aboutPhoto, '') + '</div>' +
      '<button type="button" id="about-photo">Choose or upload…</button></div></div>' +
      '<label for="s-about">Text</label><div class="write-split"><div>' + toolbarHtml('s-about') +
      '<textarea id="s-about" data-sf="about" style="min-height:320px">' + esc(s.about || '') + '</textarea></div>' +
      '<div class="preview-pane"><div class="pv-label">Preview</div><div class="mini-prose" id="about-preview"></div></div></div></div>' +

      '<div class="panel"><div class="view-head" style="margin-bottom:6px"><h2 style="font-size:26px;margin-right:auto">Categories</h2>' +
      '<button type="button" id="add-cat">+ Add category</button></div>' +
      '<p class="hint">Categories appear in the menu, on the home page and on every story. Renaming keeps the web address the same.</p>' +
      state.data.categories.map((c, i) =>
        '<div class="cat-row" data-cid="' + esc(c.id) + '"><div class="thumb" role="button" tabindex="0" title="Change photo" data-cphoto>' + imgTag(c.photo, '') + '</div><div>' +
        '<div class="grid2"><div class="field"><label for="cn-' + i + '">Name</label><input type="text" id="cn-' + i + '" data-cf="name" value="' + esc(c.name) + '"></div>' +
        '<div class="field"><label for="cb-' + i + '">Short description</label><input type="text" id="cb-' + i + '" data-cf="blurb" value="' + esc(c.blurb || '') + '"></div></div>' +
        '<div class="actions"><span class="hint" style="margin:0;margin-right:auto">Address: #/journal/' + esc(c.id) + ' · ' +
        state.data.articles.filter((a) => a.category === c.id).length + ' stories</span>' +
        '<button type="button" class="small" data-cphoto>Photo…</button>' +
        '<button type="button" class="small" data-cmove="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">&uarr;</button>' +
        '<button type="button" class="small" data-cmove="1"' + (i === state.data.categories.length - 1 ? ' disabled' : '') + ' aria-label="Move down">&darr;</button>' +
        '<button type="button" class="danger small" data-cdel>Remove</button></div></div></div>').join('') +
      '</div>';

    $('#s-maintenance').addEventListener('change', (e) => {
      s.maintenance = e.target.checked;
      $('.maint-panel').classList.toggle('on', s.maintenance);
      changed();
      toast(s.maintenance ? 'Maintenance mode on — press Publish to hide the site.' : 'Maintenance mode off — press Publish to bring the site back.');
    });
    const aboutPreview = () => { $('#about-preview').innerHTML = renderMd(s.about); };
    aboutPreview();
    $$('[data-sf]').forEach((el) => el.addEventListener('input', () => {
      s[el.getAttribute('data-sf')] = el.value;
      if (el.id === 's-about') aboutPreview();
      changed();
    }));
    $('#about-photo').addEventListener('click', async () => {
      const id = await choosePhoto('About page photo', s.aboutPhoto, true);
      if (id === null) return;
      s.aboutPhoto = id; changed();
      $('#about-thumb').innerHTML = imgTag(id, '');
    });

    $$('.cat-row').forEach((row) => {
      const c = state.data.categories.find((x) => x.id === row.getAttribute('data-cid'));
      $$('[data-cf]', row).forEach((el) => el.addEventListener('input', () => { c[el.getAttribute('data-cf')] = el.value; changed(); }));
      $$('[data-cphoto]', row).forEach((el) => {
        const go = async () => {
          const id = await choosePhoto('Photo for “' + c.name + '”', c.photo, true);
          if (id === null) return;
          c.photo = id; changed(); renderSettings();
        };
        el.addEventListener('click', go);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      });
      $$('[data-cmove]', row).forEach((b) => b.addEventListener('click', () => {
        const list = state.data.categories;
        const i = list.indexOf(c), j = i + Number(b.getAttribute('data-cmove'));
        if (j < 0 || j >= list.length) return;
        list.splice(i, 1); list.splice(j, 0, c);
        changed(); renderSettings();
      }));
      $('[data-cdel]', row).addEventListener('click', async () => {
        const used = state.data.articles.filter((a) => a.category === c.id);
        if (used.length) {
          await alertBox('This category is still in use', '<p>“' + esc(c.name) + '” can’t be removed while these stories use it. Move them to another category first:</p><ul>' +
            used.map((a) => '<li>' + esc(a.title || 'Untitled story') + '</li>').join('') + '</ul>');
          return;
        }
        if (!(await confirmBox('Remove this category?', '<p>“' + esc(c.name) + '” will disappear from the menu and home page.</p>', 'Remove', true))) return;
        state.data.categories = state.data.categories.filter((x) => x !== c);
        changed(); renderSettings();
      });
    });

    $('#add-cat').addEventListener('click', async () => {
      const name = await promptBox('New category', 'Name', '', 'For example “The Orchard”.');
      if (!name || !name.trim()) return;
      let id = slugify(name), n = 2;
      while (state.data.categories.some((c) => c.id === id)) id = slugify(name) + '-' + n++;
      state.data.categories.push({ id, name: name.trim(), blurb: '', photo: '' });
      changed(); renderSettings();
      toast('Category added. Remember to publish.');
    });
  }

  // ===================================================================
  // Menu & wording: menu names, which items show, and the site's fixed text
  // ===================================================================

  const LABELS = window.FCCLabels;

  function wordingValue(key) {
    const custom = (state.data.site.labels || {})[key];
    return typeof custom === 'string' && custom.trim() ? custom : LABELS.DEFAULTS[key];
  }

  function setWording(key, value) {
    const site = state.data.site;
    const labels = Object.assign({}, site.labels || {});
    if (!value.trim() || value === LABELS.DEFAULTS[key]) delete labels[key];
    else labels[key] = value;
    if (Object.keys(labels).length) site.labels = labels; else delete site.labels;
    changed();
  }

  function isHidden(key) { return (state.data.site.menuHidden || []).indexOf(key) >= 0; }

  function setHidden(key, hide) {
    const site = state.data.site;
    const list = (site.menuHidden || []).filter((k) => k !== key);
    if (hide) list.push(key);
    if (list.length) site.menuHidden = list; else delete site.menuHidden;
    changed();
  }

  function wordingField(key, label) {
    const def = LABELS.DEFAULTS[key];
    const long = def.length > 45;
    const val = wordingValue(key);
    return '<div class="field"' + (long ? ' style="grid-column:1/-1"' : '') + '><label for="w-' + key + '">' + esc(label) + '</label>' +
      (long ? '<textarea id="w-' + key + '" data-w="' + key + '" rows="2">' + esc(val) + '</textarea>'
            : '<input type="text" id="w-' + key + '" data-w="' + key + '" value="' + esc(val) + '">') +
      '<p class="hint" data-w-hint="' + key + '"' + (val === def ? ' hidden' : '') + '>Original: “' + esc(def) + '” · <button type="button" class="link" data-w-reset="' + key + '">Restore</button></p></div>';
  }

  function renderWording() {
    const cats = state.data.categories;
    const menuRows = [['home', 'navHome', null]]
      .concat(cats.map((c) => ['cat:' + c.id, null, c]))
      .concat([['gallery', 'navGallery', null], ['about', 'navAbout', null]]);
    view().innerHTML =
      '<div class="view-head"><h1>Menu &amp; wording</h1>' +
      '<button type="button" data-tab-go="preview">See it in Preview</button>' +
      '<button type="button" class="danger" id="w-reset-all">Restore all original wording</button></div>' +
      '<p class="hint" style="margin-top:-8px;margin-bottom:16px">Change the names in the menu and the fixed text around the site. Empty a box to go back to the original. Nothing goes live until you press Publish.</p>' +

      '<div class="panel" style="margin-bottom:18px"><h2 style="font-size:26px;margin-bottom:6px">Menu</h2>' +
      '<p class="hint" style="margin-bottom:12px">In the order shown on the site. Renaming a category here renames it everywhere (its web address stays the same); reorder categories in Site settings.</p>' +
      '<div class="menu-rows">' + menuRows.map(([key, labelKey, cat]) =>
        '<div class="menu-row">' +
        '<input type="text" aria-label="Menu name" ' + (cat ? 'data-catname="' + esc(cat.id) + '" value="' + esc(cat.name) + '"' : 'data-w="' + labelKey + '" value="' + esc(wordingValue(labelKey)) + '"') + '>' +
        '<span class="menu-kind">' + (cat ? 'Category' : key === 'home' ? 'Home page' : key === 'gallery' ? 'Gallery page' : 'About page') + '</span>' +
        '<label class="check"><input type="checkbox" data-menu-show="' + esc(key) + '"' + (isHidden(key) ? '' : ' checked') + '> Show in menu</label>' +
        '</div>').join('') + '</div>' +
      '<div class="grid2" style="margin-top:14px">' + wordingField('menuButton', 'Menu button on phones') + '</div>' +
      '</div>' +

      LABELS.GROUPS.filter((g) => g.title !== 'Menu').map((g) =>
        '<div class="panel" style="margin-bottom:18px"><h2 style="font-size:26px;margin-bottom:6px">' + esc(g.title) + '</h2>' +
        (g.note ? '<p class="hint" style="margin-bottom:12px">' + esc(g.note) + '</p>' : '') +
        '<div class="grid2">' + g.items.map((it) => wordingField(it[0], it[1])).join('') + '</div></div>').join('');

    $$('[data-w]').forEach((el) => el.addEventListener('input', () => {
      const key = el.getAttribute('data-w');
      setWording(key, el.value);
      const hint = $('[data-w-hint="' + key + '"]');
      if (hint) hint.hidden = wordingValue(key) === LABELS.DEFAULTS[key];
    }));
    $$('[data-w]').forEach((el) => el.addEventListener('blur', () => {
      if (!el.value.trim()) el.value = LABELS.DEFAULTS[el.getAttribute('data-w')];
    }));
    $$('[data-w-reset]').forEach((b) => b.addEventListener('click', () => {
      const key = b.getAttribute('data-w-reset');
      setWording(key, '');
      $$('[data-w="' + key + '"]').forEach((el) => { el.value = LABELS.DEFAULTS[key]; });
      $('[data-w-hint="' + key + '"]').hidden = true;
    }));
    $$('[data-catname]').forEach((el) => el.addEventListener('input', () => {
      const c = state.data.categories.find((x) => x.id === el.getAttribute('data-catname'));
      if (c && el.value.trim()) { c.name = el.value; changed(); }
    }));
    $$('[data-menu-show]').forEach((el) => el.addEventListener('change', () => {
      if (!el.checked && state.data.categories.length + 3 - (state.data.site.menuHidden || []).length <= 1) {
        el.checked = true; toast('Keep at least one item in the menu.', true); return;
      }
      setHidden(el.getAttribute('data-menu-show'), !el.checked);
    }));
    $('[data-tab-go]').addEventListener('click', () => { state.tab = 'preview'; render(); });
    $('#w-reset-all').addEventListener('click', async () => {
      if (!(await confirmBox('Restore all original wording?', '<p>Every menu name and text on this page goes back to the original (category names and hidden menu items stay as they are).</p>', 'Restore all', true))) return;
      delete state.data.site.labels;
      changed();
      renderWording();
    });
  }

  // ===================================================================
  // Preview: the whole site, even in maintenance mode
  // ===================================================================

  const DEVICES = { desktop: '100%', tablet: '820px', phone: '390px' };

  function renderPreview() {
    const n = changeCount();
    const live = state.mode === 'preview' ? 'Published version' : 'Live site';
    view().innerHTML =
      '<div class="view-head"><h1>Preview</h1>' +
      '<a class="button" href="index.html?preview" target="_blank" rel="noopener">Open the live site in a new tab</a></div>' +
      '<div class="preview-bar">' +
      '<div class="seg" role="group" aria-label="What to show">' +
      '<button type="button" data-pmode="edits" aria-pressed="' + (state.previewMode === 'edits') + '">With my changes' + (n ? ' (' + n + ' unpublished)' : '') + '</button>' +
      '<button type="button" data-pmode="live" aria-pressed="' + (state.previewMode === 'live') + '">' + live + '</button></div>' +
      '<div class="seg" role="group" aria-label="Screen size">' +
      Object.keys(DEVICES).map((d) => '<button type="button" data-pdev="' + d + '" aria-pressed="' + (state.previewDevice === d) + '">' +
        d.charAt(0).toUpperCase() + d.slice(1) + '</button>').join('') +
      '</div></div>' +
      '<p class="hint" id="preview-note">' + previewNote() + '</p>' +
      '<div class="preview-stage"><iframe id="preview-frame" title="Site preview" style="width:' + DEVICES[state.previewDevice] + '" src="' +
      previewSrc('#/') + '"></iframe></div>';

    $$('[data-pmode]').forEach((b) => b.addEventListener('click', () => {
      const hash = currentPreviewHash();
      state.previewMode = b.getAttribute('data-pmode');
      $$('[data-pmode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('#preview-note').innerHTML = previewNote();
      $('#preview-frame').src = previewSrc(hash);
    }));
    $$('[data-pdev]').forEach((b) => b.addEventListener('click', () => {
      state.previewDevice = b.getAttribute('data-pdev');
      $$('[data-pdev]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('#preview-frame').style.width = DEVICES[state.previewDevice];
    }));
  }

  function previewSrc(hash) {
    return (state.previewMode === 'edits' ? 'index.html?adminpreview' : 'index.html?preview&t=' + Date.now()) + (hash || '#/');
  }

  function currentPreviewHash() {
    try { return $('#preview-frame').contentWindow.location.hash || '#/'; } catch (e) { return '#/'; }
  }

  function previewNote() {
    const maint = state.data.site.maintenance
      ? ' Maintenance mode is on, so visitors currently see only the “back soon” notice. This preview shows the whole site anyway.' : '';
    return (state.previewMode === 'edits'
      ? 'Showing the site as it will look once you publish, including unpublished stories, photos and settings. Drafts stay hidden, as on the real site.'
      : 'Showing what is published right now. A publish can take a minute or two to appear.') + maint;
  }

  // The preview page asks for content when it loads; send it the admin's working copy.
  function sendPreview() {
    const f = $('#preview-frame');
    if (!f || !f.contentWindow || state.previewMode !== 'edits') return;
    f.contentWindow.postMessage({ type: 'fcc-preview-data', data: state.data, images: Object.fromEntries(state.localUrls) }, location.origin);
  }

  window.addEventListener('message', (e) => {
    const f = $('#preview-frame');
    if (!f || e.origin !== location.origin || e.source !== f.contentWindow) return;
    if (e.data && e.data.type === 'fcc-preview-ready') sendPreview();
  });

  // ===================================================================
  // Help
  // ===================================================================

  function renderHelp() {
    view().innerHTML = '<div class="help">' +
      '<div class="view-head"><h1>Help</h1></div>' +
      '<h2>How it works</h2>' +
      '<ol class="steps">' +
      '<li><strong>Make changes.</strong> Write or edit stories in <em>Articles</em>, add photos in <em>Photos</em>, and change the magazine’s details in <em>Site settings</em>. Everything is kept here in the admin until you publish.</li>' +
      '<li><strong>Publish.</strong> The number on the <em>Publish</em> button shows how many things have changed. Press it to send them all to GitHub in one go.</li>' +
      '<li><strong>Wait a minute or two.</strong> GitHub Pages rebuilds the site, then the changes appear for everyone. Refresh the public site to see them.</li>' +
      '</ol>' +
      '<p>If you close the page before publishing, the browser will warn you — unpublished changes live only in this tab.</p>' +
      '<p>If someone else (or you, on another device) published in the meantime, the admin notices and asks before overwriting their changes. To be safe, sign out and back in to load the latest version before starting new work.</p>' +
      '<h2>Menu and wording</h2>' +
      '<p>In <em>Menu &amp; wording</em> you can rename the menu items (Home, the categories, Gallery, About), hide items from the menu, and change the fixed text around the site: section headings on the home page, buttons, page titles and the footer. Empty a box, or press <em>Restore</em>, to go back to the original wording.</p>' +
      '<h2>Previewing the site</h2>' +
      '<p>The <em>Preview</em> tab shows the whole site inside the admin, even while maintenance mode hides it from visitors. ' +
      '<em>With my changes</em> shows how it will look after you publish; <em>Live site</em> shows what is published now. Use <em>Phone</em> to check it at phone size.</p>' +
      '<h2>Maintenance mode</h2>' +
      '<p>To take the site offline for a while, tick <em>Maintenance mode</em> at the top of <em>Site settings</em>, write a short message and publish. Visitors then see only that notice. ' +
      'Add <code>?preview</code> to the site’s address to look at it yourself. Untick and publish again to reopen. It hides the site, but is not a password.</p>' +
      '<h2>Drafts and the home page</h2>' +
      '<p>Untick <em>Published on the site</em> to keep a story as a draft: it is saved to GitHub when you publish, but the public site does not show it. ' +
      'Tick <em>Feature on the home page</em> to put a story in the large picture at the top of the home page. The next newest stories fill the rest of the page automatically.</p>' +
      '<h2>Formatting stories</h2>' +
      '<p>Leave a blank line between paragraphs. The buttons above the story box add these for you:</p>' +
      '<table><tbody>' +
      '<tr><td>## A heading</td><td>Large heading (button: Heading)</td></tr>' +
      '<tr><td>### A subheading</td><td>Smaller, italic heading (button: Subheading)</td></tr>' +
      '<tr><td>**bold words**</td><td><strong>bold words</strong></td></tr>' +
      '<tr><td>*italic words*</td><td><em>italic words</em></td></tr>' +
      '<tr><td>&gt; A quotation</td><td>A large indented quotation</td></tr>' +
      '<tr><td>- An item</td><td>A bulleted list (one item per line)</td></tr>' +
      '<tr><td>[words](https://…)</td><td>A link to another web page</td></tr>' +
      '<tr><td>![Caption](photo-id)</td><td>A full-width photo with a caption, on a line of its own (button: + Photo)</td></tr>' +
      '</tbody></table>' +
      '<p>The first paragraph of every story starts with a large drop capital automatically.</p>' +
      '<h2>Photos</h2>' +
      '<p>Drag photos onto the Photos tab, or use <em>Upload</em> wherever you choose a photo. They are shrunk to ' + MAX_PX + ' pixels on the longest side and saved as JPEG before uploading, so phone pictures are fine. ' +
      'Give each photo a caption and credit. Only photos with <em>Show in gallery</em> ticked appear in the gallery and the home page strip; every photo is listed on the photo credits page.</p>' +
      '<p>Only use photos you took yourself or that are licensed for reuse, and credit the photographer.</p>' +
      '<h2>Signing in</h2>' +
      '<p>The admin uses a GitHub fine-grained personal access token with <strong>Contents: Read and write</strong> on this repository only. When it expires, create a new one the same way (see the sign-in screen) and sign in again. Use <em>Sign out</em> on shared computers.</p>' +
      '</div>';
  }

  // ===================================================================
  // Publishing — one commit through the Git Data API
  // ===================================================================

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  function serialise(data) {
    return JSON.stringify(data, null, 2) + '\n';
  }

  function downloadJson() {
    const url = URL.createObjectURL(new Blob([serialise(state.data)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'site.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('#publish-btn').addEventListener('click', publish);

  async function publish() {
    if (state.busy) return;
    const n = changeCount();
    if (state.mode === 'preview') {
      const v = await modal('<h2>Preview mode</h2><p>In preview mode nothing is sent to GitHub. ' +
        (n ? 'You have ' + n + ' change' + (n === 1 ? '' : 's') + ' that would be published.' : 'You have not changed anything yet.') +
        '</p><p>Sign in with a GitHub token to publish for real.</p>' +
        '<div class="btns"><button type="button" data-close="dl">Download site.json</button><button type="button" class="primary" data-close="ok">OK</button></div>');
      if (v === 'dl') downloadJson();
      return;
    }
    if (!n) { toast('Nothing to publish — everything is up to date.'); return; }

    const problems = state.data.articles.filter((a) => a.status !== 'draft' && !a.title.trim());
    if (problems.length) { await alertBox('A story needs a title', '<p>Every published story needs a title. Give it one, or untick “Published on the site”.</p>'); return; }

    state.busy = true;
    const btn = $('#publish-btn');
    btn.disabled = true;
    const progress = document.createElement('div');
    progress.className = 'modal-back';
    progress.innerHTML = '<div class="modal" role="alertdialog" aria-live="polite"><h2>Publishing…</h2><p class="progress" id="pub-step">Checking GitHub…</p></div>';
    document.body.appendChild(progress);
    const step = (t) => { const el = $('#pub-step'); if (el) el.textContent = t; };
    const repo = '/repos/' + state.auth.repo;
    try {
      // 1. Was site.json changed elsewhere since we loaded it?
      const remote = await readRemoteSiteJson();
      if (remote.sha !== state.baseSha) {
        progress.hidden = true;
        const go = await confirmBox('The site was changed elsewhere',
          '<p>Since you opened the admin, the site’s content was changed on GitHub — perhaps from another device or by someone else.</p>' +
          '<p>If you publish now, <strong>your version replaces theirs</strong> and their changes to stories, photos or settings will be lost.</p>' +
          '<p>To keep their changes instead, cancel, note what you changed, then sign out and back in.</p>', 'Publish anyway', true);
        progress.hidden = false;
        if (!go) throw Object.assign(new Error('Publishing cancelled.'), { cancelled: true });
      }

      // 2. Where is the branch now?
      step('Reading the current version…');
      const ref = await gh('GET', repo + '/git/ref/heads/' + encPath(state.auth.branch));
      const headSha = ref.object.sha;
      const head = await gh('GET', repo + '/git/commits/' + headSha);

      // 3. Upload new photos as blobs.
      const tree = [];
      const uploads = Array.from(state.newPhotos.entries()).filter(([src]) => state.data.photos.some((p) => p.src === src));
      for (let i = 0; i < uploads.length; i++) {
        step('Uploading photo ' + (i + 1) + ' of ' + uploads.length + '…');
        const [src, blob] = uploads[i];
        const b = await gh('POST', repo + '/git/blobs', { content: await blobToBase64(blob), encoding: 'base64' });
        tree.push({ path: repoPath(src), mode: '100644', type: 'blob', sha: b.sha });
      }
      // 4. Remove deleted photos.
      state.deleted.forEach((src) => {
        if (!state.data.photos.some((p) => p.src === src)) tree.push({ path: repoPath(src), mode: '100644', type: 'blob', sha: null });
      });
      // 5. The new site.json.
      step('Saving stories and settings…');
      const json = await gh('POST', repo + '/git/blobs', { content: serialise(state.data), encoding: 'utf-8' });
      tree.push({ path: repoPath('content/site.json'), mode: '100644', type: 'blob', sha: json.sha });

      // 6. Tree → commit → move the branch.
      step('Creating the update…');
      const newTree = await gh('POST', repo + '/git/trees', { base_tree: head.tree.sha, tree });
      const parts = [];
      if (uploads.length) parts.push(uploads.length + ' new photo' + (uploads.length === 1 ? '' : 's'));
      if (state.deleted.size) parts.push(state.deleted.size + ' photo' + (state.deleted.size === 1 ? '' : 's') + ' removed');
      const message = 'Publish from admin: ' + n + ' change' + (n === 1 ? '' : 's') + (parts.length ? ' (' + parts.join(', ') + ')' : '');
      const commit = await gh('POST', repo + '/git/commits', { message, tree: newTree.sha, parents: [headSha] });
      step('Publishing…');
      try {
        await gh('PATCH', repo + '/git/refs/heads/' + encPath(state.auth.branch), { sha: commit.sha, force: false });
      } catch (e) {
        if (e.status === 422) {
          throw new Error('Someone else published at the same moment. Nothing was lost — press Publish again.');
        }
        throw e;
      }

      // 7. Success: what we have is now the published version.
      state.base = clone(state.data);
      state.baseSha = json.sha;
      state.newPhotos.clear();   // their object URLs stay in localUrls so they keep showing
      state.deleted.clear();
      changed();
      render();
      progress.remove();
      await alertBox('Published', '<p class="ok-box">Your changes are saved to GitHub.</p><p>The public site updates in a minute or two, once GitHub Pages has rebuilt it. Refresh the site to see them.</p>' +
        '<p><a href="index.html" target="_blank" rel="noopener">Open the site</a></p>');
    } catch (e) {
      progress.remove();
      if (!e.cancelled) {
        await alertBox('Not published', '<div class="error-box" style="margin-top:0">' + esc(e.status != null ? friendlyError(e, state.auth) : e.message) +
          '</div><p>Your changes are still here in the admin. You can try again.</p>');
      } else {
        toast('Publishing cancelled. Your changes are still here.');
      }
    } finally {
      state.busy = false;
      btn.disabled = false;
    }
  }

  // ===================================================================
  // Start
  // ===================================================================

  const saved = savedAuth();
  if (saved && saved.token && saved.repo) {
    let remember = false;
    try { remember = !!localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ }
    $('#remember').checked = remember;
    showSignin();
    $('#signin-error').hidden = true;
    signIn(saved, remember, true);
  } else {
    showSignin();
    $('#first-time').open = true;
  }
})();
