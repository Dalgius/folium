"use client";

import { Asset } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AssetIcon, PerformanceIndicator } from "./asset-icons";
import { Trash2, Pencil } from "lucide-react";
import { UpdateAssetDialog } from "./update-asset-dialog";
import { UpdateBankAccountDialog } from "./update-bank-account-dialog";

interface AssetCardProps {
  asset: Asset;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updatedData: Partial<Omit<Asset, 'id' | 'type' | 'name' | 'ticker'>>) => void;
}

export function AssetCard({ asset, onDelete, onUpdate }: AssetCardProps) {
  const performance = asset.initialValue !== 0 
    ? ((asset.currentValue - asset.initialValue) / asset.initialValue) * 100 
    : 0;
  const absoluteGain = asset.currentValue - asset.initialValue;
  const performanceColor = cn(
    performance > 0 ? "text-green-600" : performance < 0 ? "text-red-600" : "text-muted-foreground"
  );

  return (
    <Card className="flex flex-col transition-all hover:shadow-lg">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-4 pb-2">
        <div className="flex items-center gap-3">
          <AssetIcon type={asset.type} className="h-7 w-7 text-primary" />
          <CardTitle className="text-lg font-headline">{asset.name}</CardTitle>
        </div>
        <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5">
                <PerformanceIndicator performance={performance} className="h-4 w-4" />
                <span className={cn("font-semibold", performanceColor)}>
                    {performance.toFixed(2)}%
                </span>
            </div>
            <span className={cn("text-sm font-medium", performanceColor)}>
              {(absoluteGain >= 0 ? '+' : '') + formatCurrency(absoluteGain, asset.currency)}
            </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-grow flex-col items-start gap-4 p-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(asset.currentValue, asset.currency)}
          </div>
          <div className="text-xs text-muted-foreground">
              Valore corrente
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-wrap justify-end gap-2 sm:w-auto sm:flex-nowrap">
            {asset.type === 'Conto Bancario' ? (
                <UpdateBankAccountDialog asset={asset} onAssetUpdate={onUpdate}>
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                        <Pencil className="mr-2 h-3 w-3" />
                        Modifica
                    </Button>
                </UpdateBankAccountDialog>
            ) : (
                <UpdateAssetDialog asset={asset} onAssetUpdate={onUpdate}>
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                        <Pencil className="mr-2 h-3 w-3" />
                        Modifica
                    </Button>
                </UpdateAssetDialog>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="flex-1 sm:flex-none">
                  <Trash2 className="mr-2 h-3 w-3" />
                  Elimina
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Questa azione non può essere annullata. Questo eliminerà permanentemente il tuo asset &quot;{asset.name}&quot; dal tuo portafoglio.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(asset.id)}>
                    Continua
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
