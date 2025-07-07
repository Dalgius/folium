"use client";

import { type LucideProps, TrendingUp, Briefcase, Landmark, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { type AssetType } from "@/types";
import { cn } from "@/lib/utils";

type AssetIconMap = {
  [key in AssetType]: React.ComponentType<LucideProps>;
};

const assetIconMap: AssetIconMap = {
  Stock: TrendingUp,
  ETF: Briefcase,
  'Bank Account': Landmark,
};

interface AssetIconProps extends LucideProps {
  type: AssetType;
}

export const AssetIcon = ({ type, ...props }: AssetIconProps) => {
  const Icon = assetIconMap[type] || Briefcase;
  return <Icon {...props} />;
};

interface PerformanceIndicatorProps extends LucideProps {
    performance: number;
}

export const PerformanceIndicator = ({ performance, className, ...props }: PerformanceIndicatorProps) => {
    const Icon = performance > 0 ? ArrowUp : performance < 0 ? ArrowDown : Minus;
    const colorClass = performance > 0 ? "text-green-600 bg-green-100" : performance < 0 ? "text-red-600 bg-red-100" : "text-muted-foreground bg-muted";

    return (
        <div className={cn("p-1 rounded-full", colorClass)}>
            <Icon className={cn("h-4 w-4", className)} {...props} />
        </div>
    )
}
