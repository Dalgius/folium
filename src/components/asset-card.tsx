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
import { UpdateAssetDialog } from "./update-asset-dialog";
import { AssetIcon, PerformanceIndicator } from "./asset-icons";
import { PenLine, Trash2 } from "lucide-react";

interface AssetCardProps {
  asset: Asset;
  onUpdate: (id: string, newCurrentValue: number) => void;
  onDelete: (id: string) => void;
}

export function AssetCard({ asset, onUpdate, onDelete }: AssetCardProps) {
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
          <CardDescription>{asset.type}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Current Value</p>
          <p className="text-3xl font-bold text-foreground">
            {formatCurrency(asset.currentValue)}
          </p>
        </div>
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
                {formatCurrency(valueChange)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <UpdateAssetDialog asset={asset} onAssetUpdate={onUpdate}>
           <Button variant="outline" size="sm">
            <PenLine className="mr-2 h-4 w-4" />
            Update
          </Button>
        </UpdateAssetDialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your asset &quot;{asset.name}&quot; from your portfolio.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(asset.id)}>
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
