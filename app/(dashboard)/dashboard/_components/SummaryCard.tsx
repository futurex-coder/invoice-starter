import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

type Color = 'green' | 'amber' | 'blue' | 'red' | 'gray' | 'purple' | 'rose';

interface Props {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: Color;
  highlight?: boolean;
}

const BG_MAP: Record<Color, string> = {
  green: 'bg-green-50',
  amber: 'bg-amber-50',
  blue: 'bg-blue-50',
  red: 'bg-red-50',
  gray: 'bg-gray-50',
  purple: 'bg-purple-50',
  rose: 'bg-rose-50',
};

export function SummaryCard({ icon, label, value, sub, color, highlight }: Props) {
  return (
    <Card className={highlight ? 'border-red-300 bg-red-50/30' : ''}>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3 mb-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${BG_MAP[color]}`}>
            {icon}
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && (
          <p className="mt-0.5 text-[11px] text-muted-foreground italic">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}
