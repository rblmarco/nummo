# App spese – Overview funzionale

Aggiornata al 25/11/2026. Specifica funzionale dell'app **nummo**.

## Obiettivo e principi

Web app personale per registrare spese ed entrate in pochi secondi, come con 1Money, che scrive direttamente nel Google Sheet **Bilanci**. Sostituisce 1Money per l'inserimento; per grafici e totali resta la dashboard Apps Script.

- **Veloce come 1Money**: si apre all'istante, una spesa in pochi tocchi.
- **Il foglio è l'unico archivio**: niente export/import CSV, niente dati che vivono solo sul telefono.
- **Le categorie le decide il foglio**: si cambiano nello Sheet, l'app le scarica; i movimenti già registrati non cambiano mai.
- **Funziona offline**: le spese restano in coda e partono quando torna la rete.
- **Sempre a portata**: icona sulla Home del telefono (Galaxy A54, viewport 412×892) e stesso indirizzo dal browser del PC.
- **Niente doppioni con la dashboard**: grafici, confronti e analisi restano lì.

## Architettura

```
Telefono / PC (browser)
   │  web app installabile (PWA) – codice su GitHub, pubblicata con GitHub Pages
   │  memoria locale + coda offline, chiave salvata sul dispositivo
   ▼
Bilanci API – progetto Apps Script SEPARATO dalla dashboard
   │  web app "Esegui come: me", accesso "Chiunque", protetta da chiave segreta
   │  LockService per le scritture, niente doppioni (ID)
   ▼
Google Sheet "Bilanci" – fogli Dati 1Money, Categorie, Conti, Tag
   ▲
Dashboard Apps Script di oggi – solo lettura, invariata
```

- Repository GitHub pubblico (GitHub Pages gratuito lo richiede): nel codice non ci sono dati né chiavi.
- Bilanci API è separato dalla dashboard perché va pubblicato con accesso "Chiunque": nel progetto della dashboard renderebbe pubblica anche la dashboard.
- Chiamate dalla web app: GET per leggere (`ping`, `bootstrap`, `mese`, `periodo`), POST con `Content-Type: text/plain` (evita il preflight CORS) per scrivere (operazioni `add` / `update` / `delete` con ID); ogni richiesta porta la chiave.
- La chiave sta nelle proprietà dello script (`PropertiesService`), non in un foglio né nel codice.

## Fogli e struttura dati

**Dati 1Money** – resta il foglio letto dalla dashboard. L'app scrive con le stesse colonne del CSV di 1Money (`DATA dd/mm/yy`, `TIPOLOGIA`, `DAL CONTO`, `AL CONTO/ALLA CATEGORIA` come "Macro (Sub)", `IMPORTO`, `VALUTA`, `IMPORTO 2`, `VALUTA 2`, `TAG`, `NOTE`). Formato verificato sul `Code.gs` della dashboard e sugli export (24/11/2026):

- le righe nuove si inseriscono in cima (riga 2), come fa l'import, in formato testo (`@`);
- `DATA` `dd/mm/yy` (es. `09/11/26`); `TIPOLOGIA` `Spesa` o `Entrata`; `DAL CONTO` il conto (Liquidità); `AL CONTO/ALLA CATEGORIA` `Macro (Sub)` oppure solo `Macro`;
- `IMPORTO` sempre positivo, punto decimale e niente zeri finali (`11.5`, `36`); `VALUTA` `EUR`; `IMPORTO 2` uguale a `IMPORTO`; `VALUTA 2` `EUR`; `TAG` vuoto; `NOTE` con gli hashtag;
- la dashboard legge solo le prime 10 colonne e solo le righe `Spesa` ed `Entrata`: i `Trasferimento` sono ignorati.

In coda quattro colonne nuove, che la dashboard non legge:

| Colonna | Contenuto | A cosa serve |
| --- | --- | --- |
| ID | codice unico del movimento | modificare o cancellare la riga giusta, evitare doppioni |
| INSERITO_IL | data e ora di inserimento | capire cosa è arrivato dall'app e quando |
| FONTE | `app` oppure `1Money` | distinguere lo storico dai nuovi inserimenti |
| MODIFICATO_IL | data e ora dell'ultima modifica | tracciare le correzioni |

Le righe storiche ricevono un ID una volta sola.

**Categorie** – una riga per sottocategoria, caricata all'inizio da `docs/categorie.md`: Tipo (Spesa/Entrata), Categoria, Sottocategoria (vuota = nessuna), Attiva (SÌ/NO), Ordine, Icona, Colore.

**Conti** – Nome, Tipo (Spesa / Investimento), Attivo, Ordine, Predefinito. Per ora un solo conto di spesa, **Liquidità**, predefinito: tutte le spese partono da lì. I conti di investimento (es. InvestiPiù) stanno nel foglio: li userà la voce Sposta (vedi Dopo l'app principale). I conti dei movimenti storici restano come sono.

**Tag** – Tag, Etichetta, Attivo: `#straordinaria`, `#scooter`, `#moto`, `#auto1`, `#auto2`, `#casa2`.

## Schermate

Tre schermate dalla barra in basso (Inserisci, Movimenti, Impostazioni) più il pannello Nuova spesa che sale da Inserisci e da Movimenti. Stile: v3 dei mockup, vetro traslucido scuro e piatto. Dettagli grafici in `docs/design_v3.md`.

- **Niente scorrimento inutile**: la pagina intera non scorre mai. Ogni schermata ha in alto una parte fissa che galleggia sul contenuto (vetro sfocato, come la barra in basso) e sotto un'area che scorre solo se il contenuto non ci sta.
- **Tasto Indietro** (Android): se è aperto un pannello dal basso lo chiude; altrimenti torna alla schermata precedente.
- **Area utile**: con l'app installata la pagina va da bordo a bordo; le misure si basano sullo spazio tra barra di stato e barra di navigazione, non sull'altezza dello schermo.

### 1. Inserisci
- In alto il titolo ("Spese" o "Entrate"), la capsula di sincronizzazione, il periodo con le frecce (vedi Periodo) e l'interruttore Spesa / Entrata.
- Capsula di sincronizzazione: Sincronizzato, N in attesa (ambra), Offline, Non collegato, Invio…; un tocco invia la coda e aggiorna dal foglio.
- Al centro un anello con gli importi del periodo per categoria, il totale e sotto il totale dell'altro tipo (Spesa: spese ed entrate; Entrata: il contrario). Le date future sono escluse.
- Attorno, in una griglia a 4 colonne, le categorie attive del tipo scelto con icona, nome e importo del periodo, nell'ordine della colonna Ordine del foglio Categorie: 4 nella prima riga, 1 a sinistra e 1 a destra dell'anello nelle due righe centrali, 4 nella quarta riga, le ultime 2 al centro della quinta. Le categorie di entrata occupano la griglia dall'alto. Oltre la 14ª: righe da 4 sotto, e solo allora la griglia scorre.
- Le righe della cornice si stringono per stare nello spazio utile; la scritta "Tocca una categoria…" sparisce solo se lo spazio è poco.
- Categorie non più attive: nessuna casella, ma i loro importi contano nel totale (segmento grigio nell'anello).
- Un tocco al centro dell'anello passa da Spesa a Entrata e viceversa, come l'interruttore.
- Un tocco su una categoria apre il pannello Nuova spesa. Data proposta: oggi se il periodo mostrato lo contiene, altrimenti il suo ultimo giorno.

### Periodo (Inserisci e Movimenti)
- Un solo periodo per tutta l'app, come in 1Money: cambiarlo in una schermata lo cambia anche nell'altra. In Inserisci è l'etichetta tra le frecce, in Movimenti il primo filtro; entrambi aprono lo stesso pannello Periodo.
- Pannello con 7 voci: Seleziona l'intervallo (due date, Dal e Al), Tutto il periodo, Seleziona un giorno (calendario del telefono), Settimana (lunedì–domenica), Oggi, Anno, Mese. Settimana, Anno e Mese partono da quelli in corso.
- Frecce: spostano di un mese, anno, settimana o giorno; spente per Intervallo e Tutto il periodo; la freccia avanti si ferma al periodo che contiene oggi.
- Alla riapertura resta l'ultimo periodo scelto; "Oggi" vale sempre per il giorno in cui si apre l'app.
- I periodi più vecchi del bootstrap (circa 3 mesi) si scaricano con `mese` o `periodo` e restano sul dispositivo, tranne Tutto il periodo. Se non si possono scaricare compare "Periodo non disponibile" con il pulsante Riprova.

### 2. Nuova spesa (pannello dal basso)
- Alto quanto il contenuto, sopra la schermata oscurata. Se non ci sta si compatta (spazi e tasti più piccoli); scorre solo come ultima risorsa. Le sue parti non si sovrappongono mai.
- Intestazione: categoria, data in una capsula (calendario del telefono, anche futura: capsula in accento), pulsante chiudi.
- Due selettori a scorrimento uno sopra l'altro: sottocategoria e conto. Scelta al centro (capsula grande), opzioni ai lati sfumate; si trascinano col dito (una voce ogni circa 80 px) o si toccano le voci laterali; lista circolare, con 2 sole voci si vede solo quella a destra. Categorie senza sottocategorie: solo il conto. Il selettore del conto compare solo con almeno due conti di spesa attivi: con il solo conto Liquidità non si vede.
- Sottocategoria sempre scelta: si propone la prima dell'elenco.
- Importo grande su una riga, nota sulla riga sotto. Nessun suggerimento automatico.
- Tag su due righe, selezionabili; si salvano in coda alla nota, nell'ordine del foglio Tag.
- Tastierino con virgola e operazioni ÷ × − +: al massimo 2 decimali, il risultato del calcolo compare sotto l'importo; un importo zero o negativo non si salva. Poi Salva spesa (o Salva entrata).
- In modifica e in duplica (da Movimenti) c'è anche il selettore Categoria sopra la sottocategoria; in modifica il pulsante è "Salva modifiche".

### 3. Movimenti
- In alto, fermi: titolo, ricerca nelle note del periodo, filtri periodo / categoria / conto (il filtro Conto elenca i conti di spesa più quelli presenti nel periodo).
- Avviso con i movimenti in attesa di invio (ed eventuale errore) e pulsante "Invia ora".
- In cima "In programma" (tutte le date future), bordo tratteggiato, quando il periodo arriva fino a oggi.
- Lista per giorno con totale del giorno. Titolo della riga: la nota senza tag (i tag come etichette), altrimenti sottocategoria o categoria; sotto "Categoria › Sottocategoria", con il conto solo se non è l'unico conto di spesa.
- Tocco = modifica nello stesso pannello. Scorrimento verso sinistra: Duplica (apre il pannello compilato con la data di oggi) ed Elimina (chiede un secondo tocco su "Conferma").
- Categorie, sottocategorie e conti non più attivi: riga in grigio; in modifica restano scelti finché non li cambi. Movimenti vecchi senza sottocategoria: "Nessuna".
- Righe senza ID (storiche, prima di `assegnaID()`): visibili ma non modificabili.
- Periodi lunghi: 300 righe alla volta, poi "Mostra altri movimenti".

### 4. Impostazioni
- Prima apertura: pannello dal basso "Collegamento" con indirizzo di Bilanci API, chiave e indirizzo della dashboard (facoltativo), una volta per dispositivo; pulsanti Prova e Salva.
- Sincronizzazione: ultima volta, in attesa, "Sincronizza ora".
- Dati dal foglio: categorie, conti, tag (automatico all'apertura o a mano).
- Conto preselezionato (il conto predefinito del foglio Conti, in sola lettura), link alla dashboard.
- Errori mostrati in ambra: la palette non ha un rosso.

## Categorie che cambiano nel tempo

Ogni movimento salva categoria e sottocategoria come testo. Cambiare lo schema non tocca mai lo storico.

| Cosa vuoi fare | Nel foglio Categorie | Effetto sull'app | Effetto sullo storico |
| --- | --- | --- | --- |
| Aggiungere | nuova riga, Attiva = SÌ | compare alla prossima apertura | nessuno |
| Ritirare | Attiva = NO | sparisce dalla scelta | i movimenti vecchi la tengono |
| Rinominare | ritiri la vecchia, aggiungi la nuova | si sceglie solo la nuova | i vecchi tengono il nome vecchio |
| Rinominare anche lo storico | come sopra + rimappatura nel foglio | – | solo se lo decidi |

## Offline e sincronizzazione

1. Salva: il movimento entra nella memoria del telefono (IndexedDB) con ID e stato "in attesa".
2. L'app lo invia appena c'è rete; se fallisce riprova all'apertura e a ogni salvataggio.
3. Bilanci API controlla la chiave, usa un lock, scrive; se l'ID esiste già non duplica.
4. L'app segna il movimento come sincronizzato.

Modifiche ed eliminazioni seguono la stessa coda, con una sola voce per ID: un movimento non ancora inviato e poi modificato resta un `add`; se lo si elimina prima dell'invio sparisce dalla coda e al foglio non arriva nulla. L'app ritenta anche al ritorno della rete e quando torna in primo piano. All'apertura l'app scarica categorie, conti, tag e movimenti recenti (ultimi 3 mesi e futuri); i periodi più vecchi si scaricano a richiesta (vedi Periodo). Limiti: 1–3 s per invio (in background); conflitti tra due dispositivi offline: vince l'ultimo; cancellare i dati del browser prima di sincronizzare perde la coda.

## Spese programmate

Decisione: diventano effettive da sole, senza conferma.
- Si scrivono subito nel foglio con la loro data, nessuna colonna in più.
- Fino a quel giorno: sezione In programma, escluse da anello e totali.
- Dal giorno indicato contano come le altre.
- Oggi la dashboard le conterebbe subito e sposterebbe anche la data dei confronti "a parità di periodo" (che usa l'ultima data presente): in `getDati()` va aggiunto il filtro che salta le righe con data successiva a oggi.

## Convivenza con dashboard e passaggio da 1Money

- La dashboard resta com'è e legge Dati 1Money.
- Passaggio: giorno di cambio, ultimo import 1Money da Drive quel giorno, poi solo l'app. Prova in parallelo per qualche giorno.
- **Prova in parallelo**: l'import di 1Money riconosce i doppioni da data, tipo, conto, importo e nota. Con conti diversi (Liquidità contro il conto della banca) la stessa spesa registrata in entrambe le app finirebbe due volte nel foglio. Deciso: durante la prova nummo scrive in un foglio a parte, "Dati nummo (prova)", scelto da una proprietà dello script (`SHEET_NAME`); al giorno di cambio si passa a "Dati 1Money".

## Fuori dalla v1

Saldi e gestione conti, grafici e confronti (dashboard), budget, promemoria, scontrini, valute diverse da EUR, più utenti. Idee v2: spese rapide da `RICORRENTI`, promemoria ricorrenti, widget.

## Decisioni prese

- **Conto**: un solo conto di spesa, Liquidità (nome definitivo), sempre preselezionato.
- **Investimenti**: si registreranno in nummo come trasferimenti, con la voce Sposta, dopo la fine dell'app principale (sostituisce "niente trasferimenti tra conti" del 24/11).
- **Nome**: nummo (app e repo).
- **Spese future**: diventano effettive da sole il giorno indicato.
- **Periodo**: come in 1Money, uno solo per Inserisci e Movimenti, con memoria dell'ultimo scelto.
- **Schermate**: la pagina non scorre mai; parte in alto fissa e galleggiante, area sotto che scorre solo se serve.

L'elenco completo e datato delle decisioni è in `STATO.md` del repo.

## Dopo l'app principale

- **Sposta**: terza voce dell'interruttore, Spesa / Entrata / Sposta, per spostare soldi tra Liquidità e i conti di investimento, nei due sensi. Scrive una riga come 1Money: TIPOLOGIA `Trasferimento`, DAL CONTO, AL CONTO, importo, data, nota; niente categoria. La dashboard ignora i `Trasferimento` e calcola il risparmio come entrate meno spese, quindi i suoi numeri non cambiano. Serve: pannello semplificato (da conto, a conto, importo, data, nota) con anteprima prima del codice; Bilanci API che scrive e legge anche `Trasferimento`; spostamenti visibili in Movimenti. Le spese in Banca e pratiche › Investimenti (commissioni) restano spese.

## Punti aperti

Nessuno al momento.
