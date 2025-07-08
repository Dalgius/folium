
"use client";

import { Asset, AssetType, assetTypes } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Legend } from "recharts";
import { useState, useEffect } from "react";
import { getExchangeRate, getHistoricalData, HistoricalDataPoint } from "@/services/finance.service";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, subMonths, subYears, startOfYear, parseISO, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { Button } from "./ui/button";


interface PortfolioSummaryProps {
  assets: Asset[];
}

type TimePeriod = '1M' | '6M' | '1Y' | 'YTD' | 'MAX';

const timePeriods: { label: string; value: TimePeriod, days: number }[] = [
    { label: '1M', value: '1M', days: 30 },
    { label: '6M', value: '6M', days: 180 },
    { label: '1A', value: '1Y', days: 365 },
    { label: 'YTD', value: 'YTD', days: 0 }, // Special case
    { label: 'Max', value: 'MAX', days: 9999 },
];

const areaChartConfig = {
  value: {
    label: 'Valore',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

const pieChartConfig = assetTypes.reduce((acc, type, index) => {
    acc[type] = {
        label: type,
        color: `hsl(var(--chart-${index + 2}))`
    };
    return acc;
}, {} as ChartConfig);


export function PortfolioSummary({ assets }: PortfolioSummaryProps) {
  const [areaChartData, setAreaChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ totalInitialValue: number; totalCurrentValue: number; } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('1Y');
  
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  useEffect(() => {
    const calculateHistoricalPortfolio = async () => {
      setIsLoading(true);
      if (assets.length === 0) {
        setAreaChartData([]);
        setPieData([]);
        setSummary({ totalInitialValue: 0, totalCurrentValue: 0 });
        setIsLoading(false);
        return;
      }

      const today = new Date();
      let startDate: Date;
      switch(timePeriod) {
          case '1M': startDate = subMonths(today, 1); break;
          case '6M': startDate = subMonths(today, 6); break;
          case '1Y': startDate = subYears(today, 1); break;
          case 'YTD': startDate = startOfYear(today); break;
          case 'MAX':
          default:
              const firstPurchaseDate = assets.reduce((earliest, asset) => {
                  if (!asset.purchaseDate) return earliest;
                  const purchaseD = parseISO(asset.purchaseDate);
                  return purchaseD < earliest ? purchaseD : earliest;
              }, today);
              startDate = firstPurchaseDate < today ? firstPurchaseDate : subDays(today, 1);
              break;
      }
      
      const startDateString = format(startDate, 'yyyy-MM-dd');

      const stockAndEtfAssets = assets.filter(a => a.ticker && a.quantity);
      const uniqueTickers = [...new Set(stockAndEtfAssets.map(a => a.ticker!))];
      const uniqueCurrencies = [...new Set(assets.map(a => a.currency))];

      const [historicalDataResults, exchangeRateResults] = await Promise.all([
          Promise.all(uniqueTickers.map(ticker => getHistoricalData(ticker, startDateString))),
          Promise.all(uniqueCurrencies.map(currency => currency === 'EUR' ? Promise.resolve({currency, rate: 1}) : getExchangeRate(currency, 'EUR').then(rate => ({ currency, rate: rate || 1 }))))
      ]);

      const rates = exchangeRateResults.reduce((acc, {currency, rate}) => { acc[currency] = rate; return acc; }, {} as Record<string, number>);
      
      const priceHistoryByTicker: Record<string, HistoricalDataPoint[]> = {};
      uniqueTickers.forEach((ticker, i) => {
          priceHistoryByTicker[ticker] = historicalDataResults[i];
      });

      const dateSet = new Set<string>();
      Object.values(priceHistoryByTicker).forEach(history => history.forEach(p => dateSet.add(format(p.date, 'yyyy-MM-dd'))));
      
      for (let d = new Date(startDate); d <= today; d = subDays(d, -1)) {
        if (d >= startDate) dateSet.add(format(d, 'yyyy-MM-dd'));
      }
      
      const sortedDates = Array.from(dateSet).filter(d => parseISO(d) >= startDate).sort();
      const lastKnownPrices: Record<string, number> = {};

      const finalAreaChartData = sortedDates.map(dateStr => {
          const currentDate = parseISO(dateStr);
          let dailyValueEUR = 0;

          for (const asset of assets) {
              const assetPurchaseDate = asset.purchaseDate ? parseISO(asset.purchaseDate) : new Date(0);

              if (currentDate >= assetPurchaseDate) {
                  const rate = rates[asset.currency] || 1;
                  let assetValue = 0;

                  if (asset.type === 'Conto Bancario') {
                      assetValue = asset.initialValue;
                  } else if (asset.ticker && asset.quantity) {
                      const historyForTicker = priceHistoryByTicker[asset.ticker];
                      const pricePoint = historyForTicker.find(p => format(p.date, 'yyyy-MM-dd') === dateStr);
                      
                      if (pricePoint) {
                          lastKnownPrices[asset.ticker] = pricePoint.close;
                      }
                      
                      const price = lastKnownPrices[asset.ticker] || asset.purchasePrice || 0;
                      assetValue = price * asset.quantity;
                  }
                  dailyValueEUR += assetValue * rate;
              }
          }
          return { date: dateStr, value: parseFloat(dailyValueEUR.toFixed(2)) };
      }).filter(d => d.value > 0);

      setAreaChartData(finalAreaChartData);

      // Calculate Pie Chart Data
      const allocation = assets.reduce((acc, asset) => {
        const rate = rates[asset.currency] || 1;
        const valueInEur = asset.currentValue * rate;
        acc[asset.type] = (acc[asset.type] || 0) + valueInEur;
        return acc;
      }, {} as Record<AssetType, number>);

      const finalPieData = assetTypes.map(type => ({
        name: type,
        value: allocation[type] || 0,
        fill: `var(--color-${type})`
      })).filter(d => d.value > 0);
      setPieData(finalPieData);


      if (finalAreaChartData.length > 0) {
        const firstValue = finalAreaChartData[0].value;
        const lastValue = finalAreaChartData[finalAreaChartData.length - 1].value;
        setSummary({ totalInitialValue: firstValue, totalCurrentValue: lastValue });
      } else {
        const totalCurrentValue = assets.reduce((sum, asset) => sum + (asset.currentValue * (rates[asset.currency] || 1)), 0);
        setSummary({ totalInitialValue: totalCurrentValue, totalCurrentValue });
      }

      setIsLoading(false);
    };

    calculateHistoricalPortfolio();
  }, [assets, timePeriod]);
  
  const handleMouseMove = (e: any) => {
    if (e.activePayload && e.activePayload.length > 0) {
        setHoverValue(e.activePayload[0].payload.value);
        setHoverDate(format(parseISO(e.activePayload[0].payload.date), 'd MMM yyyy', {locale: it}));
    }
  };
  const handleMouseLeave = () => {
      setHoverValue(null);
      setHoverDate(null);
  };


  const displayValue = hoverValue ?? summary?.totalCurrentValue ?? 0;
  const initialValue = summary?.totalInitialValue ?? 0;
  
  const overallPerformance = initialValue !== 0 ? ((displayValue - initialValue) / initialValue) * 100 : 0;
  const valueChange = displayValue - initialValue;

  const PerformanceIcon = overallPerformance > 0.01 ? TrendingUp : overallPerformance < -0.01 ? TrendingDown : Minus;
  
  const performanceColor = cn({
    "text-green-600": overallPerformance > 0.01,
    "text-red-600": overallPerformance < -0.01,
    "text-muted-foreground": Math.abs(overallPerformance) <= 0.01
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-10 w-full" />
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
        <CardDescription>Andamento del tuo portafoglio in EUR ({timePeriods.find(p=>p.value === timePeriod)?.label}).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <p className="text-sm text-muted-foreground">{hoverDate || 'Valore Totale (EUR)'}</p>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <p className="text-4xl font-bold text-primary font-headline">
              {formatCurrency(displayValue, 'EUR')}
            </p>
            <div className="flex items-center gap-2">
              <PerformanceIcon className={cn("h-6 w-6", performanceColor)} />
              <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className={cn("text-2xl font-bold", performanceColor)}>
                      {overallPerformance.toFixed(2)}%
                  </p>
                  <p className={cn("text-sm font-medium", performanceColor)}>
                      ({valueChange >= 0 ? '+' : ''}{formatCurrency(valueChange, 'EUR')})
                  </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 flex flex-col gap-4">
                <ChartContainer config={areaChartConfig} className="h-[200px] w-full">
                    <AreaChart 
                      data={areaChartData} 
                      margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                    >
                        <defs>
                            <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.1}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={false} />
                        <YAxis tickLine={false} axisLine={false} tick={false} domain={['dataMin - (dataMax-dataMin)*0.1', 'dataMax + (dataMax-dataMin)*0.1']} />
                        <ChartTooltip
                            cursor={true}
                            content={<ChartTooltipContent
                                formatter={(value) => formatCurrency(value as number, 'EUR')}
                                labelFormatter={(label) => format(parseISO(label), "eeee, d MMMM yyyy", { locale: it })}
                                indicator="dot"
                            />}
                        />
                        <Area
                            dataKey="value"
                            type="natural"
                            fill="url(#fillValue)"
                            stroke="var(--color-value)"
                            strokeWidth={2}
                            dot={false}
                        />
                    </AreaChart>
                </ChartContainer>

                <div className="flex justify-center gap-1 rounded-lg border bg-card p-1">
                    {timePeriods.map((period) => (
                        <Button
                            key={period.value}
                            variant={timePeriod === period.value ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setTimePeriod(period.value)}
                            className="flex-1"
                        >
                            {period.label}
                        </Button>
                    ))}
                </div>
            </div>
            <div className="lg:col-span-2 flex flex-col gap-4 items-center">
                 <h3 className="font-semibold text-center">Composizione</h3>
                 <ChartContainer config={pieChartConfig} className="h-[200px] w-full">
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent
                                hideLabel
                                formatter={(value) => formatCurrency(value as number, 'EUR')}
                             />}
                        />
                         <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            label={false}
                         />
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                 </ChartContainer>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
