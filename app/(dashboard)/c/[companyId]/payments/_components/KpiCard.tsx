import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

type Color = 'rose' | 'purple' | 'red' | 'gray';

interface Props {
  icon: ReactNode;
  label: string;
  value: string;
  color: Color;
  highlight?: boolean;
  loading?: boolean;
}

const BG_MAP: Record<Color, string> = {
  rose: 'bg-rose-50',
  purple: 'bg-purple-50',
  red: 'bg-red-50',
  gray: 'bg-gray-50',
};

export function KpiCard({ icon, label, value, color, highlight, loading }: Props) {
  return (
    <Card className={highlight ? 'border-red-300 bg-red-50/30' : ''}>
      <CardContent className="pt-5">
        <div className="mb-2 flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${BG_MAP[color]}`}
          >
            {icon}
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
