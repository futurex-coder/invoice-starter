import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageShell } from '@/components/page-shell';

export default function ActivityPageSkeleton() {
  return (
    <PageShell>
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Дневник на активността
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Скорошна активност</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[88px]" />
      </Card>
    </PageShell>
  );
}
