import { Building2, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  legalName: string;
  eik: string;
  role: string;
}

export function CompanyHeader({ legalName, eik, role }: Props) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Building2 className="h-6 w-6 text-primary" />
      <div>
        <h1 className="text-lg lg:text-2xl font-medium">{legalName}</h1>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground font-mono">
            ЕИК: {eik}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              role === 'owner'
                ? 'bg-primary/10 text-primary'
                : 'bg-blue-50 text-blue-700'
            )}
          >
            {role === 'owner' && <Crown className="h-3 w-3" />}
            {role === 'owner' ? 'Собственик' : 'Счетоводител'}
          </span>
        </div>
      </div>
    </div>
  );
}
