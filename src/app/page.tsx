'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePortfolio } from '@/hooks/use-portfolio';
import { isMarketAsset } from '@/lib/asset-types';
import { dayChangeLabel, isStale } from '@/lib/portfolio';
import { AppHeader } from '@/components/dashboard/app-header';
import { StatCards } from '@/components/dashboard/stat-cards';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { AllocationCard } from '@/components/dashboard/allocation-card';
import { MaturitiesCard } from '@/components/dashboard/maturities-card';
import { HoldingsList, type HoldingAction } from '@/components/dashboard/holdings-list';
import { AssetDetailSheet } from '@/components/dashboard/asset-detail-sheet';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AddAssetDialog, type AddKind } from '@/components/forms/add-asset-dialog';
import { TransactionDialog } from '@/components/forms/transaction-dialog';
import { BalanceDialog } from '@/components/forms/balance-dialog';
import { EditAssetDialog } from '@/components/forms/edit-asset-dialog';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

type DialogState =
  | { kind: 'add'; initial?: AddKind }
  | { kind: 'transaction'; assetId: string; txId?: string }
  | { kind: 'balance' | 'edit' | 'delete'; assetId: string }
  | null;

export default function Dashboard() {
  const portfolio = usePortfolio();
  const { assets, holdings, summary, fx, loading } = portfolio;
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dialogAsset = dialog && 'assetId' in dialog ? assets.find(a => a.id === dialog.assetId) ?? null : null;
  const selected = holdings.find(h => h.asset.id === selectedId) ?? null;
  const closeDialog = (open: boolean) => !open && setDialog(null);
  const hasInvestments = holdings.some(h => h.group === 'investments');
  const marketAssets = useMemo(() => assets.filter(a => isMarketAsset(a.type)), [assets]);
  const dayLabel = useMemo(() => dayChangeLabel(marketAssets.map(a => a.marketTime)), [marketAssets]);
  const staleCount = useMemo(() => marketAssets.filter(a => isStale(a)).length, [marketAssets]);

  const handleAction = (action: HoldingAction, assetId: string) => {
    if (action === 'details') setSelectedId(assetId);
    else setDialog({ kind: action, assetId });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        refreshing={portfolio.refreshing}
        lastRefresh={portfolio.lastRefresh}
        onRefresh={portfolio.refresh}
        onAdd={() => setDialog({ kind: 'add' })}
        canRefresh={assets.length > 0}
        staleCount={loading ? 0 : staleCount}
      />

      <main className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <h1 className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Il tuo patrimonio</span> · {format(new Date(), 'EEEE d MMMM', { locale: it })}
        </h1>

        {!loading && assets.length === 0 ? (
          <EmptyState onAdd={initial => setDialog({ kind: 'add', initial })} />
        ) : (
          <>
            <StatCards summary={summary} loading={loading} dayLabel={dayLabel} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                {loading ? (
                  <div className="h-[420px] animate-pulse rounded-xl border bg-card" />
                ) : (
                  <PerformanceChart assets={assets} fx={fx} hasInvestments={hasInvestments} />
                )}
              </div>
              <div className="space-y-6">
                <AllocationCard summary={summary} loading={loading} />
                <MaturitiesCard holdings={holdings} onSelect={setSelectedId} />
              </div>
            </div>

            <HoldingsList holdings={holdings} loading={loading} onAction={handleAction} dayLabel={dayLabel} />
          </>
        )}
      </main>

      <AddAssetDialog
        open={dialog?.kind === 'add'}
        onOpenChange={closeDialog}
        initialKind={dialog?.kind === 'add' ? dialog.initial : null}
        assets={assets}
        onCreate={portfolio.create}
        onImport={portfolio.importPositions}
      />
      <TransactionDialog
        asset={dialogAsset}
        transaction={dialog?.kind === 'transaction' && dialog.txId ? dialogAsset?.transactions?.find(t => t.id === dialog.txId) ?? null : null}
        open={dialog?.kind === 'transaction'}
        onOpenChange={closeDialog}
        onSubmit={(assetId, tx, txId) => (txId ? portfolio.updateTransaction(assetId, txId, tx) : portfolio.addTransaction(assetId, tx))}
      />
      <BalanceDialog asset={dialogAsset} open={dialog?.kind === 'balance'} onOpenChange={closeDialog} onSubmit={portfolio.setBalance} />
      <EditAssetDialog asset={dialogAsset} open={dialog?.kind === 'edit'} onOpenChange={closeDialog} onSubmit={portfolio.updateDetails} />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={closeDialog}
        title={`Eliminare ${dialogAsset?.name ?? "l'asset"}?`}
        description="Verranno eliminati anche lo storico delle operazioni e dei saldi. L'azione non può essere annullata."
        onConfirm={async () => {
          if (!dialogAsset) return;
          const id = dialogAsset.id;
          setDialog(null);
          if (await portfolio.remove(id)) setSelectedId(current => (current === id ? null : current));
        }}
      />

      <AssetDetailSheet
        holding={selected}
        open={!!selected}
        onOpenChange={open => !open && setSelectedId(null)}
        onAction={handleAction}
        onEditTransaction={(assetId, txId) => setDialog({ kind: 'transaction', assetId, txId })}
        onDeleteTransaction={portfolio.deleteTransaction}
        onDeleteBalance={portfolio.deleteBalance}
        dayLabel={dayLabel}
      />
    </div>
  );
}
