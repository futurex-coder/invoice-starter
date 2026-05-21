import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, ArrowRight } from 'lucide-react';
import { formatCurrency } from './utils';
import type { CompanyMetric } from './types';

interface Props {
  companies: CompanyMetric[];
}

export function CompaniesGrid({ companies }: Props) {
  return (
    <>
      <h2 className="text-base font-medium mb-3">Your companies</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {companies.map((c) => (
          <Link key={c.companyId} href={`/c/${c.companyId}/invoices`} className="group">
            <Card className="h-full border-gray-200 hover:border-orange-300 hover:shadow-sm transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium group-hover:text-orange-600 transition-colors">
                    {c.companyName}
                  </CardTitle>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      c.role === 'owner'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {c.role === 'owner' && <Crown className="h-3 w-3" />}
                    {c.role === 'owner' ? 'Owner' : 'Accountant'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{c.currency}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-sm font-semibold text-green-700">
                      {formatCurrency(c.revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="text-sm font-semibold text-amber-700">
                      {formatCurrency(c.outstanding)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                    <p
                      className={`text-sm font-semibold ${
                        c.overdueCount > 0 ? 'text-red-600' : 'text-gray-500'
                      }`}
                    >
                      {c.overdueCount}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end text-xs text-muted-foreground group-hover:text-orange-500 transition-colors">
                  View invoices
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
