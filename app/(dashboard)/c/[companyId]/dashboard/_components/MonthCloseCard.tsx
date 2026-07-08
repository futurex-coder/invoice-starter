import Link from 'next/link';
import { CheckCircle2, CircleAlert, CalendarCheck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatMoney } from '@/src/features/bulgarian-invoicing/formatter';
import { cn } from '@/lib/utils';
import type { MonthCloseStatus } from './queries';

function monthLabelBg(iso: string): string {
  const names = [
    'януари', 'февруари', 'март', 'април', 'май', 'юни',
    'юли', 'август', 'септември', 'октомври', 'ноември', 'декември',
  ];
  const [y, m] = iso.split('-');
  const idx = Number(m) - 1;
  return names[idx] ? `${names[idx]} ${y}` : iso;
}

function ChecklistRow({
  count,
  doneLabel,
  pendingLabel,
  href,
}: {
  count: number;
  doneLabel: string;
  pendingLabel: string;
  href: string;
}) {
  const done = count === 0;
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />
      )}
      {done ? (
        <span className="text-gray-600">{doneLabel}</span>
      ) : (
        <Link href={href} className="text-gray-900 hover:underline">
          {pendingLabel}
        </Link>
      )}
    </li>
  );
}

/**
 * TRANS-2: the shared "what's left this month" view — the same card for the
 * owner and the accountant, so "имаш ли всичко за НАП?" stops being a chat
 * message.
 */
export function MonthCloseCard({
  status,
  base,
}: {
  status: MonthCloseStatus;
  base: string;
}) {
  return (
    <Card className={cn('mb-6', status.ready ? 'border-green-200' : 'border-amber-200')}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            Месец {monthLabelBg(status.month)}
          </span>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              status.ready
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            )}
          >
            {status.ready ? 'Готово за НАП' : 'Има недовършено'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          <ChecklistRow
            count={status.pendingReviewCount}
            doneLabel="Няма фактури за преглед"
            pendingLabel={`${status.pendingReviewCount} получени фактури чакат преглед`}
            href={`${base}/received-invoices`}
          />
          <ChecklistRow
            count={status.outgoingPendingAccounting}
            doneLabel="Издадените документи са осчетоводени"
            pendingLabel={`${status.outgoingPendingAccounting} издадени документа за осчетоводяване`}
            href={`${base}/invoices`}
          />
          <ChecklistRow
            count={status.receivedPendingAccounting}
            doneLabel="Получените документи са осчетоводени"
            pendingLabel={`${status.receivedPendingAccounting} получени документа за осчетоводяване`}
            href={`${base}/received-invoices`}
          />
        </ul>
        <div className="mt-3 border-t border-gray-100 pt-2 text-sm">
          <span className="text-gray-500">ДДС за месеца: </span>
          {status.vatNet === 0 ? (
            <span className="text-gray-600">
              0.00 {status.baseCurrency}
            </span>
          ) : (
            <span
              className={cn(
                'font-medium',
                status.vatNet > 0 ? 'text-red-700' : 'text-green-700'
              )}
            >
              {formatMoney(status.vatNet)} {status.baseCurrency}
            </span>
          )}
          <Link
            href={`${base}/vat`}
            className="ml-2 text-xs text-blue-600 hover:underline"
          >
            детайли →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
