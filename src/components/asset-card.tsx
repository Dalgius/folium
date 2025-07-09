
"use client";

import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AssetCardProps {
  asset: Asset;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updatedData: Partial<Omit<Asset, 'id' | 'type' | 'name' | 'ticker'>>) => void;
}

export function AssetCard({ asset, onDelete, onUpdate }: AssetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const performance = asset.initialValue !== 0 
    ? ((asset.currentValue - asset.initialValue) / asset.initialValue) * 100 
    : 0;
  const absoluteGain = asset.currentValue - asset.initialValue;
  const performanceColor = cn(
    performance > 0 ? "text-green-600" : performance < 0 ? "text-red-600" : "text-muted-foreground"
  );
  
  const dailyGainAbsolute = (asset.dailyChange != null && asset.quantity != null) ? asset.dailyChange * asset.quantity : 0;
  const dailyGainPercent = asset.dailyChangePercent != null ? asset.dailyChangePercent : 0;
  const dailyPerformanceColor = cn({
    "text-green-600": dailyGainAbsolute > 0,
    "text-red-600": dailyGainAbsolute < 0,
    "text-muted-foreground": dailyGainAbsolute === 0,
  });

  return (
    <Card className={cn(
        "flex flex-col overflow-hidden transition-all duration-300",
        isExpanded ? "shadow-lg" : "shadow-sm hover:shadow-md"
    )}>
      <div onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer flex-grow">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <AssetIcon type={asset.type} className="h-7 w-7 text-primary flex-shrink-0" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-lg font-headline truncate">
                      {asset.name}
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{asset.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
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
            </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(asset.currentValue, asset.currency)}
              </div>
            </div>
            <div className="text-right flex flex-col items-end min-h-[44px] justify-end">
                {(asset.type === 'Azione' || asset.type === 'ETF') && asset.dailyChange != null && asset.dailyChangePercent != null && (
                  <p className={cn("text-sm font-semibold", dailyPerformanceColor)}>
                    ({(dailyGainPercent >= 0 ? '+' : '')}{(dailyGainPercent * 100).toFixed(2)}%)
                  </p>
                )}
            </div>
          </div>
        </CardContent>
      </div>
      
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
      )}>
        <div 
          className="px-4 pb-4"
          onClick={(e) => e.stopPropagation()}
        >
          <Separator className="mb-4" />
          <div className="flex w-full justify-end gap-2">
              {asset.type === 'Conto Bancario' ? (
                  <UpdateBankAccountDialog asset={asset} onAssetUpdate={onUpdate}>
                      <Button variant="outline" size="sm">
                          <Pencil className="mr-2 h-3 w-3" />
                          Modifica
                      </Button>
                  </UpdateBankAccountDialog>
              ) : (
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
        </div>
      </div>
    </Card>
  );
}
