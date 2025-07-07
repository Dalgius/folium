
"use client";

import { useState } from 'react';
import { Asset, AssetType } from '@/types';
import { PlusCircle, BarChart2, RefreshCw } from 'lucide-react';

import { AddAssetDialog } from '@/components/add-asset-dialog';
import { AssetCard } from '@/components/asset-card';
import { PortfolioSummary } from '@/components/portfolio-summary';
import { Button } from '@/components/ui/button';
import type * as z from 'zod';
import type { addAssetFormSchema } from '@/components/add-asset-dialog';

export default function Home() {
  const [assets, setAssets] = useState<Asset[]>([
    { id: '1', name: 'Apple Inc.', ticker: 'AAPL', type: 'Azione', initialValue: 15000, currentValue: 17500, quantity: 10, purchasePrice: 1500, purchaseDate: new Date('2023-01-10').toISOString() },
    { id: '2', name: 'Vanguard S&P 500', ticker: 'VOO', type: 'ETF', initialValue: 25000, currentValue: 26100, quantity: 50, purchasePrice: 500, purchaseDate: new Date('2023-02-20').toISOString() },
    { id: '3', name: 'Conto Deposito', type: 'Conto Bancario', initialValue: 50000, currentValue: 50250 },
    { id: '4', name: 'Alphabet Inc.', ticker: 'GOOGL', type: 'Azione', initialValue: 10000, currentValue: 9500, quantity: 10, purchasePrice: 1000, purchaseDate: new Date('2023-03-05').toISOString() },
  ]);

  const handleAddAsset = (data: z.infer<typeof addAssetFormSchema>) => {
    // La logica di vendita può essere implementata in futuro
    if (data.transactionType === 'Vendita') {
      console.log("La vendita non è ancora implementata.");
      return;
    }

    const initialValue = data.quantity * data.purchasePrice;
    const newAsset: Asset = {
      id: Date.now().toString(),
      name: data.security,
      type: 'Azione', // Hardcoded per ora
      ticker: data.security,
      quantity: data.quantity,
      purchasePrice: data.purchasePrice,
      purchaseDate: data.transactionDate.toISOString(),
      initialValue: initialValue,
      currentValue: initialValue,
    };
    setAssets(prevAssets => [...prevAssets, newAsset]);
  };

  const handleUpdateAsset = (id: string, updatedData: Partial<Omit<Asset, 'id' | 'type' | 'name' | 'ticker'>>) => {
    setAssets(prevAssets =>
      prevAssets.map(asset => {
        if (asset.id === id) {
          const newAssetData = { ...asset, ...updatedData };

          const quantity = updatedData.quantity ?? asset.quantity;
          const purchasePrice = updatedData.purchasePrice ?? asset.purchasePrice;

          if (quantity !== undefined && purchasePrice !== undefined) {
            const newInitialValue = quantity * purchasePrice;
            newAssetData.initialValue = newInitialValue;
            // Quando si modificano i dati di base, si potrebbe voler ricalcolare il valore corrente
            // Per semplicità, lo reimpostiamo al nuovo valore iniziale.
            newAssetData.currentValue = newInitialValue;
          }
          
          return newAssetData;
        }
        return asset;
      })
    );
  };

  const handleRefreshAsset = (id: string) => {
    setAssets(prevAssets =>
      prevAssets.map(asset => {
        if (asset.id === id && (asset.type === 'Azione' || asset.type === 'ETF')) {
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
                  onUpdate={handleUpdateAsset}
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
