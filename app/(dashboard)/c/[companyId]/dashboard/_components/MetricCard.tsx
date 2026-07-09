import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Color = 'green' | 'amber' | 'blue' | 'red' | 'gray' | 'purple' | 'rose';

interface Props {
  icon: ReactNode;
  label: string;
  value: string;
  color: Color;
  highlight?: boolean;
  /** When set, the whole card becomes a shortcut into a filtered list. */
  href?: string;
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

export function MetricCard({ icon, label, value, color, highlight, href }: Props) {
  const card = (
    <Card
      className={cn(
        highlight && 'border-red-300 bg-red-50/30',
        href && 'transition-colors hover:border-gray-300 hover:bg-gray-50/60'
      )}
    >
      <CardContent className="pt-5">
        <div className="flex items-center gap-3 mb-2">
          <div
            className={cn('flex h-9 w-9 items-center justify-center rounded-lg', BG_MAP[color])}
          >
            {icon}
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
