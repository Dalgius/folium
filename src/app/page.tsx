'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useTab } from '@/hooks/use-tab';
import { isMarketAsset } from '@/lib/asset-types';
import { dayChangeLabel, isStale } from '@/lib/portfolio';
import { AppHeader } from '@/components/dashboard/app-header';
import { AppNav } from '@/components/dashboard/app-nav';
import { MovementsList } from '@/components/dashboard/movements-list';
import { SettingsPanel } from '@/components/dashboard/settings-panel';
import { StatCards } from '@/components/dashboard/stat-cards';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { AllocationCard } from '@/components/dashboard/allocation-card';
import { MaturitiesCard } from '@/components/dashboard/maturities-card';
import { TopHoldingsCard } from '@/components/dashboard/top-holdings-card';
import { NetWorthChangeCard } from '@/components/dashboard/net-worth-change-card';
import { HoldingsList, type HoldingAction } from '@/components/dashboard/holdings-list';
import { AssetDetailSheet } from '@/components/dashboard/asset-detail-sheet';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AddAssetDialog, type AddKind } from '@/components/forms/add-asset-dialog';
import { TransactionDialog } from '@/components/forms/transaction-dialog';
import { BalanceDialog } from '@/components/forms/balance-dialog';
import { EditAssetDialog } from '@/components/forms/edit-asset-dialog';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';
import { cn } from '@/lib/utils';
import { BalancesDialog } from '@/components/forms/balances-dialog';
import { CashMovementDialog } from '@/components/forms/cash-movement-dialog';
import { RestartLedgerDialog } from '@/components/forms/restart-ledger-dialog';
import { TransactionDatesDialog } from '@/components/forms/transaction-dates-dialog';

const TITLES = {
  panoramica: 'Il tuo patrimonio',
  posizioni: 'Posizioni',
  movimenti: 'Movimenti',
  impostazioni: 'Impostazioni',
} as const;

type DialogState =
  | { kind: 'add'; initial?: AddKind }
  | { kind: 'transaction'; assetId: string; txId?: string }
  | { kind: 'balance' | 'restart' | 'edit' | 'delete'; assetId: string }
  | { kind: 'cash'; assetId: string; movementId?: string }
  | { kind: 'balances' | 'dates' }
  | null;

export default function Dashboard() {
  const portfolio = usePortfolio();
  const { assets, holdings, summary, fx, loading } = portfolio;
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useTab();

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
        onSettings={() => setTab('impostazioni')}
      />
      <AppNav tab={tab} onChange={setTab} />

      <main className="container mx-auto px-4 pb-24 pt-6 sm:px-6 sm:pb-8 lg:px-8 lg:pt-8">
        {/* Nelle altre schede il titolo è già nella card: resta solo per i lettori di schermo */}
        <h1 className={cn('mb-6 text-sm text-muted-foreground', tab !== 'panoramica' && 'sr-only')}>
          <span className="font-medium text-foreground">{TITLES[tab]}</span> · {format(new Date(), 'EEEE d MMMM', { locale: it })}
        </h1>

        <div className="space-y-6">
          {tab === 'impostazioni' ? (
            <SettingsPanel assets={assets} />
          ) : !loading && assets.length === 0 ? (
            <EmptyState onAdd={initial => setDialog({ kind: 'add', initial })} />
          ) : tab === 'posizioni' ? (
            <HoldingsList
              holdings={holdings}
              loading={loading}
              onAction={handleAction}
              onBulkAction={kind => setDialog({ kind })}
              dayLabel={dayLabel}
            />
          ) : tab === 'movimenti' ? (
            <MovementsList assets={assets} loading={loading} onSelect={setSelectedId} />
          ) : (
            <>
              <StatCards summary={summary} loading={loading} dayLabel={dayLabel} />
              {!loading && <NetWorthChangeCard assets={assets} fx={fx} />}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  {loading ? (
                    <div className="h-[420px] animate-pulse rounded-xl border bg-card" />
                  ) : (
                    <PerformanceChart assets={assets} fx={fx} hasInvestments={hasInvestments} />
                  )}
                </div>
                <AllocationCard holdings={holdings} loading={loading} />
                {!loading && (
                  <div className="lg:col-span-2">
                    <TopHoldingsCard holdings={holdings} onSelect={setSelectedId} onShowAll={() => setTab('posizioni')} dayLabel={dayLabel} />
                  </div>
                )}
                <MaturitiesCard holdings={holdings} onSelect={setSelectedId} />
              </div>
            </>
          )}
        </div>
      </main>

      <AddAssetDialog
        open={dialog?.kind === 'add'}
        onOpenChange={closeDialog}
        initialKind={dialog?.kind === 'add' ? dialog.initial : null}
        assets={assets}
        onCreate={portfolio.create}
        onImport={items => portfolio.importPositions(items, { onFixDates: () => setDialog({ kind: 'dates' }) })}
      />
      <TransactionDialog
        asset={dialogAsset}
        transaction={dialog?.kind === 'transaction' && dialog.txId ? dialogAsset?.transactions?.find(t => t.id === dialog.txId) ?? null : null}
        open={dialog?.kind === 'transaction'}
        onOpenChange={closeDialog}
        onSubmit={(assetId, tx, txId) => (txId ? portfolio.updateTransaction(assetId, txId, tx) : portfolio.addTransaction(assetId, tx))}
      />
      <BalanceDialog asset={dialogAsset} open={dialog?.kind === 'balance'} onOpenChange={closeDialog} onSubmit={portfolio.setBalance} />
      <CashMovementDialog
        asset={dialogAsset}
        movement={dialog?.kind === 'cash' && dialog.movementId ? dialogAsset?.cashMovements?.find(m => m.id === dialog.movementId) ?? null : null}
        open={dialog?.kind === 'cash'}
        onOpenChange={closeDialog}
        onSubmit={(assetId, movement, movementId) =>
          movementId ? portfolio.updateCashMovement(assetId, movementId, movement) : portfolio.addCashMovement(assetId, movement)}
      />
      <RestartLedgerDialog asset={dialogAsset} open={dialog?.kind === 'restart'} onOpenChange={closeDialog} onSubmit={portfolio.restartLedger} />
      <BalancesDialog assets={assets} open={dialog?.kind === 'balances'} onOpenChange={closeDialog} onSubmit={portfolio.setBalances} />
      <TransactionDatesDialog assets={assets} open={dialog?.kind === 'dates'} onOpenChange={closeDialog} onSubmit={portfolio.updateTransactionDates} />
      <EditAssetDialog asset={dialogAsset} open={dialog?.kind === 'edit'} onOpenChange={closeDialog} onSubmit={portfolio.updateDetails} />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={closeDialog}
        title={`Eliminare ${dialogAsset?.name ?? "l'asset"}?`}
        description="Verranno eliminati anche lo storico delle operazioni e dei saldi. Potrai annullare per qualche secondo dal messaggio di conferma."
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
        onEditCashMovement={(assetId, movementId) => setDialog({ kind: 'cash', assetId, movementId })}
        onDeleteCashMovement={portfolio.deleteCashMovement}
        dayLabel={dayLabel}
      />
    </div>
  );
}
