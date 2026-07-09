import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, ArrowRight } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import type { CompanyMetric } from './types';
import { cn } from '@/lib/utils';

interface Props {
  companies: CompanyMetric[];
}

export function CompaniesGrid({ companies }: Props) {
  return (
    <>
      <h2 className="text-base font-medium mb-3">Вашите фирми</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {companies.map((c) => (
          <Link key={c.companyId} href={`/c/${c.companyId}/invoices`} className="group">
            <Card className="h-full border-gray-200 hover:border-primary/30 hover:shadow-sm transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium group-hover:text-primary/90 transition-colors">
                    {c.companyName}
                  </CardTitle>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                      c.role === 'owner'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-blue-50 text-blue-700'
                    )}
                  >
                    {c.role === 'owner' && <Crown className="h-3 w-3" />}
                    {c.role === 'owner' ? 'Собственик' : 'Счетоводител'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{c.currency}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Приходи</p>
                    <p className="text-sm font-semibold text-green-700">
                      {formatMoney(c.revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Вземания</p>
                    <p className="text-sm font-semibold text-amber-700">
                      {formatMoney(c.outstanding)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Просрочени</p>
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        c.overdueCount > 0 ? 'text-red-600' : 'text-gray-500'
                      )}
                    >
                      {c.overdueCount}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Разходи</p>
                    <p className="text-sm font-semibold text-purple-700">
                      {formatMoney(c.expensesPaid + c.expensesOutstanding)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Неплатени</p>
                    <p className="text-sm font-semibold text-rose-700">
                      {formatMoney(c.expensesOutstanding)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">За преглед</p>
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        c.pendingReviewCount > 0
                          ? 'text-amber-700'
                          : 'text-gray-500'
                      )}
                    >
                      {c.pendingReviewCount}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Виж фактурите
                  <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
