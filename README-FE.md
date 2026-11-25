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

Basta il push su `main`: il workflow ripubblica l'app in un paio di minuti. Parte solo se cambiano file in `frontend/` o il workflow stesso; per ripubblicare a mano: **Actions** → **Pubblica su GitHub Pages** → **Run workflow**.

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
| `app.js` | interfaccia, stato, copia locale dei dati e coda offline in IndexedDB |
| `api.js` | chiamate a Bilanci API: lettura (`ping`, `bootstrap`, `mese`) e scrittura (`invia`, POST con le operazioni `add` / `update` / `delete`) |
| `manifest.webmanifest` | nome, colori e icone usati da "Aggiungi a schermata Home" |
| `icons/` | icone PNG (192, 512, 180 per iOS, 32 per il browser) e sorgente `icona.svg` |

In arrivo: `sw.js` (uso offline).
