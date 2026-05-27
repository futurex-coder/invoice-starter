import { Loader2 } from 'lucide-react';
import { PageShell } from '@/components/page-shell';

/**
 * Dashboard-scope loading state. Renders during navigation between
 * (dashboard)/* routes — bridges the gap before the destination route
 * has its own data ready.
 */
export default function DashboardLoading() {
  return (
    <PageShell className="flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </PageShell>
  );
}
