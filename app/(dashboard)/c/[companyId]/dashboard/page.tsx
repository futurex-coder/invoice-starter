'use client';

import { useCompany } from '@/lib/context/company-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText, Handshake, Package } from 'lucide-react';

export default function CompanyDashboardPage() {
  const { company } = useCompany();
  const base = `/c/${company.id}`;

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">
        {company.legalName}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href={`${base}/invoices/new`}>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                <FileText className="mr-2 h-4 w-4" />
                New Invoice
              </Button>
            </Link>
            <Link href={`${base}/partners`}>
              <Button variant="outline">
                <Handshake className="mr-2 h-4 w-4" />
                Partners
              </Button>
            </Link>
            <Link href={`${base}/articles`}>
              <Button variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Articles
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
