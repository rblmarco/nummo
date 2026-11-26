# nummo – web app, pubblicazione

Frontend di nummo: HTML, CSS e JavaScript puri, senza framework né build. È pubblicato su **GitHub Pages** dal workflow `.github/workflows/pages.yml`, che copia la cartella `frontend/` così com'è.

Prima di iniziare deve essere già pronto Bilanci API (vedi `README-BE.md`): servono l'URL che termina con `/exec` e la chiave `API_KEY`.

## Prima pubblicazione

1. Sul repository GitHub vai in **Settings** → **Pages**.
2. In **Build and deployment** → **Source** scegli **GitHub Actions**, non "Deploy from a branch".
3. Fai il push su `main`. Nella scheda **Actions** parte il workflow **Pubblica su GitHub Pages**: quando diventa verde, la stessa pagina Settings → Pages mostra l'indirizzo dell'app, del tipo `https://<utente>.github.io/nummo/`.
4. Se il workflow non era partito, perché il push è avvenuto prima del punto 2: **Actions** → **Pubblica su GitHub Pages** → **Run workflow**.

## Primo avvio su ogni dispositivo

1. Apri l'indirizzo dell'app: al primo avvio si apre da solo il pannello **Collegamento**.
2. Compila:
   - **Indirizzo di Bilanci API**: l'URL del deployment che termina con `/exec`;
   - **Chiave segreta**: il valore di `API_KEY`;
   - **Indirizzo della dashboard** (facoltativo): serve al link "Apri la dashboard".
3. Premi **Prova**: deve comparire "Collegato" con il nome del foglio in uso (durante la prova `Dati nummo (prova)`).
4. Premi **Salva**: l'app scarica categorie, conti, tag e movimenti recenti.
5. In **Impostazioni** controlla che "Bilanci API" sia **Collegato** e che i numeri di Categorie e di Conti e tag corrispondano al foglio.

Indirizzo e chiave restano solo nel `localStorage` del browser, mai nel codice. Su ogni nuovo dispositivo o browser vanno inseriti di nuovo, e anche dopo aver cancellato i dati del sito.

## Prova in locale (PC)

Dalla cartella `frontend/`:

```
python -m http.server 8000
```

Poi apri `http://localhost:8000`. Il doppio clic su `index.html` non basta: la pagina deve essere servita da un server. Indirizzo e chiave inseriti in locale valgono solo per `localhost`.

## Dopo ogni modifica al codice

Basta il push su `main`: il workflow ripubblica l'app in un paio di minuti. Sul telefono basta chiudere e riaprire l'app: il service worker carica i file nuovi (in Impostazioni, "Versione app" mostra quale versione è in uso). Se GitHub Pages ha ancora in cache la versione precedente può servire qualche minuto.

A ogni consegna si aggiorna `VERSIONE_APP` in `frontend/app.js`. `VERSIONE` in `frontend/sw.js` si cambia solo se cambia l'elenco dei file salvati o il funzionamento del service worker. Parte solo se cambiano file in `frontend/` o il workflow stesso; per ripubblicare a mano: **Actions** → **Pubblica su GitHub Pages** → **Run workflow**.

## Il workflow `pages.yml`

| Voce | Valore |
| --- | --- |
| Quando parte | push su `main` che tocca `frontend/**` o il workflow; a mano con **Run workflow** |
| Cosa pubblica | la cartella `frontend/`, senza trasformarla |
| Passi | job **prepara**: `checkout` → `configure-pages` → `upload-pages-artifact` (path `frontend`); job **pubblica** (parte dopo prepara): `deploy-pages` |
| Permessi | `contents: read`, `pages: write`, `id-token: write` |
| Ambiente | `github-pages`: l'indirizzo pubblicato compare nel riepilogo dell'esecuzione |
| Concorrenza | gruppo `pages`: una pubblicazione nuova aspetta che finisca quella in corso |

Il repository è pubblico e tutto ciò che sta in `frontend/` è pubblicato: niente dati personali, URL di Bilanci API o chiavi.

## File in `frontend/`

| File | Contenuto |
| --- | --- |
| `index.html` | struttura della pagina: tre schermate, barra in basso, pannello dal basso |
| `app.css` | stile v3 "vetro" (`docs/design_v3.md`) |
| `app.js` | interfaccia, stato, copia locale dei dati e coda offline in IndexedDB; in cima `VERSIONE_APP`, mostrata in Impostazioni |
| `api.js` | chiamate a Bilanci API: lettura (`ping`, `bootstrap`, `mese`, `periodo`) e scrittura (`invia`, POST con le operazioni `add` / `update` / `delete`) |
| `sw.js` | service worker: copia dei file dell'app e dei font per aprirla senza rete; per i file dell'app chiede sempre prima la rete, quindi dopo un push basta riaprire l'app |
| `manifest.webmanifest` | nome, colori e icone usati da "Aggiungi a schermata Home" |
| `icons/` | icone PNG (192, 512, 180 per iOS, 32 per il browser) e sorgente `icona.svg`; in più le icone `bilanci-*.png` della dashboard Bilanci (vedi sotto) |

## Icona della dashboard Bilanci

Le immagini `frontend/icons/bilanci-*.png` non servono a nummo: sono l'icona della **dashboard Bilanci**, la web app Apps Script separata che legge il foglio. Stanno qui solo perché GitHub Pages le pubblica a un indirizzo pubblico, e Apps Script non può contenere immagini: accetta soltanto l'indirizzo di un'immagine.

Come funziona:

1. Il push su `main` pubblica `frontend/` su GitHub Pages, quindi l'icona diventa raggiungibile a `https://<utente>.github.io/nummo/icons/bilanci-192.png`.
2. Nel `Code.gs` della dashboard, la voce `ICONA` di `CONFIG` contiene quell'indirizzo.
3. Il `doGet` della dashboard la passa a Google con `.setFaviconUrl(CONFIG.ICONA)`. A ogni apertura della web app Google scarica l'immagine da quell'indirizzo e la usa come icona della pagina.

Da sapere:

- Prima fai il push, poi aggiorna la dashboard: apri l'indirizzo dell'icona nel browser per controllare che sia pubblicata, poi incolla il `Code.gs` e fai Gestisci deployment → matita → Nuova versione.
- L'icona compare nella scheda del browser della web app. Nella finestra aperta dal menu del foglio Google non mostra icone. Sulla schermata Home del telefono decide Chrome: se la dashboard c'era già, va tolta e aggiunta di nuovo, e Chrome può comunque usare un'icona generica.
- **Non rinominare né spostare** i file `bilanci-*.png`: la dashboard li cerca a quell'indirizzo. Se cambi il disegno, sostituisci i file con lo stesso nome.
- Disegno: stesso fondo e stesso anello di `icona.svg`, con tre barre al centro (azzurro, lilla, arancio) al posto della "n".

