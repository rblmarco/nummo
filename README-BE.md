# Bilanci API – pubblicazione

Backend della web app nummo (`backend/Code.gs`): un progetto Apps Script **separato** dalla dashboard, che legge e scrive nel Google Sheet.

## Prima installazione

1. Vai su [script.google.com](https://script.google.com) → **Nuovo progetto** e chiamalo `Bilanci API`.
2. Sostituisci il contenuto di `Codice.gs` con quello di `backend/Code.gs`, poi salva.
3. Dal menu delle funzioni in alto scegli **`generaChiave`** e premi **Esegui**. Autorizza lo script, poi apri il **Registro di esecuzione** e copia la chiave.
4. **Impostazioni progetto** (ingranaggio) → **Proprietà script** → aggiungi:
   - `SHEET_ID`: l'ID del Google Sheet, cioè la parte dell'indirizzo tra `/d/` e `/edit`;
   - `SHEET_NAME`: `Dati nummo (prova)`;
   - `API_KEY`: la chiave del punto 3.
5. Esegui **`setupFogli`**. Nel foglio compaiono quattro schede nuove: Categorie, Conti, Tag e Dati nummo (prova). Le schede che esistono già non vengono toccate.
6. Nel foglio, completa a mano:
   - **Tag**: i tuoi tag, uno per riga, con Attivo = `SÌ`;
   - **Conti**: rinomina `Liquidità` se vuoi e aggiungi i conti di investimento con Tipo = `Investimento`.
7. **Esegui il deployment** → **Nuovo deployment** → tipo **App web**:
   - Esegui come: **me**;
   - Chi ha accesso: **Chiunque**.
   Copia l'URL che termina con `/exec`: è l'indirizzo da inserire nell'app insieme alla chiave.

## Prova rapida

Apri nel browser `<URL>/exec?action=ping&key=<CHIAVE>`. Deve rispondere con `{"ok":true,"ping":"ok","foglio":"Dati nummo (prova)"}`.

## Dopo ogni modifica al codice

**Gestisci deployment** → matita → **Versione: Nuova versione** → **Esegui il deployment**. L'URL non cambia.

## Giorno del cambio (fine della prova)

1. Ultimo import da 1Money nella dashboard.
2. Esegui `assegnaID('Dati 1Money')` per dare un ID allo storico.
3. Cambia `SHEET_NAME` in `Dati 1Money`.
4. Nella dashboard attiva il filtro sulle date future (vedi `STATO.md`).

## Chiamate

| Metodo | Parametri | Risposta |
| --- | --- | --- |
| GET | `action=ping&key=…` | stato e foglio in uso |
| GET | `action=bootstrap&key=…` | categorie attive, conti, tag, movimenti degli ultimi 92 giorni e futuri |
| GET | `action=mese&ym=AAAA-MM&key=…` | movimenti di un mese |
| POST | corpo `text/plain` con JSON `{key, ops:[{op:'add'|'update'|'delete', id, mov}]}` | esito di ogni operazione |

`mov` = `{data:'AAAA-MM-GG', tipo:'Spesa'|'Entrata', conto, categoria, sottocategoria, importo, nota}`. Le chiavi non vanno mai scritte nel codice dell'app: si inseriscono nelle Impostazioni al primo avvio.
