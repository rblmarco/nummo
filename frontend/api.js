/**
 * nummo – chiamate a Bilanci API.
 * Lettura con GET (ping, bootstrap, mese), scrittura con POST (ops add / update / delete).
 * Indirizzo e chiave arrivano da localStorage (impostati nella schermata Impostazioni):
 * nel codice non c'è nessun indirizzo né chiave.
 */
const Api = (function () {
  const TIMEOUT_MS = 25000;

  /** Controlla la forma dell'indirizzo; restituisce un messaggio d'errore o null. */
  function controllaIndirizzo(url) {
    const u = String(url || '').trim();
    if (!u) return "Manca l'indirizzo di Bilanci API";
    if (!/^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[^/]+\/(exec|dev)$/.test(u)) {
      return "L'indirizzo deve essere quello dell'app web, del tipo https://script.google.com/macros/s/…/exec";
    }
    if (/\/dev$/.test(u)) return "Usa l'indirizzo che termina con /exec, non /dev";
    return null;
  }

  /** Esegue una fetch con timeout e trasforma la risposta in JSON di Bilanci API. */
  async function chiama(url, opzioni) {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    let res, testo;
    try {
      res = await fetch(url, Object.assign({ signal: ctrl.signal, redirect: 'follow' }, opzioni));
      testo = await res.text();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Bilanci API non risponde (tempo scaduto)');
      // Rete assente, oppure deployment non pubblico: Google risponde con la pagina di accesso senza CORS
      throw new Error(navigator.onLine === false
        ? 'Sei offline'
        : 'Bilanci API non raggiungibile: controlla l\'indirizzo e che il deployment abbia accesso "Chiunque"');
    } finally {
      clearTimeout(t);
    }
    let json;
    try { json = JSON.parse(testo); }
    catch (e) { throw new Error('Risposta non valida da Bilanci API (HTTP ' + res.status + "): controlla l'indirizzo"); }
    if (!json.ok) throw new Error(json.errore || json.error || 'Errore sconosciuto da Bilanci API');
    return json;
  }

  function get(cfg, params) {
    const err = controllaIndirizzo(cfg.url);
    if (err) return Promise.reject(new Error(err));
    if (!cfg.key) return Promise.reject(new Error('Manca la chiave segreta'));
    const q = new URLSearchParams(Object.assign({}, params, { key: cfg.key }));
    return chiama(cfg.url.trim() + '?' + q.toString(), { method: 'GET' });
  }

  /** POST con corpo JSON in text/plain: niente preflight CORS. */
  function post(cfg, corpo) {
    const err = controllaIndirizzo(cfg.url);
    if (err) return Promise.reject(new Error(err));
    if (!cfg.key) return Promise.reject(new Error('Manca la chiave segreta'));
    return chiama(cfg.url.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ key: cfg.key }, corpo))
    });
  }

  return {
    controllaIndirizzo: controllaIndirizzo,
    /** Prova il collegamento: { ok, ping, foglio } */
    ping: function (cfg) { return get(cfg, { action: 'ping' }); },
    /** Dati iniziali: { foglio, oggi, categorie, conti, tag, movimenti } */
    bootstrap: function (cfg) { return get(cfg, { action: 'bootstrap' }); },
    /** Movimenti di un mese (AAAA-MM) */
    mese: function (cfg, ym) { return get(cfg, { action: 'mese', ym: ym }); },
    /** Invia operazioni add / update / delete: { risultati: [{ id, ok, errore? }] } */
    invia: function (cfg, ops) { return post(cfg, { ops: ops }); }
  };
})();
