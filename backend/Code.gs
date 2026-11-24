/**
 * nummo – Bilanci API
 * Backend Apps Script della web app nummo. Progetto SEPARATO dalla dashboard.
 *
 * Proprietà dello script (Impostazioni progetto → Proprietà script):
 *   SHEET_ID    ID del Google Sheet (la parte tra /d/ e /edit dell'indirizzo)
 *   SHEET_NAME  foglio dei movimenti: "Dati nummo (prova)" durante la prova, poi "Dati 1Money"
 *   API_KEY     chiave segreta, la stessa da inserire nell'app al primo avvio
 *
 * Pubblicazione: Esegui il deployment → Nuovo deployment → App web,
 * "Esegui come: me", "Chi ha accesso: Chiunque".
 * Dopo ogni modifica: Gestisci deployment → matita → Nuova versione (l'URL non cambia).
 *
 * Nessun dato personale in questo file: il repo è pubblico.
 */

const FOGLI = { CATEGORIE: 'Categorie', CONTI: 'Conti', TAG: 'Tag' };
const FOGLIO_PROVA = 'Dati nummo (prova)';
const COLONNE = ['DATA', 'TIPOLOGIA', 'DAL CONTO', 'AL CONTO/ALLA CATEGORIA', 'IMPORTO', 'VALUTA',
  'IMPORTO 2', 'VALUTA 2', 'TAG', 'NOTE', 'ID', 'INSERITO_IL', 'FONTE', 'MODIFICATO_IL'];
const C = { DATA: 0, TIPO: 1, CONTO: 2, CAT: 3, IMPORTO: 4, NOTE: 9, ID: 10, INSERITO: 11, FONTE: 12, MODIFICATO: 13 };
const GIORNI_RECENTI = 92;

/* ---------- Ingressi HTTP ---------- */

function doGet(e) {
  return risposta_(function () {
    const p = (e && e.parameter) || {};
    controllaChiave_(p.key);
    if (p.action === 'ping') return { ping: 'ok', foglio: nomeFoglioDati_() };
    if (p.action === 'bootstrap') return bootstrap_();
    if (p.action === 'mese') return { movimenti: movimentiMese_(p.ym) };
    throw new Error('Azione sconosciuta: ' + p.action);
  });
}

function doPost(e) {
  return risposta_(function () {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    controllaChiave_(body.key);
    const ops = Array.isArray(body.ops) ? body.ops : [];
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sh = foglioDati_();
      return { risultati: ops.map(function (op) { return eseguiOp_(sh, op); }) };
    } finally {
      lock.releaseLock();
    }
  });
}

/* ---------- Lettura ---------- */

function bootstrap_() {
  const ss = ss_();
  const oggi = new Date();
  const da = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - GIORNI_RECENTI);
  const daKey = chiaveData_([da.getFullYear(), da.getMonth() + 1, da.getDate()]);
  return {
    foglio: nomeFoglioDati_(),
    oggi: isoData_([oggi.getFullYear(), oggi.getMonth() + 1, oggi.getDate()]),
    categorie: leggiCategorie_(ss),
    conti: leggiConti_(ss),
    tag: leggiTag_(ss),
    movimenti: leggiMovimenti_(function (d) { return chiaveData_(d) >= daKey; })
  };
}

function movimentiMese_(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
  if (!m) throw new Error('Mese non valido: usa AAAA-MM');
  const y = Number(m[1]), mm = Number(m[2]);
  return leggiMovimenti_(function (d) { return d[0] === y && d[1] === mm; });
}

function leggiMovimenti_(filtro) {
  const sh = foglioDati_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, COLONNE.length).getValues();
  const out = [];
  vals.forEach(function (r) {
    const tipo = String(r[C.TIPO]).trim();
    if (tipo !== 'Spesa' && tipo !== 'Entrata') return;
    const d = parseData_(r[C.DATA]);
    if (!d || !filtro(d)) return;
    const cat = separaCategoria_(String(r[C.CAT]).trim());
    out.push({
      id: String(r[C.ID] || '').trim() || null,
      data: isoData_(d),
      tipo: tipo,
      conto: String(r[C.CONTO] || '').trim(),
      categoria: cat[0],
      sottocategoria: cat[1],
      importo: parseImporto_(r[C.IMPORTO]),
      nota: String(r[C.NOTE] || '').trim(),
      fonte: String(r[C.FONTE] || '').trim() || null
    });
  });
  return out;
}

function leggiCategorie_(ss) {
  return righe_(ss, FOGLI.CATEGORIE).filter(function (r) { return si_(r.Attiva); }).map(function (r) {
    return {
      tipo: String(r.Tipo).trim(),
      categoria: String(r.Categoria).trim(),
      sottocategoria: String(r.Sottocategoria || '').trim() || null,
      ordine: Number(r.Ordine) || 999,
      icona: String(r.Icona || '').trim(),
      colore: String(r.Colore || '').trim()
    };
  });
}

function leggiConti_(ss) {
  return righe_(ss, FOGLI.CONTI).filter(function (r) { return si_(r.Attivo); }).map(function (r) {
    return {
      nome: String(r.Nome).trim(),
      tipo: String(r.Tipo || 'Spesa').trim(),
      ordine: Number(r.Ordine) || 999,
      predefinito: si_(r.Predefinito)
    };
  });
}

function leggiTag_(ss) {
  return righe_(ss, FOGLI.TAG).filter(function (r) { return si_(r.Attivo); }).map(function (r) {
    return { tag: String(r.Tag).trim(), etichetta: String(r.Etichetta || '').trim() };
  });
}

/* ---------- Scrittura ---------- */

function eseguiOp_(sh, op) {
  try {
    if (!op || !op.id) throw new Error('Operazione senza ID');
    const riga = trovaRiga_(sh, op.id);
    const ora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    if (op.op === 'add') {
      if (riga) return { id: op.id, ok: true, nota: 'già presente' };
      const r = rigaDaMovimento_(op.mov);
      r[C.ID] = op.id; r[C.INSERITO] = ora; r[C.FONTE] = 'app'; r[C.MODIFICATO] = '';
      sh.insertRowsAfter(1, 1);
      sh.getRange(2, 1, 1, COLONNE.length).setNumberFormat('@').setValues([r]);
      return { id: op.id, ok: true };
    }
    if (op.op === 'update') {
      if (!riga) throw new Error('Movimento non trovato');
      const vecchia = sh.getRange(riga, 1, 1, COLONNE.length).getValues()[0];
      const r = rigaDaMovimento_(op.mov);
      r[C.ID] = op.id; r[C.INSERITO] = vecchia[C.INSERITO]; r[C.FONTE] = vecchia[C.FONTE] || 'app'; r[C.MODIFICATO] = ora;
      sh.getRange(riga, 1, 1, COLONNE.length).setNumberFormat('@').setValues([r]);
      return { id: op.id, ok: true };
    }
    if (op.op === 'delete') {
      if (riga) sh.deleteRow(riga);
      return { id: op.id, ok: true };
    }
    throw new Error('Operazione sconosciuta: ' + op.op);
  } catch (err) {
    return { id: op && op.id, ok: false, errore: String(err.message || err) };
  }
}

function rigaDaMovimento_(m) {
  if (!m) throw new Error('Dati del movimento mancanti');
  const tipo = String(m.tipo || '').trim();
  if (tipo !== 'Spesa' && tipo !== 'Entrata') throw new Error('Tipo non valido: ' + tipo);
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(m.data || ''));
  if (!d) throw new Error('Data non valida: usa AAAA-MM-GG');
  const importo = Math.round(Math.abs(Number(m.importo)) * 100) / 100;
  if (!importo) throw new Error('Importo non valido');
  if (!m.categoria) throw new Error('Categoria mancante');
  const data = d[3] + '/' + d[2] + '/' + d[1].slice(2);
  const cat = m.sottocategoria ? m.categoria + ' (' + m.sottocategoria + ')' : String(m.categoria);
  const imp = String(importo);
  const r = new Array(COLONNE.length).fill('');
  r[C.DATA] = data; r[C.TIPO] = tipo; r[C.CONTO] = String(m.conto || ''); r[C.CAT] = cat;
  r[C.IMPORTO] = imp; r[5] = 'EUR'; r[6] = imp; r[7] = 'EUR'; r[8] = ''; r[C.NOTE] = String(m.nota || '');
  return r;
}

function trovaRiga_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const cell = sh.getRange(2, C.ID + 1, last - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return cell ? cell.getRow() : 0;
}

/* ---------- Funzioni da lanciare a mano ---------- */

/**
 * Crea i fogli Categorie, Conti, Tag e il foglio di prova, se mancano.
 * Non tocca fogli che esistono già. Dopo il lancio aggiungi a mano in Tag
 * e Conti i tuoi tag e i conti di investimento.
 */
function setupFogli() {
  const ss = ss_();
  if (!ss.getSheetByName(FOGLI.CATEGORIE)) {
    const sh = ss.insertSheet(FOGLI.CATEGORIE);
    const righe = [['Tipo', 'Categoria', 'Sottocategoria', 'Attiva', 'Ordine', 'Icona', 'Colore']];
    SCHEMA_CATEGORIE.forEach(function (c, i) {
      if (!c.sub.length) righe.push([c.tipo, c.nome, '', 'SÌ', i + 1, c.icona, c.colore]);
      c.sub.forEach(function (s) { righe.push([c.tipo, c.nome, s, 'SÌ', i + 1, c.icona, c.colore]); });
    });
    sh.getRange(1, 1, righe.length, righe[0].length).setValues(righe);
    sh.setFrozenRows(1);
  }
  if (!ss.getSheetByName(FOGLI.CONTI)) {
    const sh = ss.insertSheet(FOGLI.CONTI);
    sh.getRange(1, 1, 2, 5).setValues([['Nome', 'Tipo', 'Attivo', 'Ordine', 'Predefinito'], ['Liquidità', 'Spesa', 'SÌ', 1, 'SÌ']]);
    sh.setFrozenRows(1);
  }
  if (!ss.getSheetByName(FOGLI.TAG)) {
    const sh = ss.insertSheet(FOGLI.TAG);
    sh.getRange(1, 1, 2, 3).setValues([['Tag', 'Etichetta', 'Attivo'], ['#straordinaria', 'Straordinaria', 'SÌ']]);
    sh.setFrozenRows(1);
  }
  if (!ss.getSheetByName(FOGLIO_PROVA)) {
    const sh = ss.insertSheet(FOGLIO_PROVA);
    sh.getRange(1, 1, 1, COLONNE.length).setValues([COLONNE]);
    sh.setFrozenRows(1);
  }
  return 'Fogli pronti';
}

/**
 * Dà un ID alle righe che non ce l'hanno (storico importato da 1Money) nel foglio
 * indicato, di default quello di SHEET_NAME. Aggiunge le intestazioni delle colonne
 * K–N se mancano. Da lanciare il giorno del cambio su "Dati 1Money".
 */
function assegnaID(nomeFoglio) {
  const sh = ss_().getSheetByName(nomeFoglio || nomeFoglioDati_());
  if (!sh) throw new Error('Foglio non trovato');
  sh.getRange(1, C.ID + 1, 1, 4).setValues([COLONNE.slice(C.ID)]);
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const rng = sh.getRange(2, C.ID + 1, last - 1, 3);
  const vals = rng.getValues();
  let n = 0;
  vals.forEach(function (r) { if (!String(r[0]).trim()) { r[0] = Utilities.getUuid(); r[2] = r[2] || '1Money'; n++; } });
  rng.setNumberFormat('@').setValues(vals);
  return n + ' ID assegnati';
}

/** Genera una chiave casuale da mettere in API_KEY (la trovi nel registro di esecuzione). */
function generaChiave() {
  const k = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  Logger.log(k);
  return k;
}

/* ---------- Schema iniziale delle categorie (ordine = posizione nella schermata Inserisci) ---------- */

const SCHEMA_CATEGORIE = [
  { tipo: 'Spesa', nome: 'Cibo', icona: 'restaurant', colore: '#7FD3F2', sub: ['Spesa', 'Pranzo fuori', 'Cena fuori', 'Colazione e merende'] },
  { tipo: 'Spesa', nome: 'Tempo libero', icona: 'local_activity', colore: '#FFADE4', sub: ['Uscite', 'Intrattenimento', 'Cinema e spettacoli'] },
  { tipo: 'Spesa', nome: 'Auto e moto', icona: 'directions_car', colore: '#FFB95C', sub: ['Carburante', 'Assicurazione', 'Bollo', 'Manutenzione e revisione', 'Pedaggi e parcheggi', 'Accessori', 'Multe', 'Acquisto'] },
  { tipo: 'Spesa', nome: 'Mobilità', icona: 'train', colore: '#6FD8CB', sub: ['Mezzi pubblici', 'Treni', 'Taxi e sharing'] },
  { tipo: 'Spesa', nome: 'Casa', icona: 'home', colore: '#EDB1FF', sub: ['Luce', 'Gas', 'Internet', 'Tari', 'Condominio ordinario', 'Condominio straordinario', 'Manutenzione', 'Arredamento', 'Articoli per la casa', 'Piante', 'Acquisto'] },
  { tipo: 'Spesa', nome: 'Salute', icona: 'favorite', colore: '#8CD9A0', sub: ['Visite', 'Medicine', 'Cura personale'] },
  { tipo: 'Spesa', nome: 'Abbigliamento', icona: 'checkroom', colore: '#FFB68E', sub: ['Vestiti', 'Scarpe', 'Accessori'] },
  { tipo: 'Spesa', nome: 'Immobili', icona: 'apartment', colore: '#D8C8A8', sub: ['Condominio ordinario', 'Condominio straordinario', 'Tasse', 'Utenze', 'Manutenzione', 'Pratiche affitto'] },
  { tipo: 'Spesa', nome: 'Abbonamenti', icona: 'autorenew', colore: '#CDBDFF', sub: ['Telefono', 'Intrattenimento', 'Cloud e app'] },
  { tipo: 'Spesa', nome: 'Vacanze', icona: 'flight', colore: '#B8C4FF', sub: ['Viaggi', 'Weekend', 'Neve'] },
  { tipo: 'Spesa', nome: 'Regali', icona: 'redeem', colore: '#FFB1C3', sub: ['Regali', 'Fiori', 'Matrimoni ed eventi', 'Donazioni'] },
  { tipo: 'Spesa', nome: 'Sport', icona: 'fitness_center', colore: '#E3C74E', sub: ['Abbonamenti', 'Attività e ingressi', 'Attrezzatura'] },
  { tipo: 'Spesa', nome: 'Tecnologia', icona: 'devices', colore: '#BCC7DD', sub: ['Dispositivi', 'Accessori e cavi', 'Riparazioni'] },
  { tipo: 'Spesa', nome: 'Banca e pratiche', icona: 'account_balance', colore: '#A6C8FF', sub: ['Canoni e commissioni', 'Imposte di bollo', 'Commercialista', 'Documenti', 'Investimenti'] },
  { tipo: 'Entrata', nome: 'Stipendio', icona: 'payments', colore: '#7DD3C0', sub: ['Mensilità', 'Rimborsi'] },
  { tipo: 'Entrata', nome: 'Welfare', icona: 'redeem', colore: '#8CD9A0', sub: ['Buoni pasto', 'Welfare aziendale'] },
  { tipo: 'Entrata', nome: 'Affitto', icona: 'key', colore: '#D8C8A8', sub: ['Canone', 'Rimborso condominio'] },
  { tipo: 'Entrata', nome: 'Rendimenti', icona: 'trending_up', colore: '#A6C8FF', sub: ['Remunerazione liquidità'] },
  { tipo: 'Entrata', nome: 'Altri guadagni', icona: 'add_card', colore: '#FFB68E', sub: [] }
];

/* ---------- Utilità ---------- */

function risposta_(fn) {
  let out;
  try { out = Object.assign({ ok: true }, fn()); }
  catch (err) { out = { ok: false, errore: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function controllaChiave_(k) {
  const attesa = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!attesa) throw new Error('API_KEY non impostata nelle proprietà dello script');
  if (String(k || '') !== attesa) throw new Error('Chiave non valida');
}

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('SHEET_ID non impostato nelle proprietà dello script');
  return SpreadsheetApp.openById(id);
}

function nomeFoglioDati_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_NAME') || FOGLIO_PROVA;
}

function foglioDati_() {
  const sh = ss_().getSheetByName(nomeFoglioDati_());
  if (!sh) throw new Error('Non trovo il foglio "' + nomeFoglioDati_() + '": lancia setupFogli()');
  return sh;
}

function righe_(ss, nome) {
  const sh = ss.getSheetByName(nome);
  if (!sh || sh.getLastRow() < 2) return [];
  const vals = sh.getDataRange().getValues();
  const head = vals[0].map(function (h) { return String(h).trim(); });
  return vals.slice(1).filter(function (r) { return String(r[0]).trim(); }).map(function (r) {
    const o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o;
  });
}

function si_(v) { return /^(s[iìí]|true|x|1)$/i.test(String(v).trim()); }

function separaCategoria_(s) {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(s);
  return m ? [m[1], m[2]] : [s, null];
}

function parseData_(v) {
  if (v instanceof Date) return [v.getFullYear(), v.getMonth() + 1, v.getDate()];
  const p = String(v).trim().split('/');
  if (p.length !== 3) return null;
  let y = Number(p[2]); if (y < 100) y += 2000;
  const d = Number(p[0]), m = Number(p[1]);
  return y && m && d ? [y, m, d] : null;
}

function parseImporto_(v) {
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/\s|€/g, '');
  if (s.indexOf(',') >= 0 && s.indexOf('.') < 0) s = s.replace(',', '.');
  return s === '' ? NaN : Number(s);
}

function chiaveData_(d) { return d[0] * 10000 + d[1] * 100 + d[2]; }
function isoData_(d) { return d[0] + '-' + String(d[1]).padStart(2, '0') + '-' + String(d[2]).padStart(2, '0'); }
