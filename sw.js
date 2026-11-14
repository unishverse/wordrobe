/* Wordrobe service worker. Never touches the Apps Script API (cross-origin POSTs are not intercepted).
   - index.html / navigations: network first (3 s), cached copy only as a fallback, so a deploy reaches users at once
   - img/*, words-en.txt: cache first (bump VERSION when an image or the word list changes)
   - everything else on this origin, and Google Fonts: stale while revalidate */
var VERSION = 'wr-sw-1';
var PAGES = VERSION + '-pages', FILES = VERSION + '-files';

self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== PAGES && k !== FILES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(req) {
  return new Promise(function (resolve) {
    var settled = false;
    var fallback = function () { return caches.match(req, { cacheName: PAGES }); };
    var timer = setTimeout(function () {
      fallback().then(function (hit) { if (hit && !settled) { settled = true; resolve(hit); } });
    }, 3000);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) { var copy = res.clone(); caches.open(PAGES).then(function (c) { c.put(req, copy); }); }
      if (!settled) { settled = true; resolve(res); }
    }, function () {
      clearTimeout(timer);
      fallback().then(function (hit) { if (!settled) { settled = true; resolve(hit || Response.error()); } });
    });
  });
}
function cacheFirst(req) {
  return caches.match(req, { cacheName: FILES }).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(FILES).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  });
}
function staleWhileRevalidate(req) {
  return caches.open(FILES).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }, function () { return hit; });
      return hit || net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !fonts) return;
  if (fonts) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }
  if (/\/img\/|words-en\.txt$/.test(url.pathname)) { e.respondWith(cacheFirst(req)); return; }
  e.respondWith(staleWhileRevalidate(req));
});
