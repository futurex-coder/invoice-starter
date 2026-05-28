import { Loader2 } from 'lucide-react';
import { PageShell } from '@/components/page-shell';

/**
 * Company-scope loading state. Renders during navigation between
 * /c/[companyId]/* routes, keeping the company-layout shell visible.
 */
export default function CompanyScopeLoading() {
  return (
    <PageShell className="flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </PageShell>
  );
}
