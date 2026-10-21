import type { Asset, AssetType } from '@/types';
import { isMarketAsset } from '@/lib/asset-types';
import { dayKey, sortBalances } from '@/lib/portfolio';

export type MovementKind = 'buy' | 'sell' | 'balance' | 'opening';

/** Un evento nella storia del patrimonio: un'operazione su un titolo o un saldo registrato. */
export interface Movement {
  id: string;
  assetId: string;
  assetName: string;
  assetType: AssetType;
  currency: string;
  /** yyyy-MM-dd */
  date: string;
  kind: MovementKind;
  quantity?: number;
  price?: number;
  fees?: number;
  /** Controvalore dell'operazione (acquisti con commissioni, vendite al netto) o saldo registrato */
  amount: number;
  /** Differenza rispetto al saldo precedente (solo saldi) */
  change?: number;
}

/** Tutti i movimenti, dal più recente. */
export function buildMovements(assets: Asset[]): Movement[] {
  const list: Movement[] = [];
  for (const asset of assets) {
    const base = { assetId: asset.id, assetName: asset.name, assetType: asset.type, currency: asset.currency };
    if (isMarketAsset(asset.type)) {
      for (const tx of asset.transactions ?? []) {
        const fees = tx.fees ?? 0;
        const gross = tx.quantity * tx.price;
        list.push({
          ...base,
          id: `${asset.id}:${tx.id}`,
          date: dayKey(tx.date) ?? tx.date,
          kind: tx.type,
          quantity: tx.quantity,
          price: tx.price,
          fees: tx.fees,
          amount: tx.type === 'buy' ? gross + fees : gross - fees,
        });
      }
    } else {
      sortBalances(asset.balanceHistory).forEach((snapshot, i, history) => {
        list.push({
          ...base,
          id: `${asset.id}:${snapshot.date}`,
          date: dayKey(snapshot.date) ?? snapshot.date,
          kind: i === 0 ? 'opening' : 'balance',
          amount: snapshot.value,
          change: i === 0 ? undefined : snapshot.value - history[i - 1].value,
        });
      });
    }
  }
  return list.sort((a, b) => b.date.localeCompare(a.date) || a.assetName.localeCompare(b.assetName, 'it'));
}

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  buy: 'Acquisto',
  sell: 'Vendita',
  balance: 'Saldo',
  opening: 'Apertura',
};

const csvNumber = (n: number | undefined) => (n === undefined ? '' : String(Math.round(n * 1e6) / 1e6).replace('.', ','));
const csvText = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** CSV con separatore ";" e virgola decimale, come lo apre Excel in italiano. */
export function movementsToCsv(movements: Movement[]): string {
  const header = ['Data', 'Asset', 'Tipo', 'Movimento', 'Quantità', 'Prezzo', 'Commissioni', 'Importo', 'Variazione', 'Valuta'];
  const rows = movements.map(m => [
    m.date,
    csvText(m.assetName),
    m.assetType,
    MOVEMENT_LABEL[m.kind],
    csvNumber(m.quantity),
    csvNumber(m.price),
    csvNumber(m.fees),
    csvNumber(m.amount),
    csvNumber(m.change),
    m.currency,
  ].join(';'));
  return [header.join(';'), ...rows].join('\n');
}
