"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Asset, AssetType } from '@/types';
import { PlusCircle, SearchX, RefreshCw, LogOut } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getQuote } from '@/services/finance.service';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { getAssets, addAsset, updateAsset, deleteAsset, type AddableAsset } from '@/services/asset.service';

import { AddAssetDialog } from '@/components/add-asset-dialog';
import { AssetCard } from '@/components/asset-card';
import { PortfolioSummary } from '@/components/portfolio-summary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { FoliumLogo } from '@/components/folium-logo';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export default function Home() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<AssetType | 'Tutti'>('Tutti');
  const [sortOrder, setSortOrder] = useState<string>('purchaseDate_desc');
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      getAssets()
        .then(setAssets)
        .catch(error => {
          console.error("Errore nel caricamento degli asset:", error);
          toast({ title: "Errore", description: "Impossibile caricare gli asset dal database.", variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    } else {
      setAssets([]);
      setIsLoading(false);
    }
  }, [user, toast]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleAddAsset = async (asset: AddableAsset) => {
    try {
        const newAssetWithId = await addAsset(asset);
        setAssets(prevAssets => [newAssetWithId, ...prevAssets]);
        toast({ title: "Successo", description: "Asset aggiunto correttamente." });
    } catch (error) {
        console.error("Errore nell'aggiunta dell'asset:", error);
        toast({ title: "Errore", description: "Impossibile aggiungere l'asset.", variant: "destructive" });
    }
  };

  const handleUpdateAsset = async (id: string, updatedData: Partial<Omit<Asset, 'id'>>) => {
     try {
        const assetToUpdate = assets.find(a => a.id === id);
        if (!assetToUpdate) return;
        
        let finalUpdatedData: Partial<Asset> = { ...updatedData };
        
        if (updatedData.quantity !== undefined || updatedData.purchasePrice !== undefined) {
            const quantity = updatedData.quantity ?? assetToUpdate.quantity ?? 0;
            const purchasePrice = updatedData.purchasePrice ?? assetToUpdate.purchasePrice ?? 0;
            finalUpdatedData.initialValue = quantity * purchasePrice;

            if (assetToUpdate.ticker) {
                const quote = await getQuote(assetToUpdate.ticker);
                if (quote) {
                    finalUpdatedData.currentValue = quote.price * quantity;
                    finalUpdatedData.dailyChange = quote.dailyChange;
                    finalUpdatedData.dailyChangePercent = quote.dailyChangePercent;
                } else {
                    finalUpdatedData.currentValue = finalUpdatedData.initialValue;
                }
            }
        } else if (updatedData.currentValue !== undefined) {
            finalUpdatedData.initialValue = updatedData.currentValue;
        }
        
        await updateAsset(id, finalUpdatedData as Partial<AddableAsset>);
        
        setAssets(prevAssets => prevAssets.map(asset => 
            asset.id === id ? { ...asset, ...finalUpdatedData } : asset
        ));
        toast({ title: "Successo", description: "Asset aggiornato." });
    } catch (error) {
        console.error("Errore nell'aggiornamento dell'asset:", error);
        toast({ title: "Errore", description: "Impossibile aggiornare l'asset.", variant: "destructive" });
    }
  };
  
  const handleRefreshAllAssets = async () => {
    toast({ title: "In corso...", description: "Aggiornamento dei valori di mercato in corso." });
    try {
        const assetsToRefresh = assets.filter(a => a.type === 'Azione' || a.type === 'ETF');
        const updatedAssets = [...assets];
        
        for (const asset of assetsToRefresh) {
            if (!asset.ticker || !asset.quantity) continue;
            const quote = await getQuote(asset.ticker);
            if (quote?.price) {
                const index = updatedAssets.findIndex(a => a.id === asset.id);
                if (index !== -1) {
                    const newCurrentValue = quote.price * asset.quantity;
                    const updateData = {
                        currentValue: newCurrentValue,
                        dailyChange: quote.dailyChange,
                        dailyChangePercent: quote.dailyChangePercent,
                    };
                    updatedAssets[index] = { ...updatedAssets[index], ...updateData };
                    await updateAsset(asset.id, updateData);
                }
            }
        }
        
        setAssets(updatedAssets);
        toast({ title: "Successo", description: "Tutti gli asset sono stati aggiornati con i valori di mercato." });
    } catch (error) {
        console.error("Errore durante l'aggiornamento di tutti gli asset:", error);
        toast({ title: "Errore", description: "Impossibile aggiornare i valori degli asset.", variant: "destructive" });
    }
  };

  const handleDeleteAsset = async (id: string) => {
    try {
        await deleteAsset(id);
        setAssets(prevAssets => prevAssets.filter(asset => asset.id !== id));
        toast({ title: "Successo", description: "Asset eliminato." });
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

  const sortedAssets = useMemo(() => {
    const calculatePerformance = (asset: Asset) => {
      if (asset.initialValue === 0) return 0;
      return ((asset.currentValue - asset.initialValue) / asset.initialValue);
    };

    return [...assets].sort((a, b) => {
      switch (sortOrder) {
        case 'purchaseDate_asc':
          return new Date(a.purchaseDate || 0).getTime() - new Date(b.purchaseDate || 0).getTime();
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'currentValue_desc':
          return b.currentValue - a.currentValue;
        case 'currentValue_asc':
          return a.currentValue - b.currentValue;
        case 'performance_desc':
          return calculatePerformance(b) - calculatePerformance(a);
        case 'performance_asc':
          return calculatePerformance(a) - calculatePerformance(b);
        case 'purchaseDate_desc':
        default:
          return new Date(b.purchaseDate || 0).getTime() - new Date(a.purchaseDate || 0).getTime();
      }
    });
  }, [assets, sortOrder]);

  const filteredAssets = sortedAssets.filter(asset => 
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
              <Image src="/logo.png?v=2" alt="Folium Logo" width={40} height={40} data-ai-hint="logo" />
              <div className="flex flex-col items-start justify-center">
                  <FoliumLogo className="h-8 w-auto text-primary" />
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
          <PortfolioSummary assets={assets} activeFilter={activeFilter} />
        </header>
        
        <div className="mb-6 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
                {filterOptions.map((option) => (
                    <Button
                    key={option.value}
                    variant={activeFilter === option.value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveFilter(option.value)}
                    >
                    {option.label}
                    </Button>
                ))}
            </div>
            
            <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Ordina per..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchaseDate_desc">Data (più recente)</SelectItem>
                  <SelectItem value="purchaseDate_asc">Data (meno recente)</SelectItem>
                  <SelectItem value="name_asc">Nome (A-Z)</SelectItem>
                  <SelectItem value="name_desc">Nome (Z-A)</SelectItem>
                  <SelectItem value="currentValue_desc">Valore (decrescente)</SelectItem>
                  <SelectItem value="currentValue_asc">Valore (crescente)</SelectItem>
                  <SelectItem value="performance_desc">Performance (migliore)</SelectItem>
                  <SelectItem value="performance_asc">Performance (peggiore)</SelectItem>
                </SelectContent>
            </Select>
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
                    onDelete={() => handleDeleteAsset(asset.id)}
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
            <div className="flex items-center justify-center gap-4 mx-auto w-fit">
                <Image src="/logo.png?v=2" alt="Folium Logo" width={64} height={64} className="opacity-50" data-ai-hint="logo" />
                <FoliumLogo className="h-12 w-auto text-muted-foreground opacity-50" />
            </div>
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
