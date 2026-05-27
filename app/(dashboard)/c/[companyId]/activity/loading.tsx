import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageShell } from '@/components/page-shell';

export default function ActivityPageSkeleton() {
  return (
    <PageShell>
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Activity Log
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[88px]" />
      </Card>
    </PageShell>
  );
}
