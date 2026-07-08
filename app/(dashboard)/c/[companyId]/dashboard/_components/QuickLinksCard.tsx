import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface QuickLink {
  href: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  sub?: string;
}

interface Props {
  links: QuickLink[];
}

export function QuickLinksCard({ links }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Бързи връзки</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-primary/30 hover:bg-primary/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-gray-400 group-hover:text-primary" />
                <span className="text-sm font-medium">{link.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {link.count !== undefined && (
                  <span className="text-xs text-muted-foreground">{link.count}</span>
                )}
                {link.sub && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {link.sub}
                  </span>
                )}
                <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-primary" />
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
