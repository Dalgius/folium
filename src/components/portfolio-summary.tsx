
"use client";

import { Asset, type Currency } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface PortfolioSummaryProps {
  assets: Asset[];
}

interface SummaryData {
    totalInitialValue: number;
    totalCurrentValue: number;
}

export function PortfolioSummary({ assets }: PortfolioSummaryProps) {
  const summaries = assets.reduce((acc, asset) => {
      const currency = asset.currency || 'EUR';
      if (!acc[currency]) {
          acc[currency] = { totalInitialValue: 0, totalCurrentValue: 0 };
      }
      acc[currency].totalInitialValue += asset.initialValue;
      acc[currency].totalCurrentValue += asset.currentValue;
      return acc;
  }, {} as Record<Currency, SummaryData>);

  const sortedCurrencies = Object.keys(summaries).sort() as Currency[];

  if (sortedCurrencies.length === 0) {
      return (
           <Card>
              <CardHeader>
                  <CardTitle className="text-lg font-medium text-muted-foreground">Riepilogo Portafoglio</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-4xl font-bold text-primary font-headline">
                    {formatCurrency(0)}
                  </div>
                  <p className="text-sm text-muted-foreground pt-2">Aggiungi un asset per iniziare.</p>
              </CardContent>
          </Card>
      )
  }

  return (
      <Card>
          <CardHeader>
              <CardTitle className="text-lg font-medium text-muted-foreground">Riepilogo Portafoglio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
              {sortedCurrencies.map((currency) => {
                  const summary = summaries[currency];
                  const { totalInitialValue, totalCurrentValue } = summary;

                  const overallPerformance = totalInitialValue !== 0
                      ? ((totalCurrentValue - totalInitialValue) / totalInitialValue) * 100
                      : 0;
                  
                  const valueChange = totalCurrentValue - totalInitialValue;
                  const PerformanceIcon = overallPerformance > 0 ? ArrowUp : overallPerformance < 0 ? ArrowDown : Minus;

                  return (
                      <div key={currency}>
                          <p className="text-sm font-medium text-muted-foreground mb-2">Totale Portafoglio ({currency})</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                              <div>
                                  <p className="text-sm text-muted-foreground">Valore Totale</p>
                                  <p className="text-4xl font-bold text-primary font-headline">
                                    {formatCurrency(totalCurrentValue, currency)}
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
                                          ({valueChange >= 0 ? '+' : ''}{formatCurrency(valueChange, currency)})
                                      </p>
                                  </div>
                              </div>
                          </div>
                      </div>
                  );
              })}
          </CardContent>
      </Card>
  );
}
