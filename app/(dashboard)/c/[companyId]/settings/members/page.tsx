'use client';

import { useCompany } from '@/lib/context/company-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MembersPage() {
  const { company, role } = useCompany();

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Members</h1>

      <Card>
        <CardHeader>
          <CardTitle>Company members</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Member management for {company.legalName} will be available here.
            Your role: <span className="font-medium capitalize">{role}</span>.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
