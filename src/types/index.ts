/**
 * Tipi di asset salvati su Firestore.
 * NB: i valori sono persistiti nel database, quindi non vanno rinominati
 * ("Conto Bancario" viene mostrato come "Conto corrente").
 */
export type AssetType =
  | 'Azione'
  | 'ETF'
  | 'Fondo'
  | 'Crypto'
  | 'Conto Bancario'
  | 'Conto Deposito'
  | 'Altro';

export type Currency = string;

/** Classe di attivo, usata per l'allocazione per rischio */
export type AssetClass = 'azionario' | 'obbligazionario' | 'liquidita' | 'materie-prime' | 'immobiliare' | 'altro' | 'crypto';

export type TransactionType = 'buy' | 'sell';

/** Un'operazione di acquisto o vendita su un titolo. */
export interface Transaction {
  id: string;
  type: TransactionType;
  /** Data ISO (yyyy-MM-dd'T'...) */
  date: string;
  quantity: number;
  /** Prezzo unitario nella valuta dell'asset */
  price: number;
  /** Commissioni nella valuta dell'asset */
  fees?: number;
}

/** Un saldo registrato in una certa data (conti e beni a valore manuale). */
export interface BalanceSnapshot {
  date: string;
  value: number;
  /** Momento della registrazione (ISO): distingue i movimenti dello stesso giorno inseriti prima o dopo */
  at?: string;
}

/** Entrata o uscita su un conto corrente, inserita a mano. */
export interface CashMovement {
  id: string;
  /** yyyy-MM-dd */
  date: string;
  /** Importo con segno: positivo per le entrate, negativo per le uscite */
  amount: number;
  description?: string;
  /** Momento dell'inserimento (ISO) */
  createdAt: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  currency: Currency;
  userId?: string;

  /** Banca, broker o intermediario */
  institution?: string;
  notes?: string;

  /** Classe di attivo scelta a mano; se manca viene proposta in automatico */
  assetClass?: AssetClass;

  // --- Titoli quotati -------------------------------------------------------
  ticker?: string;
  transactions?: Transaction[];
  /** Ultimo prezzo noto (valuta dell'asset) */
  lastPrice?: number;
  /** Variazione giornaliera per unità (valuta dell'asset) */
  dailyChange?: number;
  /** Variazione giornaliera in forma decimale (0.025 = +2,5%) */
  dailyChangePercent?: number;
  /** Data ISO dell'ultimo aggiornamento del prezzo */
  lastUpdated?: string;
  /** Data ISO dell'ultima quotazione di mercato (ultima seduta) */
  marketTime?: string;

  // --- Conti e beni a valore manuale -----------------------------------------
  balanceHistory?: BalanceSnapshot[];
  /** Entrate e uscite dei conti correnti, sommate al saldo dopo l'ultimo saldo registrato */
  cashMovements?: CashMovement[];

  // --- Conto deposito --------------------------------------------------------
  /** Tasso lordo annuo in percentuale (es. 3.5 = 3,5%) */
  interestRate?: number;
  /** Ritenuta sugli interessi in percentuale (default 26) */
  taxRate?: number;
  startDate?: string;
  maturityDate?: string;

  // --- Campi denormalizzati (mantenuti per compatibilità con i dati esistenti)
  quantity?: number;
  /** Prezzo medio di carico */
  purchasePrice?: number;
  /** Data del primo acquisto / apertura */
  purchaseDate?: string;
  /** Costo di carico (titoli) o saldo iniziale (conti) */
  initialValue: number;
  /** Valore corrente nella valuta dell'asset */
  currentValue: number;
}

export type NewAsset = Omit<Asset, 'id' | 'userId'>;
