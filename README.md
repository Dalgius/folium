# Folium

Dashboard personale per monitorare il patrimonio: conti correnti, conti deposito, investimenti quotati (azioni, ETF, fondi, crypto) e altri beni a valore manuale.

Costruita con Next.js 15, Firebase (Auth + Firestore), Tailwind, Recharts e Yahoo Finance per le quotazioni.

## Funzionalità

- **Patrimonio netto** con liquidità, investimenti, plus/minusvalenze latenti e realizzate, variazione giornaliera.
- **Andamento storico** del patrimonio o dei soli investimenti (1M → Max). In modalità *Investimenti* il grafico mostra anche il capitale versato e il rendimento del periodo è calcolato **al netto dei versamenti** (utile per i PAC).
- **Allocazione** per categoria.
- **Titoli quotati**: ricerca per nome, ticker o ISIN; storico di acquisti e vendite con commissioni; prezzo medio di carico (costo medio ponderato); quotazioni aggiornate automaticamente all'apertura e ogni 5 minuti, con conversione in EUR delle valute estere (anche sterline quotate in pence).
- **Conti correnti e altri beni**: storico dei saldi, così si vede come cambiano nel tempo.
- **Conti deposito**: tasso lordo, ritenuta (26% di default), apertura e scadenza del vincolo, stima degli interessi netti maturati e a scadenza, elenco delle prossime scadenze.
- **Importazione da Directa**: carica il CSV del portafoglio esportato da Directa; i titoli vengono abbinati ai simboli di Yahoo Finance (dal ticker o dall'ISIN), con un'anteprima in cui correggere gli abbinamenti dubbi. Poiché il file non contiene le date di acquisto, ogni posizione è registrata come un unico acquisto al prezzo medio di carico; reimportando un file più recente si possono aggiornare le posizioni già presenti.
- **Modalità privacy** per nascondere gli importi, **tema chiaro/scuro/sistema**, layout responsive.

## Avvio

```bash
npm install
npm run dev        # http://localhost:9002
```

Serve un file `.env` con la configurazione Firebase:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Altri comandi:

```bash
npm test           # test dei calcoli di portafoglio (vitest)
npm run typecheck
npm run build
```

Le regole di sicurezza di Firestore sono in `firestore.rules` (`firebase deploy --only firestore:rules`).

## Struttura

```
src/
  app/                    pagine (dashboard, login, signup)
  components/dashboard/   intestazione, indicatori, grafico, allocazione, posizioni, dettaglio
  components/forms/       dialog di inserimento e modifica
  hooks/use-portfolio.ts  caricamento dati, quotazioni live e operazioni
  lib/portfolio.ts        calcoli puri: posizioni, interessi, aggregati, storico (testati)
  services/               Firestore (asset.service) e Yahoo Finance (finance.service)
```

## Modello dati

Ogni documento della collezione `assets` appartiene a un utente (`userId`).

- I **titoli** hanno `ticker` e un array `transactions` (`buy`/`sell`, data, quantità, prezzo, commissioni). Quantità, prezzo medio e costo di carico sono ricalcolati dalle operazioni e salvati anche nei campi `quantity`, `purchasePrice`, `initialValue`, `currentValue`.
- **Conti** e **altri beni** hanno un array `balanceHistory` di saldi datati; i conti deposito anche `interestRate`, `taxRate`, `startDate`, `maturityDate`.

I documenti creati con le versioni precedenti dell'app (un solo acquisto per titolo, un solo saldo per conto) sono letti senza migrazioni: vengono convertiti al volo e salvati nel nuovo formato alla prima modifica.
