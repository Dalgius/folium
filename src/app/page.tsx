
"use client";

import { useState, useEffect } from 'react';
import { Asset } from '@/types';
import { PlusCircle, BarChart2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

import { AddAssetDialog } from '@/components/add-asset-dialog';
import { AssetCard } from '@/components/asset-card';
import { PortfolioSummary } from '@/components/portfolio-summary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type * as z from 'zod';
import type { addAssetFormSchema } from '@/components/add-asset-dialog';
import { getAssets, addAsset, updateAsset, deleteAsset } from '@/services/asset.service';

export default function Home() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAssets = async () => {
    try {
      setIsLoading(true);
      const fetchedAssets = await getAssets();
      setAssets(fetchedAssets);
    } catch (error) {
      console.error("Errore nel recupero degli asset:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati del portafoglio. Assicurati di aver configurato correttamente Firebase.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleAddAsset = async (data: z.infer<typeof addAssetFormSchema>) => {
    if (data.transactionType === 'Vendita') {
      toast({ title: "Funzione non disponibile", description: "La logica di vendita non è ancora implementata." });
      return;
    }

    const initialValue = data.quantity * data.purchasePrice;
    
    const newAssetData = {
      name: data.security,
      type: 'Azione' as const, // Hardcoded per ora
      ticker: data.security,
      quantity: data.quantity,
      purchasePrice: data.purchasePrice,
      purchaseDate: data.transactionDate.toISOString(),
      currency: data.currency,
      initialValue: initialValue,
      currentValue: initialValue,
    };

    try {
      await addAsset(newAssetData);
      toast({ title: "Successo", description: "Asset aggiunto correttamente." });
      fetchAssets(); // Re-fetch assets to update the list
    } catch (error) {
      console.error("Errore nell'aggiunta dell'asset:", error);
      toast({ title: "Errore", description: "Impossibile aggiungere l'asset.", variant: "destructive" });
    }
  };

  const handleUpdateAsset = async (id: string, updatedData: Partial<Omit<Asset, 'id'>>) => {
     try {
        const assetToUpdate = assets.find(a => a.id === id);
        if (!assetToUpdate) return;
        
        const quantity = updatedData.quantity ?? assetToUpdate.quantity;
        const purchasePrice = updatedData.purchasePrice ?? assetToUpdate.purchasePrice;
        
        const dataWithRecalculatedValues: Partial<Omit<Asset, 'id'>> = { ...updatedData };

        if (quantity !== undefined && purchasePrice !== undefined) {
            const newInitialValue = quantity * purchasePrice;
            dataWithRecalculatedValues.initialValue = newInitialValue;
            dataWithRecalculatedValues.currentValue = newInitialValue;
        }
        
        await updateAsset(id, dataWithRecalculatedValues);
        toast({ title: "Successo", description: "Asset aggiornato." });
        fetchAssets();
    } catch (error) {
        console.error("Errore nell'aggiornamento dell'asset:", error);
        toast({ title: "Errore", description: "Impossibile aggiornare l'asset.", variant: "destructive" });
    }
  };
  
  const handleRefreshAsset = async (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (asset && (asset.type === 'Azione' || asset.type === 'ETF')) {
        const changePercent = (Math.random() - 0.5) * 0.1;
        const newCurrentValue = asset.currentValue * (1 + changePercent);
        
        try {
            await updateAsset(id, { currentValue: newCurrentValue });
            toast({ title: "Aggiornato", description: "Valore dell'asset aggiornato (simulato)." });
            fetchAssets();
        } catch (error) {
            console.error("Errore nell'aggiornamento dell'asset:", error);
            toast({ title: "Errore", description: "Impossibile aggiornare il valore dell'asset.", variant: "destructive" });
        }
    }
  };

  const handleDeleteAsset = async (id: string) => {
    try {
        await deleteAsset(id);
        toast({ title: "Successo", description: "Asset eliminato." });
        fetchAssets();
    } catch (error) {
        console.error("Errore nell'eliminazione dell'asset:", error);
        toast({ title: "Errore", description: "Impossibile eliminare l'asset.", variant: "destructive" });
    }
  };

  const renderSkeletons = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
          <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
        </Card>
      ))}
    </div>
  );

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

        {isLoading ? (
          renderSkeletons()
        ) : assets.length > 0 ? (
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
