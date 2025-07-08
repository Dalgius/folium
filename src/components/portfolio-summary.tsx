
"use client";

import { Asset } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Pie, PieChart } from "recharts";
import { useState, useEffect } from "react";
import { getExchangeRate } from "@/services/finance.service";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PortfolioSummaryProps {
  assets: Asset[];
}

const chartConfig = {
  "Conto Bancario": {
    label: "Conti Bancari",
    color: "hsl(var(--chart-1))",
  },
  "Azione": {
    label: "Azioni",
    color: "hsl(var(--chart-2))",
  },
  "ETF": {
    label: "ETF",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export function PortfolioSummary({ assets }: PortfolioSummaryProps) {
  const [summary, setSummary] = useState<{
    totalInitialValue: number;
    totalCurrentValue: number;
    pieData: any[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const calculateSummary = async () => {
      if (assets.length === 0) {
        setSummary({ totalInitialValue: 0, totalCurrentValue: 0, pieData: [] });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      let initialEUR = 0;
      let currentEUR = 0;
      const assetValuesByType: { [key: string]: number } = {};

      const exchangeRateCache = new Map<string, number>();
      exchangeRateCache.set('EUR', 1);

      for (const asset of assets) {
        let rate = exchangeRateCache.get(asset.currency);

        if (rate === undefined) {
          const fetchedRate = await getExchangeRate(asset.currency, 'EUR');
          if (fetchedRate) {
            rate = fetchedRate;
            exchangeRateCache.set(asset.currency, rate);
          } else {
            console.warn(`Could not fetch exchange rate for ${asset.currency} to EUR. Skipping asset ${asset.name} in total summary.`);
            continue;
          }
        }
        
        const currentValueInEUR = asset.currentValue * rate;
        const initialValueInEUR = asset.initialValue * rate;

        currentEUR += currentValueInEUR;
        initialEUR += initialValueInEUR;

        if (!assetValuesByType[asset.type]) {
          assetValuesByType[asset.type] = 0;
        }
        assetValuesByType[asset.type] += currentValueInEUR;
      }

      const pieData = Object.entries(assetValuesByType)
        .map(([name, value]) => ({
          name,
          value,
          fill: chartConfig[name as keyof typeof chartConfig]?.color || "hsl(var(--chart-5))",
        }))
        .sort((a, b) => b.value - a.value);

      setSummary({
        totalInitialValue: initialEUR,
        totalCurrentValue: currentEUR,
        pieData,
      });
      setIsLoading(false);
    };

    calculateSummary();
  }, [assets]);

  const { totalInitialValue, totalCurrentValue, pieData } = summary || { totalInitialValue: 0, totalCurrentValue: 0, pieData: [] };
  
  const overallPerformance = totalInitialValue !== 0
    ? ((totalCurrentValue - totalInitialValue) / totalInitialValue) * 100
    : 0;
  
  const valueChange = totalCurrentValue - totalInitialValue;
  const PerformanceIcon = overallPerformance > 0 ? TrendingUp : overallPerformance < 0 ? TrendingDown : Minus;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-6 sm:flex-row">
            <Skeleton className="h-48 w-48 rounded-full" />
            <div className="flex-1 space-y-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-8 w-1/2" />
            </div>
        </CardContent>
      </Card>
    );
  }

  if (assets.length === 0 && !isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Riepilogo Portafoglio</CardTitle>
          <CardDescription>Il tuo portafoglio è vuoto.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(0, 'EUR')}</p>
          <p className="text-sm text-muted-foreground">Aggiungi un asset per iniziare.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riepilogo Portafoglio</CardTitle>
        <CardDescription>Andamento e composizione del tuo portafoglio in EUR.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="w-full flex-1 sm:w-1/3">
           <ChartContainer
                config={chartConfig}
                className="mx-auto aspect-square max-h-[250px]"
            >
                <PieChart>
                    <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent 
                          hideLabel 
                          formatter={(value, name) => [formatCurrency(value as number, 'EUR'), chartConfig[name as keyof typeof chartConfig].label]}
                        />}
                    />
                    <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        strokeWidth={2}
                        labelLine={false}
                    >
                    </Pie>
                </PieChart>
            </ChartContainer>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center space-y-4 sm:items-start">
            <div>
                <p className="text-sm text-muted-foreground">Valore Totale (EUR)</p>
                <p className="text-4xl font-bold text-primary font-headline">
                  {formatCurrency(totalCurrentValue, 'EUR')}
                </p>
            </div>
             <div className="flex items-center gap-2">
                <PerformanceIcon className={cn(
                    "h-6 w-6",
                    overallPerformance > 0 ? "text-green-600" : overallPerformance < 0 ? "text-red-600" : "text-muted-foreground"
                )} />
                <div className="flex flex-wrap items-baseline gap-x-2">
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
                        ({valueChange >= 0 ? '+' : ''}{formatCurrency(valueChange, 'EUR')})
                    </p>
                </div>
            </div>
             <div className="flex w-full flex-col gap-2 text-sm">
              <div className="font-medium text-muted-foreground">Composizione</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <div className="flex flex-1 justify-between">
                      <span className="text-muted-foreground">
                        {chartConfig[entry.name as keyof typeof chartConfig]?.label || entry.name}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(entry.value, 'EUR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
