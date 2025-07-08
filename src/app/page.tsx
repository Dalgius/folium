
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Asset, AssetType } from '@/types';
import { PlusCircle, SearchX, RefreshCw, LogOut } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getQuote } from '@/services/finance.service';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';

import { AddAssetDialog } from '@/components/add-asset-dialog';
import { AssetCard } from '@/components/asset-card';
import { PortfolioSummary } from '@/components/portfolio-summary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { getAssets, addAsset, updateAsset, deleteAsset, type AddableAsset } from '@/services/asset.service';

export default function Home() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<AssetType | 'Tutti'>('Tutti');
  const { toast } = useToast();

  const fetchAssets = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const fetchedAssets = await getAssets();
      setAssets(fetchedAssets);
    } catch (error: any) {
      console.error("Errore nel recupero degli asset:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati del portafoglio.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAssets();
    }
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleAddAsset = async (asset: AddableAsset) => {
    try {
      await addAsset(asset);
      toast({ title: "Successo", description: "Asset aggiunto correttamente." });
      fetchAssets(); 
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
            const initialValue = quantity * purchasePrice;
            dataWithRecalculatedValues.initialValue = initialValue;

            if(assetToUpdate.ticker) {
              const quote = await getQuote(assetToUpdate.ticker);
              if (quote?.price) {
                dataWithRecalculatedValues.currentValue = quote.price * quantity;
              } else {
                dataWithRecalculatedValues.currentValue = initialValue;
              }
            } else {
               dataWithRecalculatedValues.currentValue = initialValue;
            }
        }
        
        await updateAsset(id, dataWithRecalculatedValues);
        toast({ title: "Successo", description: "Asset aggiornato." });
        fetchAssets();
    } catch (error) {
        console.error("Errore nell'aggiornamento dell'asset:", error);
        toast({ title: "Errore", description: "Impossibile aggiornare l'asset.", variant: "destructive" });
    }
  };
  
  const handleRefreshAllAssets = async () => {
    toast({ title: "In corso...", description: "Aggiornamento dei valori di mercato in corso." });
    try {
        const assetsToRefresh = assets.filter(a => a.type === 'Azione' || a.type === 'ETF');
        const updatePromises = assetsToRefresh.map(async (asset) => {
            if (!asset.ticker || !asset.quantity) return;
            const quote = await getQuote(asset.ticker);
            if (quote?.price) {
                const newCurrentValue = quote.price * asset.quantity;
                return updateAsset(asset.id, { currentValue: newCurrentValue });
            }
        });
        
        await Promise.all(updatePromises);

        toast({ title: "Successo", description: "Tutti gli asset sono stati aggiornati con i valori di mercato." });
        fetchAssets();
    } catch (error) {
        console.error("Errore durante l'aggiornamento di tutti gli asset:", error);
        toast({ title: "Errore", description: "Impossibile aggiornare i valori degli asset.", variant: "destructive" });
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

  const filteredAssets = assets.filter(asset => 
    activeFilter === 'Tutti' || asset.type === activeFilter
  );

  const filterOptions: { label: string; value: AssetType | 'Tutti' }[] = [
    { label: 'Tutti', value: 'Tutti' },
    { label: 'Azioni', value: 'Azione' },
    { label: 'ETF', value: 'ETF' },
    { label: 'Conti Bancari', value: 'Conto Bancario' },
  ];
  
  const getFilterLabel = (filterValue: AssetType | 'Tutti') => {
    return filterOptions.find(opt => opt.value === filterValue)?.label || 'Asset';
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
             <div className="flex items-center gap-3">
                <Image src="/logo.png" alt="Folium Logo" width={32} height={32} />
                <div>
                  <h1 className="text-3xl font-bold text-primary font-headline tracking-tight">Folium</h1>
                  {user && <p className="text-sm text-muted-foreground">Bentornato, {user.email}</p>}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleRefreshAllAssets} disabled={isLoading || assets.length === 0}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Aggiorna Tutto
                </Button>
                <AddAssetDialog onAssetAdd={handleAddAsset}>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Asset
                </Button>
                </AddAssetDialog>
                {user && (
                    <Button variant="ghost" size="icon" onClick={handleLogout} title="Esci">
                        <LogOut className="h-5 w-5" />
                    </Button>
                )}
            </div>
          </div>
          <PortfolioSummary assets={filteredAssets} />
        </header>
        
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
            {filterOptions.map((option) => (
                <Button
                key={option.value}
                variant={activeFilter === option.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveFilter(option.value)}
                className="flex-grow sm:flex-grow-0"
                >
                {option.label}
                </Button>
            ))}
        </div>

        {isLoading ? (
          renderSkeletons()
        ) : assets.length > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-foreground font-headline">
                    {getFilterLabel(activeFilter)}
                </h2>
                <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    {filteredAssets.length} {filteredAssets.length === 1 ? 'risultato' : 'risultati'}
                </span>
            </div>
            {filteredAssets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAssets.map(asset => (
                    <AssetCard
                    key={asset.id}
                    asset={asset}
                    onDelete={handleDeleteAsset}
                    onUpdate={handleUpdateAsset}
                    />
                ))}
                </div>
            ) : (
                <div className="text-center py-20 px-6 border-2 border-dashed border-border rounded-lg">
                    <SearchX className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold text-foreground">Nessun asset trovato</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Non ci sono asset che corrispondono al filtro &quot;{getFilterLabel(activeFilter)}&quot;.</p>
                </div>
            )}
          </section>
        ) : (
          <div className="text-center py-20 px-6 border-2 border-dashed border-border rounded-lg">
            <Image src="/logo.png" alt="Folium Logo" width={48} height={48} className="mx-auto opacity-50" />
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
