/**
 * nummo – service worker.
 *
 * Due compiti:
 * 1. Uso offline: tiene una copia dei file dell'app (pagina, stile, codice, icone) e dei font,
 *    così l'app si apre anche senza rete. I dati (movimenti, coda) restano in IndexedDB: qui non passano.
 * 2. Aggiornamento automatico: per i file dell'app chiede sempre prima la versione nuova alla rete
 *    (convalidando la cache del browser) e usa la copia salvata solo se la rete non risponde.
 *    Così dopo un push basta riaprire l'app.
 *
 * Le chiamate a Bilanci API (script.google.com) non sono toccate.
 * VERSIONE va cambiata solo se cambia l'elenco dei file qui sotto o il funzionamento di questo file.
 */
const VERSIONE = 'sw-1';
const CACHE_APP = 'nummo-app-' + VERSIONE;
const CACHE_FONT = 'nummo-font';
const TEMPO_RETE_MS = 4000; // oltre questo tempo, con rete lenta, si usa la copia salvata

// Indispensabili: se uno manca l'installazione non va a buon fine e resta il service worker precedente
const FILE_APP = ['./', 'index.html', 'app.css', 'app.js', 'api.js'];
// Utili ma non indispensabili: se uno manca si va avanti lo stesso
const FILE_EXTRA = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', function (ev) {
  const nuovo = function (u) { return new Request(u, { cache: 'reload' }); };
  ev.waitUntil(
    caches.open(CACHE_APP)
      .then(function (c) {
        return c.addAll(FILE_APP.map(nuovo)).then(function () {
          return Promise.all(FILE_EXTRA.map(function (u) { return c.add(nuovo(u)).catch(function () {}); }));
        });
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys()
      .then(function (nomi) {
        return Promise.all(nomi.filter(function (n) { return n.indexOf('nummo-app-') === 0 && n !== CACHE_APP; })
          .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ev) {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Font di Google: prima la copia salvata (non cambiano), altrimenti la rete
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    ev.respondWith(primaCache(req, CACHE_FONT));
    return;
  }

  // File dell'app (stessa origine): prima la rete, poi la copia salvata
  if (url.origin === self.location.origin) {
    ev.respondWith(primaRete(req));
  }
  // Tutto il resto (Bilanci API) passa senza service worker
});

/** Rete con convalida della cache HTTP; se fallisce o è troppo lenta, la copia salvata. */
function primaRete(req) {
  const navigazione = req.mode === 'navigate';
  return caches.open(CACHE_APP).then(function (cache) {
    const rete = fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok && res.type === 'basic') cache.put(navigazione ? 'index.html' : req, res.clone());
      return res;
    });
    const copia = function () {
      return cache.match(navigazione ? 'index.html' : req, { ignoreSearch: true })
        .then(function (c) { return c || (navigazione ? cache.match('./') : undefined); });
    };
    return new Promise(function (ok, ko) {
      let fatto = false;
      const timer = setTimeout(function () {
        copia().then(function (c) { if (c && !fatto) { fatto = true; ok(c); } });
      }, TEMPO_RETE_MS);
      rete.then(function (res) {
        clearTimeout(timer);
        if (!fatto) { fatto = true; ok(res); }
      }).catch(function (err) {
        clearTimeout(timer);
        copia().then(function (c) {
          if (fatto) return;
          fatto = true;
          if (c) ok(c); else ko(err);
        });
      });
    });
  });
}

/** Copia salvata se c'è; altrimenti rete, salvando la risposta. */
function primaCache(req, nome) {
  return caches.open(nome).then(function (cache) {
    return cache.match(req).then(function (c) {
      if (c) return c;
      return fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      });
    });
  });
}
