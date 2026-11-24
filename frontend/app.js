/**
 * nummo – logica dell'interfaccia.
 * Passo attuale: Impostazioni (collegamento a Bilanci API) e lettura dei dati con bootstrap.
 * Inserisci e Movimenti sono ancora segnaposto.
 */
(function () {
  'use strict';

  /* ---------- Configurazione del dispositivo (localStorage) ---------- */

  const LS = { URL: 'nummo.url', KEY: 'nummo.key', DASHBOARD: 'nummo.dashboard', ESITO: 'nummo.esito' };

  function leggiConfig() {
    return {
      url: localStorage.getItem(LS.URL) || '',
      key: localStorage.getItem(LS.KEY) || '',
      dashboard: localStorage.getItem(LS.DASHBOARD) || ''
    };
  }
  function salvaConfig(c) {
    localStorage.setItem(LS.URL, c.url);
    localStorage.setItem(LS.KEY, c.key);
    if (c.dashboard) localStorage.setItem(LS.DASHBOARD, c.dashboard); else localStorage.removeItem(LS.DASHBOARD);
  }
  function configurato(c) { return !!(c.url && c.key); }

  /* ---------- Memoria locale (IndexedDB) ---------- */
  // Store "kv": copia dei dati dal foglio. La coda offline arriverà in un passo successivo.

  const Db = (function () {
    let dbp = null;
    const memoria = {};
    function apri() {
      if (!dbp) {
        dbp = new Promise(function (ok, ko) {
          if (!('indexedDB' in window)) return ko(new Error('IndexedDB non disponibile'));
          const req = indexedDB.open('nummo', 1);
          req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
          req.onsuccess = function () { ok(req.result); };
          req.onerror = function () { ko(req.error); };
        }).catch(function (err) { console.warn('IndexedDB non disponibile, uso la memoria:', err); return null; });
      }
      return dbp;
    }
    function tx(modo, fn) {
      return apri().then(function (db) {
        if (!db) return fn(null);
        return new Promise(function (ok, ko) {
          const t = db.transaction('kv', modo);
          const r = fn(t.objectStore('kv'));
          t.oncomplete = function () { ok(r && r.result); };
          t.onerror = function () { ko(t.error); };
        });
      });
    }
    return {
      get: function (k) {
        return tx('readonly', function (s) { return s ? s.get(k) : { result: memoria[k] }; });
      },
      set: function (k, v) {
        return tx('readwrite', function (s) { if (s) s.put(v, k); else memoria[k] = v; });
      }
    };
  })();

  /* ---------- Stato ---------- */

  const stato = {
    config: leggiConfig(),
    dati: null,            // ultimo bootstrap: { foglio, oggi, categorie, conti, tag, movimenti }
    ultimaSync: null,      // timestamp dell'ultimo bootstrap riuscito
    esito: JSON.parse(localStorage.getItem(LS.ESITO) || 'null'), // { ok, msg, quando }
    occupato: false,
    tab: 'impostazioni'
  };

  function registraEsito(ok, msg) {
    stato.esito = { ok: ok, msg: msg, quando: Date.now() };
    localStorage.setItem(LS.ESITO, JSON.stringify(stato.esito));
  }

  /* ---------- Utilità ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel) { return document.querySelector(sel); }

  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

  function isoOggi() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** "oggi 11:42", "ieri 09:10", "21 nov 10:00" */
  function quando(ts) {
    if (!ts) return 'mai';
    const d = new Date(ts);
    const ora = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    const giorno = new Date(d); giorno.setHours(0, 0, 0, 0);
    const diff = Math.round((oggi - giorno) / 86400000);
    if (diff === 0) return 'oggi ' + ora;
    if (diff === 1) return 'ieri ' + ora;
    return d.getDate() + ' ' + MESI[d.getMonth()] + ' ' + ora;
  }

  /** Colore "#RRGGBB" → rgba con opacità */
  function tinta(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return 'rgba(255,255,255,' + a + ')';
    const n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  let timerAvviso = null;
  function avviso(msg, errore) {
    const el = $('#avviso');
    el.className = 'avviso vetro-leggero' + (errore ? ' errore' : '');
    el.innerHTML = '<span class="ms f" aria-hidden="true">' + (errore ? 'error' : 'check_circle') + '</span>' + esc(msg);
    el.hidden = false;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(function () { el.hidden = true; }, errore ? 5000 : 2500);
  }

  /* ---------- Dati derivati dal bootstrap ---------- */

  /** Categorie raggruppate per macro, nell'ordine del foglio: [{ tipo, nome, icona, colore, ordine, sub: [] }] */
  function macroCategorie(tipo) {
    if (!stato.dati) return [];
    const mappa = new Map();
    stato.dati.categorie.forEach(function (c) {
      if (tipo && c.tipo !== tipo) return;
      const k = c.tipo + '|' + c.categoria;
      if (!mappa.has(k)) mappa.set(k, { tipo: c.tipo, nome: c.categoria, icona: c.icona, colore: c.colore, ordine: c.ordine, sub: [] });
      if (c.sottocategoria) mappa.get(k).sub.push(c.sottocategoria);
    });
    return Array.from(mappa.values()).sort(function (a, b) { return a.ordine - b.ordine; });
  }

  function contiSpesa() {
    if (!stato.dati) return [];
    return stato.dati.conti.filter(function (c) { return c.tipo === 'Spesa'; })
      .sort(function (a, b) { return a.ordine - b.ordine; });
  }

  function contoPredefinito() {
    const cs = contiSpesa();
    return cs.find(function (c) { return c.predefinito; }) || cs[0] || null;
  }

  /** Movimenti divisi in effettivi (fino a oggi) e in programma (data futura sul dispositivo) */
  function movimentiDivisi() {
    const oggi = isoOggi();
    const tutti = (stato.dati && stato.dati.movimenti) || [];
    return {
      effettivi: tutti.filter(function (m) { return m.data <= oggi; }),
      inProgramma: tutti.filter(function (m) { return m.data > oggi; })
    };
  }

  /* ---------- Sincronizzazione (per ora solo lettura) ---------- */

  async function caricaCache() {
    try {
      const c = await Db.get('bootstrap');
      if (c && c.dati) { stato.dati = c.dati; stato.ultimaSync = c.quando; }
    } catch (err) { console.warn('Cache non leggibile:', err); }
  }

  /** Scarica categorie, conti, tag e movimenti recenti. Restituisce true se riuscito. */
  async function aggiorna(silenzioso) {
    if (!configurato(stato.config) || stato.occupato) return false;
    stato.occupato = true;
    render();
    try {
      const r = await Api.bootstrap(stato.config);
      const dati = {
        foglio: r.foglio, oggi: r.oggi,
        categorie: r.categorie || [], conti: r.conti || [], tag: r.tag || [], movimenti: r.movimenti || []
      };
      stato.dati = dati;
      stato.ultimaSync = Date.now();
      await Db.set('bootstrap', { dati: dati, quando: stato.ultimaSync });
      registraEsito(true, 'Collegato');
      if (!silenzioso) avviso('Dati aggiornati dal foglio');
      return true;
    } catch (err) {
      registraEsito(false, err.message);
      if (!silenzioso || navigator.onLine !== false) avviso(err.message, true);
      return false;
    } finally {
      stato.occupato = false;
      render();
    }
  }

  /* ---------- Navigazione ---------- */

  function vaiA(tab) {
    if (!['inserisci', 'movimenti', 'impostazioni'].includes(tab)) tab = 'inserisci';
    stato.tab = tab;
    document.querySelectorAll('.schermo').forEach(function (s) { s.hidden = s.id !== 's-' + tab; });
    document.querySelectorAll('.barra a').forEach(function (a) {
      const attiva = a.dataset.tab === tab;
      a.classList.toggle('attiva', attiva);
      if (attiva) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    render();
  }

  /* ---------- Render ---------- */

  function render() {
    if (stato.tab === 'impostazioni') renderImpostazioni();
    if (stato.tab === 'inserisci') renderInserisci();
    if (stato.tab === 'movimenti') renderMovimenti();
  }

  function riga(o) {
    const tag = o.azione ? 'button' : (o.href ? 'a' : 'div');
    const attr = o.azione ? ' type="button" data-azione="' + o.azione + '"' : (o.href ? ' href="' + esc(o.href) + '" target="_blank" rel="noopener"' : '');
    return '<' + tag + ' class="riga' + (o.link ? ' link' : '') + '"' + attr + '>' +
      '<span class="riga-icona" style="background:' + o.colore + '"><span class="ms f" aria-hidden="true">' + o.icona + '</span></span>' +
      '<span class="riga-nome">' + esc(o.nome) + '</span>' +
      (o.valore != null ? '<span class="riga-valore">' + esc(o.valore) + '</span>' : '') +
      (o.fine ? '<span class="ms' + (o.fineClasse && o.fineClasse !== 'nav' ? ' f ' + o.fineClasse : '') + ' riga-fine" aria-hidden="true">' + o.fine + '</span>' : '') +
      '</' + tag + '>';
  }

  function renderImpostazioni() {
    const c = stato.config;
    const pronto = configurato(c);
    const d = stato.dati;

    // Collegamento
    let statoApi, fineApi, classeApi;
    if (!pronto) { statoApi = 'Da impostare'; fineApi = 'chevron_right'; classeApi = 'nav'; }
    else if (stato.occupato) { statoApi = 'Verifico…'; fineApi = null; }
    else if (stato.esito && stato.esito.ok) { statoApi = 'Collegato'; fineApi = 'check_circle'; classeApi = 'ok'; }
    else if (stato.esito) { statoApi = navigator.onLine === false ? 'Offline' : 'Errore'; fineApi = 'error'; classeApi = 'errore'; }
    else { statoApi = 'Non verificato'; fineApi = 'chevron_right'; classeApi = 'nav'; }

    let notaColl = 'La chiave resta solo su questo dispositivo.';
    if (d && d.foglio) notaColl += ' Foglio: ' + d.foglio + '.';
    if (pronto && stato.esito && !stato.esito.ok) notaColl = stato.esito.msg;

    // Dati dal foglio
    const macro = macroCategorie();
    const nSub = macro.reduce(function (n, m) { return n + m.sub.length; }, 0);
    const valCat = d ? macro.length + ' · ' + nSub + ' sotto' : '–';
    const valConti = d ? d.conti.length + ' · ' + d.tag.length : '–';
    const conto = contoPredefinito();

    const html =
      '<h1 class="titolo">Impostazioni</h1>' +

      '<span class="gruppo-titolo">Collegamento</span>' +
      '<div class="gruppo vetro">' +
        riga({ azione: 'collegamento', icona: 'link', colore: '#0D9488', nome: 'Bilanci API', valore: statoApi, fine: fineApi, fineClasse: classeApi }) +
        riga({ azione: 'collegamento', icona: 'key', colore: '#6366F1', nome: 'Chiave segreta', valore: c.key ? 'Salvata' : 'Mancante', fine: 'chevron_right', fineClasse: 'nav' }) +
      '</div>' +
      '<span class="gruppo-nota">' + esc(notaColl) + '</span>' +

      '<span class="gruppo-titolo">Sincronizzazione</span>' +
      '<div class="gruppo vetro">' +
        riga({ icona: 'sync', colore: '#0EA5E9', nome: 'Ultima sincronizzazione', valore: quando(stato.ultimaSync) }) +
        riga({ icona: 'schedule', colore: '#F59E0B', nome: 'In attesa', valore: '0' }) +
        '<div class="riga-pulsante"><button type="button" class="pulsante tinto-accento" data-azione="sincronizza"' + (pronto && !stato.occupato ? '' : ' disabled') + '>' +
          (stato.occupato ? '<span class="ms gira" aria-hidden="true">progress_activity</span>Sincronizzo…' : 'Sincronizza ora') +
        '</button></div>' +
      '</div>' +

      '<span class="gruppo-titolo">Dati dal foglio</span>' +
      '<div class="gruppo vetro">' +
        riga({ azione: d ? 'categorie' : null, icona: 'category', colore: '#A855F7', nome: 'Categorie', valore: valCat, fine: d ? 'chevron_right' : null, fineClasse: 'nav' }) +
        riga({ azione: d ? 'conti' : null, icona: 'account_balance_wallet', colore: '#EC4899', nome: 'Conti e tag', valore: valConti, fine: d ? 'chevron_right' : null, fineClasse: 'nav' }) +
        riga({ azione: pronto && !stato.occupato ? 'aggiorna' : null, icona: 'refresh', colore: '#10B981', nome: 'Aggiorna dal foglio', valore: stato.occupato ? 'Aggiorno…' : '' }) +
      '</div>' +

      '<span class="gruppo-titolo">Preferenze</span>' +
      '<div class="gruppo vetro">' +
        riga({ icona: 'tune', colore: '#64748B', nome: 'Conto preselezionato', valore: conto ? conto.nome : '–' }) +
        (c.dashboard
          ? riga({ href: c.dashboard, link: true, icona: 'insights', colore: '#2563EB', nome: 'Apri la dashboard', fine: 'open_in_new', fineClasse: 'nav' })
          : riga({ azione: 'collegamento', link: true, icona: 'insights', colore: '#2563EB', nome: 'Apri la dashboard', valore: 'Da impostare', fine: 'chevron_right', fineClasse: 'nav' })) +
      '</div>';

    $('#s-impostazioni').innerHTML = html;
  }

  function renderInserisci() {
    const d = stato.dati;
    let corpo;
    if (!configurato(stato.config)) {
      corpo = 'Per iniziare collega l\'app a Bilanci API in <strong>Impostazioni</strong>.';
    } else if (!d) {
      corpo = stato.occupato ? 'Scarico i dati dal foglio…' : 'Nessun dato ancora: apri <strong>Impostazioni</strong> e premi Sincronizza ora.';
    } else {
      corpo = 'Dati letti dal foglio <strong>' + esc(d.foglio) + '</strong>: ' +
        macroCategorie('Spesa').length + ' categorie di spesa, ' + macroCategorie('Entrata').length + ' di entrata. ' +
        'Anello e categorie arrivano nel prossimo passo.';
    }
    $('#s-inserisci').innerHTML = '<h1 class="titolo">Spese</h1><div class="segnaposto vetro">' + corpo + '</div>';
  }

  function renderMovimenti() {
    const d = stato.dati;
    let corpo;
    if (!d) {
      corpo = 'Nessun movimento scaricato.';
    } else {
      const div = movimentiDivisi();
      corpo = '<strong>' + div.effettivi.length + '</strong> movimenti negli ultimi 3 mesi, <strong>' +
        div.inProgramma.length + '</strong> in programma. La lista arriva in un passo successivo.';
    }
    $('#s-movimenti').innerHTML = '<h1 class="titolo">Movimenti</h1><div class="segnaposto vetro">' + corpo + '</div>';
  }

  /* ---------- Pannello dal basso ---------- */

  let chiudiPannelloCb = null;

  function apriPannello(html, onChiudi) {
    const p = $('#pannello');
    p.innerHTML = '<div class="maniglia"><span></span></div>' + html;
    p.hidden = false;
    $('#scrim').hidden = false;
    document.body.style.overflow = 'hidden';
    chiudiPannelloCb = onChiudi || null;
  }

  function chiudiPannello() {
    $('#pannello').hidden = true;
    $('#scrim').hidden = true;
    $('#pannello').innerHTML = '';
    document.body.style.overflow = '';
    const cb = chiudiPannelloCb; chiudiPannelloCb = null;
    if (cb) cb();
  }

  function testaPannello(icona, nome) {
    return '<div class="pannello-testa">' +
      '<span class="tondo tinto-accento"><span class="ms f" aria-hidden="true" style="color:var(--accento)">' + icona + '</span></span>' +
      '<span class="nome">' + esc(nome) + '</span>' +
      '<button type="button" class="tondo vetro-leggero" data-azione="chiudi" aria-label="Chiudi"><span class="ms" aria-hidden="true">close</span></button>' +
      '</div>';
  }

  /** Pannello Collegamento: indirizzo, chiave, dashboard; prova e salva. */
  function apriCollegamento() {
    const c = stato.config;
    apriPannello(
      testaPannello('link', 'Collegamento') +
      '<span class="campo-etichetta">Indirizzo di Bilanci API</span>' +
      '<label class="campo vetro"><span class="ms" aria-hidden="true">link</span><span class="sr">Indirizzo di Bilanci API</span>' +
        '<input id="f-url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url) + '"></label>' +
      '<span class="campo-etichetta">Chiave segreta</span>' +
      '<label class="campo vetro"><span class="ms" aria-hidden="true">key</span><span class="sr">Chiave segreta</span>' +
        '<input id="f-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="La chiave di API_KEY" value="' + esc(c.key) + '">' +
        '<button type="button" class="tondo" data-azione="mostra-chiave" aria-label="Mostra la chiave"><span class="ms" aria-hidden="true">visibility</span></button></label>' +
      '<span class="campo-etichetta">Indirizzo della dashboard (facoltativo)</span>' +
      '<label class="campo vetro"><span class="ms" aria-hidden="true">insights</span><span class="sr">Indirizzo della dashboard</span>' +
        '<input id="f-dash" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…" value="' + esc(c.dashboard) + '"></label>' +
      '<div id="f-esito" class="esito" hidden></div>' +
      '<div class="affiancati">' +
        '<button type="button" class="pulsante tinto-accento" data-azione="prova">Prova</button>' +
        '<button type="button" class="pulsante pieno" data-azione="salva-collegamento"><span class="ms" aria-hidden="true">check</span>Salva</button>' +
      '</div>'
    );
  }

  function leggiCampi() {
    return {
      url: $('#f-url').value.trim(),
      key: $('#f-key').value.trim(),
      dashboard: $('#f-dash').value.trim()
    };
  }

  function mostraEsito(ok, msg, inCorso) {
    const el = $('#f-esito');
    if (!el) return;
    el.hidden = false;
    el.className = 'esito' + (inCorso ? '' : ok ? ' ok' : ' errore');
    const icona = inCorso ? '<span class="ms gira" aria-hidden="true">progress_activity</span>'
      : '<span class="ms f" aria-hidden="true">' + (ok ? 'check_circle' : 'error') + '</span>';
    el.innerHTML = icona + '<span>' + esc(msg) + '</span>';
  }

  function controllaCampi(cfg) {
    const e = Api.controllaIndirizzo(cfg.url);
    if (e) return e;
    if (!cfg.key) return 'Manca la chiave segreta';
    if (cfg.dashboard && !/^https:\/\//.test(cfg.dashboard)) return "L'indirizzo della dashboard deve iniziare con https://";
    return null;
  }

  async function prova(cfg) {
    mostraEsito(true, 'Provo il collegamento…', true);
    try {
      const r = await Api.ping(cfg);
      mostraEsito(true, 'Collegato. Foglio dei movimenti: ' + r.foglio);
      return true;
    } catch (err) {
      mostraEsito(false, err.message);
      return false;
    }
  }

  async function azioneProva() {
    const cfg = leggiCampi();
    const e = controllaCampi(cfg);
    if (e) return mostraEsito(false, e);
    await prova(cfg);
  }

  async function azioneSalvaCollegamento() {
    const cfg = leggiCampi();
    const e = controllaCampi(cfg);
    if (e) return mostraEsito(false, e);
    const cambiato = cfg.url !== stato.config.url || cfg.key !== stato.config.key;
    salvaConfig(cfg);
    stato.config = cfg;
    if (!cambiato) { chiudiPannello(); render(); return; }
    // Indirizzo o chiave nuovi: si prova subito; anche se fallisce restano salvati
    const ok = await prova(cfg);
    if (ok) {
      chiudiPannello();
      aggiorna(false);
    } else {
      registraEsito(false, $('#f-esito').textContent);
      render();
    }
  }

  function apriCategorie() {
    const gruppi = ['Spesa', 'Entrata'].map(function (tipo) {
      const ms = macroCategorie(tipo);
      if (!ms.length) return '';
      return '<span class="gruppo-titolo">' + (tipo === 'Spesa' ? 'Spese' : 'Entrate') + '</span>' +
        '<div class="lista vetro">' + ms.map(function (m) {
          return '<div class="voce">' +
            '<span class="voce-icona" style="background:' + tinta(m.colore, .16) + '"><span class="ms f" aria-hidden="true" style="color:' + esc(m.colore || '#fff') + '">' + esc(m.icona || 'category') + '</span></span>' +
            '<span class="voce-testo"><span class="voce-titolo">' + esc(m.nome) + '</span>' +
            '<span class="voce-sotto">' + (m.sub.length ? esc(m.sub.join(' · ')) : 'Nessuna sottocategoria') + '</span></span>' +
            '</div>';
        }).join('') + '</div>';
    }).join('');
    apriPannello(testaPannello('category', 'Categorie') +
      '<div>' + gruppi + '<span class="gruppo-nota">Si cambiano nel foglio Categorie; poi Aggiorna dal foglio.</span></div>');
  }

  function apriConti() {
    const d = stato.dati;
    const conti = d.conti.slice().sort(function (a, b) { return a.ordine - b.ordine; });
    const htmlConti = conti.length ? conti.map(function (c) {
      return '<div class="voce"><span class="voce-testo"><span class="voce-titolo">' + esc(c.nome) + '</span>' +
        '<span class="voce-sotto">' + esc(c.tipo) + '</span></span>' +
        (c.predefinito ? '<span class="voce-destra">Predefinito</span>' : '') + '</div>';
    }).join('') : '<div class="voce"><span class="voce-sotto">Nessun conto attivo</span></div>';
    const htmlTag = d.tag.length ? d.tag.map(function (t) {
      return '<div class="voce"><span class="voce-testo"><span class="voce-titolo">' + esc(t.tag) + '</span>' +
        (t.etichetta ? '<span class="voce-sotto">' + esc(t.etichetta) + '</span>' : '') + '</span></div>';
    }).join('') : '<div class="voce"><span class="voce-sotto">Nessun tag attivo</span></div>';
    apriPannello(testaPannello('account_balance_wallet', 'Conti e tag') +
      '<div><span class="gruppo-titolo">Conti</span><div class="lista vetro">' + htmlConti + '</div>' +
      '<span class="gruppo-titolo">Tag</span><div class="lista vetro">' + htmlTag + '</div></div>');
  }

  /* ---------- Eventi ---------- */

  document.addEventListener('click', function (ev) {
    const el = ev.target.closest('[data-azione]');
    if (!el || el.disabled) return;
    const a = el.dataset.azione;
    if (a === 'collegamento') apriCollegamento();
    else if (a === 'sincronizza' || a === 'aggiorna') aggiorna(false);
    else if (a === 'categorie') apriCategorie();
    else if (a === 'conti') apriConti();
    else if (a === 'chiudi') chiudiPannello();
    else if (a === 'prova') azioneProva();
    else if (a === 'salva-collegamento') azioneSalvaCollegamento();
    else if (a === 'mostra-chiave') {
      const f = $('#f-key');
      f.type = f.type === 'password' ? 'text' : 'password';
      el.querySelector('.ms').textContent = f.type === 'password' ? 'visibility' : 'visibility_off';
    }
  });

  $('#scrim').addEventListener('click', chiudiPannello);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !$('#pannello').hidden) chiudiPannello();
  });

  window.addEventListener('hashchange', function () { vaiA(location.hash.slice(1)); });
  window.addEventListener('online', function () { aggiorna(true); });
  window.addEventListener('offline', render);

  /* ---------- Avvio ---------- */

  async function avvio() {
    await caricaCache();
    if (!configurato(stato.config)) {
      // Prima apertura: si va dritti al collegamento
      if (location.hash !== '#impostazioni') history.replaceState(null, '', '#impostazioni');
      vaiA('impostazioni');
      apriCollegamento();
      return;
    }
    vaiA(location.hash.slice(1) || 'inserisci');
    aggiorna(true);
  }

  avvio();
})();
