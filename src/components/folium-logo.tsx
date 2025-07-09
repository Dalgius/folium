import React from 'react';
import { cn } from '@/lib/utils';

export function FoliumLogo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 150 40"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('fill-current', className)}
      {...props}
    >
      {/* Placeholder SVG - Puoi sostituire questo con il codice del tuo SVG */}
      <text x="0" y="30" fontFamily="Inter, sans-serif" fontSize="30" fontWeight="bold">
        Folium
      </text>
    </svg>
  );
}
