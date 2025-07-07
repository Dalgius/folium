"use client";

import { Asset } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface PortfolioSummaryProps {
  assets: Asset[];
}

export function PortfolioSummary({ assets }: PortfolioSummaryProps) {
  const totalInitialValue = assets.reduce((sum, asset) => sum + asset.initialValue, 0);
  const totalCurrentValue = assets.reduce((sum, asset) => sum + asset.currentValue, 0);

  const overallPerformance = totalInitialValue !== 0
    ? ((totalCurrentValue - totalInitialValue) / totalInitialValue) * 100
    : 0;
  
  const valueChange = totalCurrentValue - totalInitialValue;

  const PerformanceIcon = overallPerformance > 0 ? ArrowUp : overallPerformance < 0 ? ArrowDown : Minus;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium text-muted-foreground">Riepilogo Portafoglio</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
            <p className="text-sm text-muted-foreground">Valore Totale</p>
            <p className="text-4xl font-bold text-primary font-headline">
              {formatCurrency(totalCurrentValue)}
            </p>
        </div>
        <div className="flex flex-col justify-center">
            <p className="text-sm text-muted-foreground">Performance Complessiva</p>
            <div className="flex items-center gap-2">
                <PerformanceIcon className={cn(
                    "h-6 w-6",
                    overallPerformance > 0 ? "text-green-600" : overallPerformance < 0 ? "text-red-600" : "text-muted-foreground"
                )} />
                <p className="text-2xl font-bold">
                    <span className={cn(
                        overallPerformance > 0 ? "text-green-600" : overallPerformance < 0 ? "text-red-600" : "text-muted-foreground"
                    )}>
                        {overallPerformance.toFixed(2)}%
                    </span>
                </p>
                <p className={cn("text-sm font-medium",
                     valueChange > 0 ? "text-green-600" : valueChange < 0 ? "text-red-600" : "text-muted-foreground"
                )}>
                    ({valueChange >= 0 ? '+' : ''}{formatCurrency(valueChange)})
                </p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
