/**
 * nummo – logica dell'interfaccia.
 * Fatto: Impostazioni (collegamento a Bilanci API), lettura con bootstrap, Inserisci (anello del mese
 * e categorie in cornice), pannello Nuova spesa, salvataggio locale con coda offline e invio.
 * Movimenti è ancora un segnaposto.
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
  // Store "kv": copia dei dati dal foglio (bootstrap, mesi più vecchi).
  // Store "coda": movimenti salvati sul dispositivo e non ancora confermati da Bilanci API
  //   { id, op: 'add', mov: { data, tipo, conto, categoria, sottocategoria, importo, nota }, creato, tentativi, errore }

  const Db = (function () {
    let dbp = null;
    const memoria = { kv: {}, coda: {} };
    function apri() {
      if (!dbp) {
        dbp = new Promise(function (ok, ko) {
          if (!('indexedDB' in window)) return ko(new Error('IndexedDB non disponibile'));
          const req = indexedDB.open('nummo', 2);
          req.onupgradeneeded = function () {
            const db = req.result;
            if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
            if (!db.objectStoreNames.contains('coda')) db.createObjectStore('coda', { keyPath: 'id' });
          };
          req.onsuccess = function () { ok(req.result); };
          req.onerror = function () { ko(req.error); };
        }).catch(function (err) { console.warn('IndexedDB non disponibile, uso la memoria:', err); return null; });
      }
      return dbp;
    }
    function tx(store, modo, fn) {
      return apri().then(function (db) {
        if (!db) return fn(null);
        return new Promise(function (ok, ko) {
          const t = db.transaction(store, modo);
          const r = fn(t.objectStore(store));
          t.oncomplete = function () { ok(r && r.result); };
          t.onerror = function () { ko(t.error); };
          t.onabort = function () { ko(t.error); };
        });
      });
    }
    return {
      get: function (k) {
        return tx('kv', 'readonly', function (s) { return s ? s.get(k) : { result: memoria.kv[k] }; });
      },
      set: function (k, v) {
        return tx('kv', 'readwrite', function (s) { if (s) s.put(v, k); else memoria.kv[k] = v; });
      },
      coda: function () {
        return tx('coda', 'readonly', function (s) {
          return s ? s.getAll() : { result: Object.keys(memoria.coda).map(function (k) { return memoria.coda[k]; }) };
        }).then(function (r) { return (r || []).sort(function (a, b) { return a.creato - b.creato; }); });
      },
      metti: function (voce) {
        return tx('coda', 'readwrite', function (s) { if (s) s.put(voce); else memoria.coda[voce.id] = voce; });
      },
      togli: function (id) {
        return tx('coda', 'readwrite', function (s) { if (s) s.delete(id); else delete memoria.coda[id]; });
      }
    };
  })();

  /* ---------- Stato ---------- */

  const stato = {
    config: leggiConfig(),
    dati: null,            // ultimo bootstrap: { foglio, oggi, categorie, conti, tag, movimenti }
    ultimaSync: null,      // timestamp dell'ultimo bootstrap riuscito
    esito: JSON.parse(localStorage.getItem(LS.ESITO) || 'null'), // { ok, msg, quando }
    occupato: false,       // bootstrap in corso
    inviando: false,       // invio della coda in corso
    coda: [],              // copia in memoria dello store "coda"
    mesi: {},              // movimenti dei mesi fuori dal bootstrap: { 'AAAA-MM': [..] | 'carico' | 'errore' }
    ym: null,              // mese mostrato in Inserisci (AAAA-MM)
    tipo: 'Spesa',         // interruttore Spesa / Entrata
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

  function isoOggi() { return isoDa(new Date()); }

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

  const MESI_LUNGHI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  function isoDa(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dataDa(iso) { const p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function ymOggi() { return isoOggi().slice(0, 7); }
  function ymSposta(ym, n) { const p = ym.split('-'); return isoDa(new Date(+p[0], +p[1] - 1 + n, 1)).slice(0, 7); }
  function nomeMese(ym) { const p = ym.split('-'); return MESI_LUNGHI[+p[1] - 1] + ' ' + p[0]; }

  /** Etichetta della capsula data: "Oggi, 25 nov", "Ieri, 24 nov", "Domani, 26 nov", "Gio 4 dic", "4 dic 2025" */
  function etichettaData(iso) {
    const d = dataDa(iso);
    const oggi = dataDa(isoOggi());
    const diff = Math.round((d - oggi) / 86400000);
    const breve = d.getDate() + ' ' + MESI[d.getMonth()];
    if (diff === 0) return 'Oggi, ' + breve;
    if (diff === -1) return 'Ieri, ' + breve;
    if (diff === 1) return 'Domani, ' + breve;
    if (d.getFullYear() !== oggi.getFullYear()) return breve + ' ' + d.getFullYear();
    return GIORNI[d.getDay()] + ' ' + breve;
  }

  /** 2100 → "2.100", 210.4 → "210,40", 120 → "120" */
  function numero(n) {
    const r = Math.round(n * 100) / 100;
    const intero = Math.trunc(Math.abs(r));
    const dec = Math.round((Math.abs(r) - intero) * 100);
    const txt = String(intero).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + String(dec).padStart(2, '0') : '');
    return (r < 0 ? '−' : '') + txt;
  }
  function euro(n) { return numero(n) + ' €'; }

  function nuovoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
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

  /** Giorni coperti dal bootstrap (GIORNI_RECENTI in backend/Code.gs) */
  const GIORNI_RECENTI = 92;

  /** Movimenti del bootstrap più quelli ancora in coda (che contano già, anche se non inviati) */
  function movimentiTutti() {
    const inCoda = new Set(stato.coda.map(function (v) { return v.id; }));
    const base = ((stato.dati && stato.dati.movimenti) || []).filter(function (m) { return !m.id || !inCoda.has(m.id); });
    return base.concat(stato.coda.filter(function (v) { return v.op === 'add'; }).map(function (v) {
      return Object.assign({ id: v.id, inAttesa: true }, v.mov);
    }));
  }

  /** Movimenti divisi in effettivi (fino a oggi) e in programma (data futura sul dispositivo) */
  function movimentiDivisi() {
    const oggi = isoOggi();
    const tutti = movimentiTutti();
    return {
      effettivi: tutti.filter(function (m) { return m.data <= oggi; }),
      inProgramma: tutti.filter(function (m) { return m.data > oggi; })
    };
  }

  /** true se il mese è tutto dentro la finestra del bootstrap */
  function meseNelBootstrap(ym) {
    if (!stato.dati) return false;
    const base = dataDa(stato.dati.oggi || isoOggi());
    const da = isoDa(new Date(base.getFullYear(), base.getMonth(), base.getDate() - GIORNI_RECENTI));
    return ym + '-01' >= da;
  }

  /**
   * Movimenti effettivi di un mese (escluse le date future).
   * Restituisce un array, oppure 'carico' / 'errore' per i mesi da chiedere a Bilanci API.
   */
  function movimentiDelMese(ym) {
    const oggi = isoOggi();
    let lista;
    if (meseNelBootstrap(ym)) {
      lista = movimentiTutti();
    } else {
      const m = stato.mesi[ym];
      if (!Array.isArray(m)) return m || 'carico';
      const ids = new Set(m.map(function (x) { return x.id; }));
      lista = m.concat(movimentiTutti().filter(function (x) { return x.inAttesa && !ids.has(x.id); }));
    }
    return lista.filter(function (x) { return x.data.slice(0, 7) === ym && x.data <= oggi; });
  }

  async function caricaMese(ym) {
    if (stato.mesi[ym] === 'carico' || Array.isArray(stato.mesi[ym])) return;
    stato.mesi[ym] = 'carico';
    try {
      const c = await Db.get('mese:' + ym);
      if (c) { stato.mesi[ym] = c; render(); }
    } catch (e) { /* niente copia locale */ }
    try {
      const r = await Api.mese(stato.config, ym);
      stato.mesi[ym] = r.movimenti || [];
      Db.set('mese:' + ym, stato.mesi[ym]).catch(function () {});
    } catch (err) {
      if (!Array.isArray(stato.mesi[ym])) stato.mesi[ym] = 'errore';
    }
    render();
  }

  /* ---------- Sincronizzazione ---------- */

  async function caricaCache() {
    try {
      const c = await Db.get('bootstrap');
      if (c && c.dati) { stato.dati = c.dati; stato.ultimaSync = c.quando; }
    } catch (err) { console.warn('Cache non leggibile:', err); }
    try { stato.coda = await Db.coda(); }
    catch (err) { console.warn('Coda non leggibile:', err); }
  }

  /**
   * Invia a Bilanci API i movimenti in coda. Ogni voce resta in coda finché Bilanci API non la conferma:
   * un add con ID già presente nel foglio non crea doppioni, quindi ritentare è sempre sicuro.
   * Restituisce il numero di voci ancora in attesa.
   */
  async function invia() {
    if (!configurato(stato.config) || stato.inviando || !stato.coda.length) return stato.coda.length;
    if (navigator.onLine === false) return stato.coda.length;
    stato.inviando = true;
    render();
    const voci = stato.coda.slice();
    try {
      const r = await Api.invia(stato.config, voci.map(function (v) { return { op: v.op, id: v.id, mov: v.mov }; }));
      const esiti = new Map((r.risultati || []).map(function (x) { return [x.id, x]; }));
      for (const v of voci) {
        const e = esiti.get(v.id);
        if (e && e.ok) {
          await Db.togli(v.id);
          confermaInLocale(v);
        } else {
          v.tentativi = (v.tentativi || 0) + 1;
          v.errore = e ? (e.errore || 'Errore') : 'Nessuna risposta per questo movimento';
          await Db.metti(v);
        }
      }
      registraEsito(true, 'Collegato');
    } catch (err) {
      // Rete o Bilanci API non raggiungibile: la coda resta com'è e si ritenta più tardi
      voci.forEach(function (v) { v.tentativi = (v.tentativi || 0) + 1; v.errore = err.message; });
      await Promise.all(voci.map(function (v) { return Db.metti(v).catch(function () {}); }));
      if (navigator.onLine !== false) registraEsito(false, err.message);
    } finally {
      try { stato.coda = await Db.coda(); } catch (e) { /* resta la copia in memoria */ }
      stato.inviando = false;
      render();
    }
    return stato.coda.length;
  }

  /** Un movimento confermato passa dalla coda alla copia locale dei dati, finché il prossimo bootstrap non lo riporta. */
  function confermaInLocale(v) {
    if (v.op !== 'add') return;
    const m = Object.assign({ id: v.id, fonte: 'app' }, v.mov);
    if (stato.dati) {
      stato.dati.movimenti = (stato.dati.movimenti || []).filter(function (x) { return x.id !== v.id; }).concat([m]);
      Db.set('bootstrap', { dati: stato.dati, quando: stato.ultimaSync }).catch(function () {});
    }
    const ym = m.data.slice(0, 7);
    if (Array.isArray(stato.mesi[ym])) stato.mesi[ym] = stato.mesi[ym].filter(function (x) { return x.id !== v.id; }).concat([m]);
  }

  /** Salva un movimento nuovo: prima sul dispositivo, poi prova a inviarlo. */
  async function salvaMovimento(mov) {
    const voce = { id: nuovoId(), op: 'add', mov: mov, creato: Date.now(), tentativi: 0, errore: null };
    await Db.metti(voce);
    stato.coda = stato.coda.concat([voce]);
    render();
    invia();
    return voce;
  }

  /** Invia la coda e poi scarica categorie, conti, tag e movimenti recenti. Restituisce true se riuscito. */
  async function aggiorna(silenzioso) {
    if (!configurato(stato.config) || stato.occupato) return false;
    await invia();
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
      stato.mesi = {};
      await Db.set('bootstrap', { dati: dati, quando: stato.ultimaSync });
      registraEsito(true, 'Collegato');
      if (!silenzioso) avviso(stato.coda.length ? 'Dati aggiornati · ' + stato.coda.length + ' in attesa di invio' : 'Dati aggiornati dal foglio');
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
        riga({ icona: 'schedule', colore: '#F59E0B', nome: 'In attesa', valore: stato.inviando ? 'Invio…' : String(stato.coda.length), fine: stato.coda.length && !stato.inviando ? 'error' : null, fineClasse: 'errore' }) +
        '<div class="riga-pulsante"><button type="button" class="pulsante tinto-accento" data-azione="sincronizza"' + (pronto && !stato.occupato && !stato.inviando ? '' : ' disabled') + '>' +
          (stato.occupato || stato.inviando ? '<span class="ms gira" aria-hidden="true">progress_activity</span>Sincronizzo…' : 'Sincronizza ora') +
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

  /** Capsula in alto a destra: stato della sincronizzazione. Un tocco invia la coda e aggiorna. */
  function capsulaSync() {
    const n = stato.coda.length;
    let icona, testo, classe = '';
    if (stato.inviando || stato.occupato) { icona = '<span class="ms gira" aria-hidden="true">progress_activity</span>'; testo = stato.inviando ? 'Invio…' : 'Aggiorno…'; }
    else if (n) { icona = '<span class="ms f" aria-hidden="true">schedule</span>'; testo = n + ' in attesa'; classe = ' attesa'; }
    else if (navigator.onLine === false) { icona = '<span class="ms" aria-hidden="true">cloud_off</span>'; testo = 'Offline'; classe = ' spento'; }
    else if (stato.esito && !stato.esito.ok) { icona = '<span class="ms f" aria-hidden="true">error</span>'; testo = 'Non collegato'; classe = ' attesa'; }
    else { icona = '<span class="ms f" aria-hidden="true">cloud_done</span>'; testo = 'Sincronizzato'; }
    return '<button type="button" class="capsula-sync vetro-leggero' + classe + '" data-azione="sincronizza">' + icona + esc(testo) + '</button>';
  }

  /** Posizioni della cornice 5×4 attorno all'anello: riga 1, lati (righe 2–3), riga 4; poi righe in più sotto. */
  function posizioneCornice(i) {
    const giro = [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 1], [3, 1], [2, 5], [3, 5], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]];
    if (i < giro.length) return giro[i];
    const k = i - giro.length;
    return [5 + Math.floor(k / 5), 1 + (k % 5)];
  }

  /** Anello SVG: segmenti per categoria, dal più grande, con un piccolo stacco. */
  function anello(segmenti, totale) {
    const D = 224, S = 13, r = (D - S) / 2, circ = 2 * Math.PI * r;
    const stacco = segmenti.length > 1 ? 4 : 0;
    let off = 0;
    const archi = totale > 0 ? segmenti.map(function (g) {
      const len = circ * g.valore / totale;
      const vis = Math.max(len - stacco, 1.5);
      const el = '<circle cx="' + D / 2 + '" cy="' + D / 2 + '" r="' + r + '" fill="none" stroke="' + esc(g.colore) + '" stroke-width="' + S +
        '" stroke-dasharray="' + vis.toFixed(2) + ' ' + (circ - vis).toFixed(2) + '" stroke-dashoffset="' + (-off - stacco / 2).toFixed(2) + '"/>';
      off += len;
      return el;
    }).join('') : '';
    return '<svg class="anello-svg" viewBox="0 0 ' + D + ' ' + D + '" aria-hidden="true">' +
      '<g transform="rotate(-90 ' + D / 2 + ' ' + D / 2 + ')">' +
      '<circle cx="' + D / 2 + '" cy="' + D / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="' + S + '"/>' +
      archi + '</g></svg>';
  }

  function renderInserisci() {
    const d = stato.dati;
    const titolo = stato.tipo === 'Entrata' ? 'Entrate' : 'Spese';
    const testa = '<div class="testa"><h1 class="titolo">' + titolo + '</h1>' + (configurato(stato.config) ? capsulaSync() : '') + '</div>';
    if (!configurato(stato.config) || !d) {
      const corpo = !configurato(stato.config)
        ? 'Per iniziare collega l\'app a Bilanci API in <strong>Impostazioni</strong>.'
        : (stato.occupato ? 'Scarico i dati dal foglio…' : 'Nessun dato ancora: apri <strong>Impostazioni</strong> e premi Sincronizza ora.');
      $('#s-inserisci').innerHTML = testa + '<div class="segnaposto vetro">' + corpo + '</div>';
      return;
    }

    if (!stato.ym) stato.ym = ymOggi();
    const ym = stato.ym;
    const ultimo = ym >= ymOggi();
    const movs = movimentiDelMese(ym);
    if (movs === 'carico' && stato.mesi[ym] === undefined) caricaMese(ym);
    const pronti = Array.isArray(movs);

    // Totali del mese per tipo e per categoria
    const tot = { Spesa: 0, Entrata: 0 };
    const perCat = {};
    if (pronti) movs.forEach(function (m) {
      tot[m.tipo] = (tot[m.tipo] || 0) + m.importo;
      if (m.tipo === stato.tipo) perCat[m.categoria] = (perCat[m.categoria] || 0) + m.importo;
    });

    const macro = macroCategorie(stato.tipo);
    const coloreDi = {};
    macro.forEach(function (c) { coloreDi[c.nome] = c.colore; });
    const segmenti = Object.keys(perCat).filter(function (k) { return perCat[k] > 0; })
      .map(function (k) { return { nome: k, valore: perCat[k], colore: coloreDi[k] || 'rgba(235,235,245,.45)' }; })
      .sort(function (a, b) { return b.valore - a.valore; });

    const celle = macro.map(function (c, i) {
      const pos = posizioneCornice(i);
      const v = perCat[c.nome] || 0;
      const col = c.colore || '#FFFFFF';
      return '<button type="button" class="cella" data-azione="nuovo" data-cat="' + esc(c.nome) + '" style="grid-row:' + pos[0] + ';grid-column:' + pos[1] + '">' +
        '<span class="cella-icona" style="background:' + tinta(col, .132) + ';border-color:' + tinta(col, .14) + '"><span class="ms f" aria-hidden="true" style="color:' + esc(col) + '">' + esc(c.icona || 'category') + '</span></span>' +
        '<span class="cella-nome">' + esc(c.nome) + '</span>' +
        '<span class="cella-importo" style="color:' + (v ? esc(col) : 'var(--t3)') + '">' + (pronti ? euro(v) : '…') + '</span>' +
        '</button>';
    }).join('');

    const altro = stato.tipo === 'Entrata' ? 'Spese' : 'Entrate';
    let centro;
    if (pronti) {
      centro = '<span class="anello-etichetta">' + titolo + '</span>' +
        '<span class="anello-totale">' + euro(tot[stato.tipo]) + '</span>' +
        '<span class="anello-altro">' + altro + ' ' + euro(tot[stato.tipo === 'Entrata' ? 'Spesa' : 'Entrata']) + '</span>';
    } else if (movs === 'errore') {
      centro = '<span class="anello-etichetta">Mese non disponibile</span><span class="anello-altro">Serve la rete per i mesi più vecchi</span>';
    } else {
      centro = '<span class="anello-etichetta">Carico il mese…</span>';
    }

    $('#s-inserisci').innerHTML = testa +
      '<div class="mese">' +
        '<button type="button" class="tondo-40 vetro-leggero" data-azione="mese" data-passo="-1" aria-label="Mese precedente"><span class="ms" aria-hidden="true">chevron_left</span></button>' +
        '<span class="mese-nome">' + nomeMese(ym) + '</span>' +
        '<button type="button" class="tondo-40 vetro-leggero" data-azione="mese" data-passo="1" aria-label="Mese successivo"' + (ultimo ? ' disabled' : '') + '><span class="ms" aria-hidden="true">chevron_right</span></button>' +
      '</div>' +
      '<div class="segmentato vetro-leggero" role="tablist">' +
        ['Spesa', 'Entrata'].map(function (t) {
          return '<button type="button" role="tab" data-azione="tipo" data-tipo="' + t + '" aria-selected="' + (stato.tipo === t) + '"' + (stato.tipo === t ? ' class="attivo"' : '') + '>' + t + '</button>';
        }).join('') +
      '</div>' +
      '<div class="cornice">' + celle +
        '<div class="anello">' + anello(segmenti, tot[stato.tipo]) + '<div class="anello-centro">' + centro + '</div></div>' +
      '</div>' +
      '<p class="suggerimento">Tocca una categoria per registrare ' + (stato.tipo === 'Entrata' ? 'un\'entrata' : 'una spesa') + '</p>';
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

  /* ---------- Pannello Nuova spesa / Nuova entrata ---------- */

  const COLORE_CONTO = '#F0ABFC';
  const OPERATORI = '+−×÷';
  let ns = null; // stato del pannello aperto

  /** Calcolo dell'espressione del tastierino ("12,5+3×2") con precedenza di × e ÷. null se non valida. */
  function calcola(expr) {
    const t = String(expr).match(/(\d+(?:,\d*)?|,\d+|[+−×÷])/g);
    if (!t) return null;
    const out = [];
    let n = null;
    for (let i = 0; i < t.length; i++) {
      const x = t[i];
      if (OPERATORI.indexOf(x) >= 0) { out.push(x); continue; }
      n = parseFloat(x.replace(',', '.'));
      if (isNaN(n)) n = 0;
      const op = out[out.length - 1];
      if (op === '×' || op === '÷') {
        out.pop();
        const a = out.pop();
        if (op === '÷' && n === 0) return null;
        out.push(op === '×' ? a * n : a / n);
      } else out.push(n);
    }
    if (OPERATORI.indexOf(out[out.length - 1]) >= 0) out.pop(); // operatore finale ignorato
    let r = out[0];
    for (let i = 1; i < out.length; i += 2) r = out[i] === '+' ? r + out[i + 1] : r - out[i + 1];
    return typeof r === 'number' && isFinite(r) ? Math.round(r * 100) / 100 : null;
  }

  /** "1234,5+3" → "1.234,5 + 3" */
  function mostraEspressione(expr) {
    return expr.replace(/\d+/g, function (cifre, pos, tutto) {
      return tutto[pos - 1] === ',' ? cifre : cifre.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }).replace(/([+−×÷])/g, ' $1 ');
  }

  function premiTasto(k) {
    let e = ns.expr;
    const numCorrente = (e.match(/[\d,]*$/) || [''])[0];
    if (k === 'canc') e = e.slice(0, -1);
    else if (OPERATORI.indexOf(k) >= 0) {
      if (!e) return;
      if (OPERATORI.indexOf(e.slice(-1)) >= 0) e = e.slice(0, -1);
      if (e.slice(-1) === ',') e = e.slice(0, -1);
      e += k;
    } else if (k === ',') {
      if (numCorrente.indexOf(',') >= 0) return;
      e += numCorrente ? ',' : '0,';
    } else {
      // al massimo due decimali e 7 cifre intere per numero
      const dec = numCorrente.split(',')[1];
      if (dec != null && dec.length >= 2) return;
      if (dec == null && numCorrente.replace(/^0+/, '').length >= 7) return;
      if (numCorrente === '0') e = e.slice(0, -1);
      e += k;
    }
    ns.expr = e;
    renderImporto();
  }

  /** Voci visibili del selettore: centro più fino a due per lato, lista circolare senza ripetizioni. */
  function vociSelettore(n, i) {
    const m = function (k) { return ((i + k) % n + n) % n; };
    return {
      l2: n >= 5 ? m(-2) : null,
      l1: n >= 3 ? m(-1) : null,
      r1: n >= 2 ? m(1) : null,
      r2: n >= 4 ? m(2) : null
    };
  }

  function htmlSelettore(chi) {
    const isSub = chi === 'sub';
    const lista = isSub ? ns.cat.sub : ns.conti.map(function (c) { return c.nome; });
    const i = isSub ? ns.subIdx : ns.contoIdx;
    const col = isSub ? (ns.cat.colore || '#FFFFFF') : COLORE_CONTO;
    const icona = isSub ? (ns.cat.icona || 'category') : 'account_balance_wallet';
    const v = vociSelettore(lista.length, i);
    const lato = function (k, passo, livello) {
      return k == null ? '' : '<button type="button" class="sel-lato l' + livello + ' vetro-leggero" data-azione="scorri" data-sel="' + chi + '" data-passo="' + passo + '" tabindex="-1">' + esc(lista[k]) + '</button>';
    };
    return '<div class="sel" id="sel-' + chi + '" data-sel="' + chi + '" role="group" aria-label="' + (isSub ? 'Sottocategoria' : 'Conto') + '">' +
      '<div class="sel-traccia">' +
        '<div class="sel-sx">' + lato(v.l2, -2, 2) + lato(v.l1, -1, 1) + '</div>' +
        '<div class="sel-centro" style="background:' + tinta(col, .156) + ';border-color:' + tinta(col, .14) + '">' +
          '<span class="sel-icona" style="background:' + tinta(col, .2) + '"><span class="ms f" aria-hidden="true" style="color:' + esc(col) + '">' + esc(icona) + '</span></span>' +
          '<span class="sel-testo"><span class="sel-etichetta">' + (isSub ? 'Sottocategoria' : 'Conto') + '</span><span class="sel-valore">' + esc(lista[i]) + '</span></span>' +
        '</div>' +
        '<div class="sel-dx">' + lato(v.r1, 1, 1) + lato(v.r2, 2, 2) + '</div>' +
      '</div></div>';
  }

  function scorriSelettore(chi, passo) {
    if (!ns || !passo) return;
    const n = chi === 'sub' ? ns.cat.sub.length : ns.conti.length;
    if (n < 2) return;
    if (chi === 'sub') ns.subIdx = ((ns.subIdx + passo) % n + n) % n;
    else ns.contoIdx = ((ns.contoIdx + passo) % n + n) % n;
    const el = document.getElementById('sel-' + chi);
    if (el) el.outerHTML = htmlSelettore(chi);
  }

  function renderImporto() {
    const el = document.getElementById('ns-importo');
    if (!el) return;
    const e = ns.expr;
    const conOp = /[+−×÷]/.test(e);
    const r = calcola(e);
    const vuoto = !e;
    const testo = vuoto ? '0' : mostraEspressione(e);
    el.innerHTML =
      '<span class="importo-riga"><span class="importo-num' + (vuoto ? ' vuoto' : '') + (testo.length > 9 ? ' lungo' : '') + (testo.length > 14 ? ' lunghissimo' : '') + '">' + esc(testo) + '</span><span class="importo-euro">€</span></span>' +
      (conOp ? '<span class="importo-risultato">= ' + (r == null ? '–' : euro(r)) + '</span>' : '');
  }

  function renderData() {
    const el = document.getElementById('ns-data');
    if (!el) return;
    const futura = ns.data > isoOggi();
    el.classList.toggle('futura', futura);
    el.querySelector('.ms').textContent = futura ? 'event' : 'calendar_today';
    el.querySelector('.data-testo').textContent = etichettaData(ns.data);
    el.setAttribute('aria-label', 'Data: ' + etichettaData(ns.data) + (futura ? ', in programma' : '') + '. Cambia data');
  }

  function htmlTag() {
    const tags = (stato.dati && stato.dati.tag) || [];
    if (!tags.length) return '';
    return '<div class="tag-chip" id="ns-tag">' + tags.map(function (t) {
      const on = ns.tag.has(t.tag);
      return '<button type="button" class="chip ' + (on ? 'scelto' : 'vetro-leggero') + '" data-azione="tag" data-tag="' + esc(t.tag) + '" aria-pressed="' + on + '"' +
        (t.etichetta ? ' title="' + esc(t.etichetta) + '"' : '') + '>' +
        (on ? '<span class="ms" aria-hidden="true">check</span>' : '') + esc(t.tag) + '</button>';
    }).join('') + '</div>';
  }

  function apriNuovo(nomeCat) {
    const cat = macroCategorie(stato.tipo).find(function (c) { return c.nome === nomeCat; });
    if (!cat) return;
    const conti = contiSpesa();
    const pred = contoPredefinito();
    // Data proposta: oggi se si guarda il mese in corso, altrimenti l'ultimo giorno del mese mostrato
    const data = (!stato.ym || stato.ym === ymOggi()) ? isoOggi() : isoDa(new Date(+stato.ym.slice(0, 4), +stato.ym.slice(5, 7), 0));
    ns = {
      tipo: stato.tipo, cat: cat, conti: conti,
      subIdx: 0, contoIdx: Math.max(0, conti.indexOf(pred)),
      expr: '', tag: new Set(), data: data
    };
    const col = cat.colore || '#FFFFFF';
    const tasti = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', ',', '0', 'canc', '+'];
    const nomiOp = { '÷': 'Diviso', '×': 'Per', '−': 'Meno', '+': 'Più' };
    apriPannello(
      '<div class="pannello-testa">' +
        '<span class="tondo" style="background:' + tinta(col, .132) + ';border:1px solid ' + tinta(col, .14) + '"><span class="ms f" aria-hidden="true" style="color:' + esc(col) + '">' + esc(cat.icona || 'category') + '</span></span>' +
        '<span class="nome">' + esc(cat.nome) + '</span>' +
        '<label class="capsula-data vetro-leggero" id="ns-data"><span class="ms" aria-hidden="true">calendar_today</span><span class="data-testo"></span>' +
          '<input type="date" id="ns-data-input" value="' + data + '" required></label>' +
        '<button type="button" class="tondo vetro-leggero" data-azione="chiudi" aria-label="Chiudi"><span class="ms" aria-hidden="true">close</span></button>' +
      '</div>' +
      (cat.sub.length ? htmlSelettore('sub') : '') +
      (conti.length >= 2 ? htmlSelettore('conto') : '') +
      '<div class="importo" id="ns-importo" aria-live="polite"></div>' +
      '<label class="campo vetro"><span class="ms" aria-hidden="true">edit_note</span><span class="sr">Nota</span>' +
        '<input id="ns-nota" type="text" autocomplete="off" enterkeyhint="done" placeholder="Nota"></label>' +
      htmlTag() +
      '<div class="tastierino">' + tasti.map(function (k) {
        if (k === 'canc') return '<button type="button" class="tasto vetro-leggero" data-tasto="canc" aria-label="Cancella"><span class="ms" aria-hidden="true">backspace</span></button>';
        const op = OPERATORI.indexOf(k) >= 0;
        return '<button type="button" class="tasto ' + (op ? 'op' : 'vetro-leggero') + '" data-tasto="' + k + '"' + (op ? ' aria-label="' + nomiOp[k] + '"' : '') + '>' + k + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="pulsante pieno" data-azione="salva-movimento"><span class="ms" aria-hidden="true">check</span>Salva ' + (ns.tipo === 'Entrata' ? 'entrata' : 'spesa') + '</button>',
      function () { ns = null; }
    );
    renderImporto();
    renderData();
  }

  async function azioneSalvaMovimento() {
    if (!ns) return;
    const importo = calcola(ns.expr);
    if (importo == null || importo <= 0) {
      avviso(importo != null && importo < 0 ? "Il risultato è negativo: controlla l'operazione" : 'Inserisci un importo', true);
      return;
    }
    if (!ns.conti.length) { avviso('Nessun conto di spesa attivo nel foglio Conti', true); return; }
    const testoNota = ($('#ns-nota').value || '').trim().replace(/\s+/g, ' ');
    const tags = ((stato.dati && stato.dati.tag) || []).map(function (t) { return t.tag; }).filter(function (t) { return ns.tag.has(t); });
    const mov = {
      data: ns.data,
      tipo: ns.tipo,
      conto: ns.conti[ns.contoIdx].nome,
      categoria: ns.cat.nome,
      sottocategoria: ns.cat.sub.length ? ns.cat.sub[ns.subIdx] : null,
      importo: importo,
      nota: [testoNota].concat(tags).filter(Boolean).join(' ')
    };
    const futura = mov.data > isoOggi();
    const cosa = mov.tipo === 'Entrata' ? 'Entrata' : 'Spesa';
    chiudiPannello();
    try {
      await salvaMovimento(mov);
    } catch (err) {
      avviso('Non salvata: ' + err.message, true);
      return;
    }
    const offline = navigator.onLine === false ? ' · in attesa di invio' : '';
    avviso((futura ? cosa + ' programmata per ' + etichettaData(mov.data).replace(/^\w+, /, '') : cosa + ' salvata · ' + euro(importo)) + offline);
  }

  /* Trascinamento dei selettori: il dito sposta la fila, al rilascio si avanza di tante voci quante ne ha percorse. */
  let trascina = null;
  let ignoraClick = false;
  document.addEventListener('pointerdown', function (ev) {
    const sel = ev.target.closest('.sel');
    if (!sel || !ns) return;
    trascina = { sel: sel, chi: sel.dataset.sel, x0: ev.clientX, dx: 0, traccia: sel.querySelector('.sel-traccia'), id: ev.pointerId };
  });
  document.addEventListener('pointermove', function (ev) {
    if (!trascina || ev.pointerId !== trascina.id) return;
    trascina.dx = ev.clientX - trascina.x0;
    if (Math.abs(trascina.dx) > 6) {
      trascina.traccia.style.transition = 'none';
      trascina.traccia.style.transform = 'translateX(' + trascina.dx + 'px)';
    }
  });
  function fineTrascina(ev) {
    if (!trascina || ev.pointerId !== trascina.id) return;
    const t = trascina; trascina = null;
    if (Math.abs(t.dx) <= 6) return;
    ignoraClick = true;
    setTimeout(function () { ignoraClick = false; }, 0);
    const passo = Math.max(-4, Math.min(4, -Math.round(t.dx / 80))) || (t.dx < 0 ? 1 : -1);
    scorriSelettore(t.chi, passo);
  }
  document.addEventListener('pointerup', fineTrascina);
  document.addEventListener('pointercancel', function (ev) {
    if (!trascina || ev.pointerId !== trascina.id) return;
    trascina.traccia.style.transform = '';
    trascina = null;
  });

  /* ---------- Eventi ---------- */

  document.addEventListener('click', function (ev) {
    if (ignoraClick) { ev.preventDefault(); return; }
    const tasto = ev.target.closest('[data-tasto]');
    if (tasto && ns) { premiTasto(tasto.dataset.tasto); return; }
    const el = ev.target.closest('[data-azione]');
    if (!el || el.disabled) return;
    const a = el.dataset.azione;
    if (a === 'nuovo') apriNuovo(el.dataset.cat);
    else if (a === 'mese') { stato.ym = ymSposta(stato.ym || ymOggi(), +el.dataset.passo); if (stato.ym > ymOggi()) stato.ym = ymOggi(); render(); }
    else if (a === 'tipo') { stato.tipo = el.dataset.tipo; render(); }
    else if (a === 'scorri') scorriSelettore(el.dataset.sel, +el.dataset.passo);
    else if (a === 'tag' && ns) {
      const t = el.dataset.tag;
      if (ns.tag.has(t)) ns.tag.delete(t); else ns.tag.add(t);
      $('#ns-tag').outerHTML = htmlTag();
    }
    else if (a === 'salva-movimento') azioneSalvaMovimento();
    else if (a === 'collegamento') apriCollegamento();
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

  // Data del movimento: il campo data è invisibile sopra la capsula; sul PC si apre il calendario con showPicker
  document.addEventListener('change', function (ev) {
    if (ev.target.id === 'ns-data-input' && ns) {
      if (ev.target.value) ns.data = ev.target.value; else ev.target.value = ns.data;
      renderData();
    }
  });
  document.addEventListener('click', function (ev) {
    const inp = ev.target.id === 'ns-data-input' ? ev.target : null;
    if (inp && inp.showPicker) { try { inp.showPicker(); } catch (e) { /* già aperto */ } }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && ev.target.id === 'ns-nota') ev.target.blur();
  });

  $('#scrim').addEventListener('click', chiudiPannello);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !$('#pannello').hidden) chiudiPannello();
  });

  window.addEventListener('hashchange', function () { vaiA(location.hash.slice(1)); });
  window.addEventListener('online', function () { aggiorna(true); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') invia(); });
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
