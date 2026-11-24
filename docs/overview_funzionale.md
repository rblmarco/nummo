# App spese – Overview funzionale

Aggiornata al 23/11/2026. Specifica funzionale dell'app **nummo**.

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
- Chiamate dalla web app: GET per leggere, POST con `Content-Type: text/plain` (evita il preflight CORS) per scrivere; ogni richiesta porta la chiave.
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

**Conti** – Nome, Tipo (Spesa / Investimento), Attivo, Ordine, Predefinito. Per ora un solo conto di spesa, **Liquidità** (nome provvisorio), predefinito: tutte le spese partono da lì. I conti di investimento (es. InvestiPiù) stanno nel foglio; se e come mostrarli nell'app è un punto aperto (vedi sotto). I conti dei movimenti storici restano come sono.

**Tag** – Tag, Etichetta, Attivo: `#straordinaria`, `#scooter`, `#moto`, `#auto1`, `#auto2`, `#casa2`.

## Schermate

Tre schermate dalla barra in basso (Inserisci, Movimenti, Impostazioni) più il pannello Nuova spesa che sale da Inserisci. Stile: v3 dei mockup, vetro traslucido scuro e piatto. Dettagli grafici in `docs/design_v3.md`.

### 1. Inserisci
- In alto il mese con frecce e l'interruttore Spesa / Entrata.
- Al centro un anello con le spese del mese per categoria, il totale speso e sotto le entrate.
- Attorno, in cornice 5 colonne × 4 righe, le categorie attive con icona, nome e speso del mese. Ordine dalla colonna Ordine del foglio Categorie.
- Un tocco su una categoria apre il pannello Nuova spesa.

### 2. Nuova spesa (pannello dal basso)
- Alto quanto il contenuto, sopra Inserisci oscurata.
- Intestazione: categoria, data in una capsula (anche futura), pulsante chiudi.
- Due selettori a scorrimento uno sopra l'altro: sottocategoria e conto. Scelta al centro (capsula grande), opzioni ai lati sfumate; si scorre col dito, lista circolare. Categorie senza sottocategorie: solo il conto. Il selettore del conto compare solo con almeno due conti di spesa attivi: con il solo conto Liquidità non si vede.
- Importo grande su una riga, nota sulla riga sotto. Nessun suggerimento automatico.
- Tag su due righe, selezionabili.
- Tastierino con virgola e operazioni ÷ × − +, poi Salva spesa.

### 3. Movimenti
- Ricerca nelle note, filtri mese / categoria / conto.
- Avviso con i movimenti in attesa di invio e pulsante per inviarli.
- In cima "In programma" (spese future), bordo tratteggiato.
- Lista per giorno con totale del giorno. Tocco = modifica (stesso pannello); scorrimento = duplica o elimina.
- Categoria non più attiva: visibile in grigio, non cambia finché non la cambi.

### 4. Impostazioni
- Prima apertura: indirizzo di Bilanci API e chiave, una volta per dispositivo.
- Sincronizzazione: ultima volta, in attesa, "Sincronizza ora".
- Dati dal foglio: categorie, conti, tag (automatico all'apertura o a mano).
- Conto preselezionato, link alla dashboard.

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

Modifiche ed eliminazioni seguono la stessa coda. All'apertura l'app scarica categorie, conti, tag e movimenti recenti (ultimi 3 mesi). Limiti: 1–3 s per invio (in background); conflitti tra due dispositivi offline: vince l'ultimo; cancellare i dati del browser prima di sincronizzare perde la coda.

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

Saldi e gestione conti, trasferimenti tra conti (deciso: no), grafici e confronti (dashboard), budget, promemoria, scontrini, valute diverse da EUR, più utenti. Idee v2: spese rapide da `RICORRENTI`, promemoria ricorrenti, widget.

## Decisioni prese

- **Trasferimenti tra conti**: no, non servono nell'app.
- **Conto**: un solo conto di spesa, Liquidità (nome provvisorio), sempre preselezionato.
- **Nome**: nummo (app e repo).
- **Spese future**: diventano effettive da sole il giorno indicato.

## Punti aperti

- **Investimenti**: oggi in 1Money un investimento si registra come trasferimento da un conto bancario al conto di investimento (es. InvestiPiù). Da decidere se l'app deve permetterlo, per esempio con un tipo "Investimento" che scrive un `Trasferimento` da Liquidità al conto scelto, oppure se gli investimenti restano fuori dall'app. Verificato: la dashboard ignora i `Trasferimento` e calcola il risparmio come entrate meno spese, quindi registrare un investimento come trasferimento non cambia i suoi numeri; servirebbe solo a tenerne traccia. Le spese in Banca e pratiche › Investimenti (commissioni) restano spese.
