# App spese – Design v3 (vetro scuro e piatto)

Design approvato (versione v3 "vetro"). Riferimento visivo in `docs/design/`: le schermate `LG*.dc.html` (HTML con stili inline, da riprodurre, non da copiare) e i PNG in `docs/design/png/`. I dati mostrati sono di esempio.

## Base

- Viewport di riferimento: Galaxy A54, 412×892 CSS px. Layout fluido, nessuna larghezza fissa nell'app vera.
- Tema solo scuro.
- Font: Inter (300, 400, 500, 600, 700). Icone: Material Symbols Rounded, piene (FILL 1) per categorie e voce attiva, peso 500.
- Raggi: capsule piene (altezza/2) per chip e pulsanti, 22–24 px per card, 34–36 px per il pannello dal basso.

## Colori

| Token | Valore | Uso |
| --- | --- | --- |
| Sfondo | `#0D0F13` + tre aloni radiali tenui: verde `rgba(62,140,128,.30)` in alto a sinistra, viola `rgba(100,96,170,.26)` a destra, ambra `rgba(170,130,70,.16)` in basso | fondo di tutte le schermate |
| Testo 1 | `#FFFFFF` | testo principale |
| Testo 2 | `rgba(235,235,245,.66)` | etichette, testo secondario |
| Testo 3 | `rgba(235,235,245,.45)` | suggerimenti, importi a zero |
| Accento | `#7DD3C0` | voce attiva, selezioni, Salva (testo `#0B2A24`), entrate |
| In attesa | `#E8C36A` | movimenti non ancora inviati |

Vetro (niente ombre esterne, niente bagliori):
- **Pannello**: `background rgba(255,255,255,.07)`, `backdrop-filter blur(20px) saturate(130%)`, bordo `1px rgba(255,255,255,.09)`, `inset 0 1px 0 rgba(255,255,255,.10)`.
- **Leggero** (chip, pulsanti secondari): `rgba(255,255,255,.06)`, blur 16 px, bordo `rgba(255,255,255,.07)`.
- **Tinto** (selezione o categoria): colore al ~15% di opacità, bordo stesso colore al 14%.
- **Pannello dal basso**: `rgba(24,27,33,.82)`, blur 28 px, scrim `rgba(0,0,0,.45)` sopra la schermata sotto.

Colori categoria (icona e importo; sfondo icona = stesso colore al ~13–22%):

| Categoria | Icona Material Symbols | Colore |
| --- | --- | --- |
| Abbigliamento | checkroom | `#FFB68E` |
| Abbonamenti | autorenew | `#CDBDFF` |
| Auto e moto | directions_car | `#FFB95C` |
| Banca e pratiche | account_balance | `#A6C8FF` |
| Casa | home | `#EDB1FF` |
| Cibo | restaurant | `#7FD3F2` |
| Immobili | apartment | `#D8C8A8` |
| Mobilità | train | `#6FD8CB` |
| Regali | redeem | `#FFB1C3` |
| Salute | favorite | `#8CD9A0` |
| Sport | fitness_center | `#E3C74E` |
| Tecnologia | devices | `#BCC7DD` |
| Tempo libero | local_activity | `#FFADE4` |
| Vacanze | flight | `#B8C4FF` |

Icona e colore diventano colonne del foglio Categorie, con questi valori di partenza.

## Componenti

- **Barra in basso**: capsula di vetro fluttuante (margini 20 px, 24 px dal fondo, altezza 64), tre voci; attiva = bolla `rgba(255,255,255,.12)`, icona piena e testo color accento.
- **Titoli**: 34/41 px, peso 700.
- **Segmentato Spesa/Entrata**: capsula leggera alta 44, segmento attivo `rgba(255,255,255,.16)`.
- **Selettore a scorrimento**: griglia `1fr auto 1fr`, alta 64. Centro = capsula tinta alta 60 con icona tonda 40, etichetta 11 px ("Sottocategoria"/"Conto") e valore 16/600. Ai lati: prima opzione alta 40 al 75%, seconda alta 34 al 50%; maschera sfumata ai bordi. Lista circolare. Nell'app vera: scroll orizzontale con snap al centro.
- **Chip tag**: capsule alte 36, selezionato = tinta accento + spunta. Su più righe.
- **Tastierino**: griglia 4×4, tasti a capsula alti 50, gap 8; operatori ÷ × − + in color accento su tinta accento leggera; cancella con icona `backspace`.
- **Salva spesa**: capsula piena accento, alta 54, icona `check`.
- **Liste**: gruppi in card di vetro (raggio 24), righe alte ~68, icona categoria in quadrato arrotondato 40 (raggio 14), titolo 15/600, sottotitolo "Categoria › Sottocategoria" 13 px testo 2, importo 15/600 a destra con stato (`cloud_done` grigio o `schedule` "in attesa").
- **In programma**: card con bordo tratteggiato `rgba(255,255,255,.18)`, testo smorzato, data futura in accento con icona `event`.

## Schermate

1. **Inserisci**: titolo "Spese" + capsula "Sincronizzato"; riga mese con frecce; segmentato; griglia 5 colonne × 4 righe (righe alte ~120) con anello al centro (colonne 2–4, righe 2–3). Sopra: Cibo, Tempo libero, Auto e moto, Mobilità, Casa. Sinistra: Salute, Abbigliamento. Destra: Immobili, Abbonamenti. Sotto: Vacanze, Regali, Sport, Tecnologia, Banca e pratiche (l'ordine reale viene dal foglio). Cella: icona tonda 48, nome 11.5 px su max 2 righe, importo 12/600 nel colore categoria (grigio se 0), contenuto centrato in verticale. Anello: diametro ~224, spessore 13, segmenti per categoria ordinati per importo con piccolo stacco, traccia `rgba(255,255,255,.06)`; al centro "Spese", totale 26/600, "Entrate …".
2. **Nuova spesa**: pannello dal basso con maniglia; intestazione (icona categoria, nome, capsula data con `calendar_today`, chiudi); selettore sottocategoria; selettore conto; importo 52 px peso 300 centrato con "€"; campo nota a capsula con icona `edit_note`; tag; tastierino; Salva. Gap 14 px tra sezioni.
3. **Movimenti**: titolo; barra di ricerca a capsula; chip filtro (mese selezionato); avviso in attesa tinto ambra con pulsante "Invia ora"; In programma; gruppi per giorno con data e totale; nota finale "Tocca per modificare · scorri per duplicare o eliminare".
4. **Impostazioni**: elenco a gruppi stile impostazioni (Collegamento, Sincronizzazione, Dati dal foglio, Preferenze), icone bianche in quadrati colorati 30×30, valori a destra, "Sincronizza ora" come capsula tinta accento, link "Apri la dashboard".
