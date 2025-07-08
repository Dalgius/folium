
"use client";

import { Asset } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface AssetCardProps {
  asset: Asset;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updatedData: Partial<Omit<Asset, 'id' | 'type' | 'name' | 'ticker'>>) => void;
}

export function AssetCard({ asset, onDelete, onUpdate }: AssetCardProps) {
  const performance = asset.initialValue !== 0 
    ? ((asset.currentValue - asset.initialValue) / asset.initialValue) * 100 
    : 0;
  const valueChange = asset.currentValue - asset.initialValue;

  return (
    <Card className="flex flex-col transition-all hover:shadow-lg">
      <CardHeader className="flex-row items-start gap-4 space-y-0">
        <div className="flex-shrink-0">
          <AssetIcon type={asset.type} className="h-8 w-8 text-primary" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-xl font-headline">{asset.name}</CardTitle>
          <CardDescription>{asset.type} {asset.ticker && `(${asset.ticker})`}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Valore Corrente</p>
          <p className="text-3xl font-bold text-foreground">
            {formatCurrency(asset.currentValue, asset.currency)}
          </p>
        </div>
         {asset.quantity && asset.purchasePrice && (
            <div className="text-sm text-muted-foreground">
                <p>Quantità: {asset.quantity}</p>
                <p>P. Acq.: {formatCurrency(asset.purchasePrice, asset.currency)}</p>
                {asset.purchaseDate && <p>Data Acq.: {format(parseISO(asset.purchaseDate), 'dd MMM yyyy', { locale: it })}</p>}
            </div>
        )}
        <div className="flex items-center justify-between rounded-lg bg-muted p-3">
          <div className="text-sm font-medium">Performance</div>
          <div className="flex items-center gap-2">
            <PerformanceIndicator performance={performance} />
            <div className="flex flex-col items-end">
              <span className={cn(
                "font-semibold",
                performance > 0 ? "text-green-600" : performance < 0 ? "text-red-600" : "text-muted-foreground"
              )}>
                {performance.toFixed(2)}%
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(valueChange, asset.currency)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        {asset.type !== 'Conto Bancario' && (
            <UpdateAssetDialog asset={asset} onAssetUpdate={onUpdate}>
                <Button variant="outline" size="sm">
                    <Pencil className="mr-2 h-4 w-4" />
                    Modifica
                </Button>
            </UpdateAssetDialog>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
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
      </CardFooter>
    </Card>
  );
}
