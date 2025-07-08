
"use client";

import { Asset, AssetType, assetTypes } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Pie, PieChart } from "recharts";
import { useState, useEffect, useMemo } from "react";
import { getExchangeRate, getHistoricalData, HistoricalDataPoint } from "@/services/finance.service";
import { TrendingUp, TrendingDown, Minus, Wallet } from "lucide-react";
import { format, subMonths, subYears, startOfYear, parseISO, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { Button } from "./ui/button";

interface PortfolioSummaryProps {
  assets: Asset[];
}

type TimePeriod = '1M' | '6M' | '1Y' | 'YTD' | 'MAX';

const timePeriods: { label: string; value: TimePeriod }[] = [
    { label: '1M', value: '1M' },
    { label: '6M', value: '6M' },
    { label: '1A', value: '1Y' },
    { label: 'YTD', value: 'YTD' },
    { label: 'Max', value: 'MAX' },
];

const sanitizeNameForChart = (name: string): string => {
    return name.toLowerCase().replace(/\s+/g, '-');
};

const areaChartConfig = {
  value: {
    label: 'Valore',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

const pieChartConfig = assetTypes.reduce((acc, type) => {
    const key = sanitizeNameForChart(type);
    const chartIndex = (assetTypes.indexOf(type) % 5) + 1;
    acc[key] = {
        label: type,
        color: `hsl(var(--chart-${chartIndex}))`
    };
    return acc;
}, {} as ChartConfig);


export function PortfolioSummary({ assets }: PortfolioSummaryProps) {
  const [historicalChartData, setHistoricalChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [securitiesSummary, setSecuritiesSummary] = useState<{ totalInitialValue: number; totalCurrentValue: number; } | null>(null);
  const [totalPatrimony, setTotalPatrimony] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('1Y');
  
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const securitiesAssets = useMemo(() => assets.filter(a => a.type === 'Azione' || a.type === 'ETF'), [assets]);

  useEffect(() => {
    const calculatePortfolioSummary = async () => {
      setIsLoading(true);
      
      if (assets.length === 0) {
        setHistoricalChartData([]);
        setPieData([]);
        setSecuritiesSummary({ totalInitialValue: 0, totalCurrentValue: 0 });
        setTotalPatrimony(0);
        setIsLoading(false);
        return;
      }
      
      const uniqueCurrencies = [...new Set(assets.map(a => a.currency))];
      const exchangeRateResults = await Promise.all(
        uniqueCurrencies.map(currency => currency === 'EUR' 
          ? Promise.resolve({ currency, rate: 1 }) 
          : getExchangeRate(currency, 'EUR').then(rate => ({ currency, rate: rate || 1 }))
        )
      );
      const rates = exchangeRateResults.reduce((acc, { currency, rate }) => {
        acc[currency] = rate;
        return acc;
      }, {} as Record<string, number>);

      const totalValueEur = assets.reduce((sum, asset) => {
          const rate = rates[asset.currency] || 1;
          return sum + (asset.currentValue * rate);
      }, 0);
      setTotalPatrimony(totalValueEur);
      
      const allocation = assets.reduce((acc, asset) => {
        const rate = rates[asset.currency] || 1;
        const valueInEur = asset.currentValue * rate;
        const key = sanitizeNameForChart(asset.type);
        const typeConfig = Object.entries(pieChartConfig).find(([configKey, _]) => configKey === key);
        if (!typeConfig) return acc;
        
        const label = typeConfig[1].label as string;
        if (!acc[label]) {
            acc[label] = { value: 0, key: key };
        }
        acc[label].value += valueInEur;
        return acc;
      }, {} as Record<string, { value: number; key: string }>);

      const finalPieData = Object.entries(allocation).map(([label, data]) => {
        return {
          name: data.key,
          label: label,
          value: data.value,
          fill: `var(--color-${data.key})`
        }
      }).filter(d => d && d.value > 0);
      setPieData(finalPieData as any[]);

      if (securitiesAssets.length > 0) {
        const today = new Date();
        let startDate: Date;
        switch(timePeriod) {
            case '1M': startDate = subMonths(today, 1); break;
            case '6M': startDate = subMonths(today, 6); break;
            case '1Y': startDate = subYears(today, 1); break;
            case 'YTD': startDate = startOfYear(today); break;
            case 'MAX':
            default:
                const firstPurchaseDate = securitiesAssets.reduce((earliest, asset) => {
                    if (!asset.purchaseDate) return earliest;
                    const purchaseD = parseISO(asset.purchaseDate);
                    return purchaseD < earliest ? purchaseD : earliest;
                }, today);
                startDate = firstPurchaseDate < today ? firstPurchaseDate : subDays(today, 1);
                break;
        }
        
        const startDateString = format(startDate, 'yyyy-MM-dd');
        const uniqueTickers = [...new Set(securitiesAssets.map(a => a.ticker!))];
        const historicalDataResults = await Promise.all(uniqueTickers.map(ticker => getHistoricalData(ticker, startDateString)));
        
        const priceHistoryByTicker: Record<string, HistoricalDataPoint[]> = {};
        uniqueTickers.forEach((ticker, i) => { priceHistoryByTicker[ticker] = historicalDataResults[i]; });

        const dateSet = new Set<string>();
        Object.values(priceHistoryByTicker).forEach(history => history.forEach(p => dateSet.add(format(p.date, 'yyyy-MM-dd'))));
        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
          if (d >= startDate) dateSet.add(format(d, 'yyyy-MM-dd'));
        }
        
        const sortedDates = Array.from(dateSet).filter(d => parseISO(d) >= startDate).sort();
        const lastKnownPrices: Record<string, number> = {};

        const finalAreaChartData = sortedDates.map(dateStr => {
            const currentDate = parseISO(dateStr);
            let dailyValueEUR = 0;

            for (const asset of securitiesAssets) {
                const assetPurchaseDate = asset.purchaseDate ? parseISO(asset.purchaseDate) : new Date(0);
                if (currentDate >= assetPurchaseDate && asset.ticker && asset.quantity) {
                    const rate = rates[asset.currency] || 1;
                    const historyForTicker = priceHistoryByTicker[asset.ticker];
                    const pricePoint = historyForTicker.find(p => format(p.date, 'yyyy-MM-dd') === dateStr);
                    
                    if (pricePoint) lastKnownPrices[asset.ticker] = pricePoint.close;
                    const price = lastKnownPrices[asset.ticker] || asset.purchasePrice || 0;
                    dailyValueEUR += (price * asset.quantity) * rate;
                }
            }
            return { date: dateStr, value: parseFloat(dailyValueEUR.toFixed(2)) };
        }).filter(d => d.value > 0);

        setHistoricalChartData(finalAreaChartData);

        if (finalAreaChartData.length > 0) {
          const firstValue = finalAreaChartData[0].value;
          const lastValue = finalAreaChartData[finalAreaChartData.length - 1].value;
          setSecuritiesSummary({ totalInitialValue: firstValue, totalCurrentValue: lastValue });
        } else {
           const securitiesCurrentValue = securitiesAssets.reduce((sum, asset) => sum + (asset.currentValue * (rates[asset.currency] || 1)), 0);
           setSecuritiesSummary({ totalInitialValue: securitiesCurrentValue, totalCurrentValue: securitiesCurrentValue });
           if (securitiesCurrentValue > 0) {
              setHistoricalChartData([
                  { date: format(subDays(today,1), 'yyyy-MM-dd'), value: securitiesCurrentValue },
                  { date: format(today, 'yyyy-MM-dd'), value: securitiesCurrentValue }
              ]);
           }
        }
      } else {
        setHistoricalChartData([]);
        setSecuritiesSummary({ totalInitialValue: 0, totalCurrentValue: 0 });
      }

      setIsLoading(false);
    };

    calculatePortfolioSummary();
  }, [assets, timePeriod, securitiesAssets]);
  
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

  const securitiesDisplayValue = hoverValue ?? securitiesSummary?.totalCurrentValue ?? 0;
  const securitiesInitialValue = securitiesSummary?.totalInitialValue ?? 0;
  
  const securitiesPerformance = securitiesInitialValue !== 0 ? ((securitiesDisplayValue - securitiesInitialValue) / securitiesInitialValue) * 100 : 0;
  const securitiesValueChange = securitiesDisplayValue - securitiesInitialValue;

  const PerformanceIcon = securitiesPerformance > 0.01 ? TrendingUp : securitiesPerformance < -0.01 ? TrendingDown : Minus;
  
  const performanceColor = cn({
    "text-green-600": securitiesPerformance > 0.01,
    "text-red-600": securitiesPerformance < -0.01,
    "text-muted-foreground": Math.abs(securitiesPerformance) <= 0.01
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
      <CardHeader className="p-6">
        <CardTitle>Riepilogo Portafoglio</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-8 p-6 pt-0">
        <div className="flex flex-col gap-4 col-span-3">
            <h3 className="text-lg font-semibold font-headline">Andamento Titoli (Azioni & ETF)</h3>
            <div>
              <p className="text-sm text-muted-foreground">{hoverDate || 'Valore Corrente (EUR)'}</p>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(securitiesDisplayValue, 'EUR')}
                </p>
                <div className="flex items-center gap-2">
                  <PerformanceIcon className={cn("h-5 w-5", performanceColor)} />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className={cn("text-xl font-bold", performanceColor)}>
                          {securitiesPerformance.toFixed(2)}%
                      </p>
                      <p className={cn("text-sm font-medium", performanceColor)}>
                          ({securitiesValueChange >= 0 ? '+' : ''}{formatCurrency(securitiesValueChange, 'EUR')})
                      </p>
                  </div>
                </div>
              </div>
            </div>

            {securitiesSummary && securitiesSummary.totalCurrentValue > 0 ? (
                <>
                    <ChartContainer config={areaChartConfig} className="h-[250px] w-full">
                        <AreaChart 
                        data={historicalChartData} 
                        margin={{ top: 5, right: 0, left: -32, bottom: 0 }}
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
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-[214px] text-center border-2 border-dashed rounded-lg p-4">
                     <TrendingUp className="h-10 w-10 text-muted-foreground" />
                     <p className="mt-2 text-sm font-medium">Nessun titolo nel portafoglio</p>
                     <p className="text-xs text-muted-foreground">Aggiungi azioni o ETF per vederne l'andamento.</p>
                </div>
            )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-1 lg:border-l lg:pl-8">
            <h3 className="text-lg font-semibold font-headline">Patrimonio Complessivo</h3>
            <div>
                <p className="text-sm text-muted-foreground">Valore Totale (EUR)</p>
                 <p className="text-3xl font-bold text-primary">
                    {formatCurrency(totalPatrimony, 'EUR')}
                </p>
            </div>
             {pieData.length > 0 ? (
                <ChartContainer config={pieChartConfig} className="aspect-square w-full">
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent
                                hideLabel
                                formatter={(value, name, props) => (
                                    <div className="flex flex-col items-start">
                                        <span>{props.payload.label}</span>
                                        <span className="font-bold">{formatCurrency(value as number, 'EUR')}</span>
                                    </div>
                                )}
                            />}
                        />
                        <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="60%"
                            outerRadius="90%"
                            paddingAngle={2}
                            label={false}
                        />
                    </PieChart>
                </ChartContainer>
             ) : (
                <div className="flex flex-col items-center justify-center text-center">
                    <Wallet className="h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Patrimonio non calcolabile</p>
                </div>
             )}
        </div>
      </CardContent>
    </Card>
  );
}
