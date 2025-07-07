
"use client";

import { useState } from 'react';
import { Asset, AssetType } from '@/types';
import { PlusCircle, BarChart2, RefreshCw } from 'lucide-react';

import { AddAssetDialog } from '@/components/add-asset-dialog';
import { AssetCard } from '@/components/asset-card';
import { PortfolioSummary } from '@/components/portfolio-summary';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [assets, setAssets] = useState<Asset[]>([
    { id: '1', name: 'Apple Inc.', ticker: 'AAPL', type: 'Azione', initialValue: 15000, currentValue: 17500 },
    { id: '2', name: 'Vanguard S&P 500', ticker: 'VOO', type: 'ETF', initialValue: 25000, currentValue: 26100 },
    { id: '3', name: 'Conto Deposito', type: 'Conto Bancario', initialValue: 50000, currentValue: 50250 },
    { id: '4', name: 'Alphabet Inc.', ticker: 'GOOGL', type: 'Azione', initialValue: 10000, currentValue: 9500 },
  ]);

  const handleAddAsset = (name: string, type: AssetType, value: number, ticker?: string) => {
    const newAsset: Asset = {
      id: Date.now().toString(),
      name,
      type,
      initialValue: value,
      currentValue: value,
      ticker: type === 'Azione' || type === 'ETF' ? ticker : undefined,
    };
    setAssets(prevAssets => [...prevAssets, newAsset]);
  };

  const handleRefreshAsset = (id: string) => {
    setAssets(prevAssets =>
      prevAssets.map(asset => {
        if (asset.id === id && (asset.type === 'Azione' || asset.type === 'ETF')) {
          // Simula una variazione di prezzo (+/- 5%)
          const changePercent = (Math.random() - 0.5) * 0.1;
          const newCurrentValue = asset.currentValue * (1 + changePercent);
          return { ...asset, currentValue: newCurrentValue };
        }
        return asset;
      })
    );
  };

  const handleDeleteAsset = (id: string) => {
    setAssets(prevAssets => prevAssets.filter(asset => asset.id !== id));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h1 className="text-3xl font-bold text-primary font-headline tracking-tight">Portfolio Pulse</h1>
            <AddAssetDialog onAssetAdd={handleAddAsset}>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Asset
              </Button>
            </AddAssetDialog>
          </div>
          <PortfolioSummary assets={assets} />
        </header>

        {assets.length > 0 ? (
          <>
            <h2 className="mb-4 text-2xl font-bold text-foreground font-headline">I Miei Asset</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assets.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onRefresh={handleRefreshAsset}
                  onDelete={handleDeleteAsset}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20 px-6 border-2 border-dashed border-border rounded-lg">
            <BarChart2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">Il tuo portafoglio è vuoto</h2>
            <p className="mt-2 text-sm text-muted-foreground">Aggiungi il tuo primo asset per iniziare a tracciare i tuoi investimenti.</p>
            <div className="mt-6">
               <AddAssetDialog onAssetAdd={handleAddAsset}>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi il tuo primo Asset
                </Button>
              </AddAssetDialog>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
