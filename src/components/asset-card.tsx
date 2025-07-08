
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

interface AssetCardProps {
  asset: Asset;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updatedData: Partial<Omit<Asset, 'id' | 'type' | 'name' | 'ticker'>>) => void;
}

export function AssetCard({ asset, onDelete, onUpdate }: AssetCardProps) {
  const performance = asset.initialValue !== 0 
    ? ((asset.currentValue - asset.initialValue) / asset.initialValue) * 100 
    : 0;

  return (
    <Card className="flex flex-col transition-all hover:shadow-lg">
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 p-4 pb-2">
        <div className="flex items-center gap-3">
          <AssetIcon type={asset.type} className="h-7 w-7 text-primary" />
          <CardTitle className="text-lg font-headline">{asset.name}</CardTitle>
        </div>
        <div className="flex items-center gap-1.5 text-right">
            <PerformanceIndicator performance={performance} className="h-4 w-4" />
            <span className={cn(
                "font-semibold",
                performance > 0 ? "text-green-600" : performance < 0 ? "text-red-600" : "text-muted-foreground"
            )}>
                {performance.toFixed(2)}%
            </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-grow items-end justify-between gap-4 p-4 pt-2">
        <div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(asset.currentValue, asset.currency)}
          </div>
          <div className="text-xs text-muted-foreground">
              Valore corrente
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
            {asset.type !== 'Conto Bancario' && (
                <UpdateAssetDialog asset={asset} onAssetUpdate={onUpdate}>
                    <Button variant="outline" size="sm">
                        <Pencil className="mr-2 h-3 w-3" />
                        Modifica
                    </Button>
                </UpdateAssetDialog>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
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
