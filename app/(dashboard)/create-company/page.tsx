'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Building2, Loader2 } from 'lucide-react';

export default function CreateCompanyPage() {
  const router = useRouter();
  const [legalName, setLegalName] = useState('');
  const [eik, setEik] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // TODO: Wire up to createCompany server action
    setError('Company creation is not yet implemented. Coming soon.');
    setSaving(false);
  };

  return (
    <section className="flex-1 p-4 lg:p-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-orange-500" />
        <h1 className="text-lg lg:text-2xl font-medium">Create Company</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New company</CardTitle>
          <CardDescription>
            Set up a new company to start issuing invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="legalName">Legal name *</Label>
              <Input
                id="legalName"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="ACME Ltd."
                required
              />
            </div>
            <div>
              <Label htmlFor="eik">EIK (BULSTAT) *</Label>
              <Input
                id="eik"
                value={eik}
                onChange={(e) => setEik(e.target.value)}
                placeholder="123456789"
                maxLength={10}
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="mr-2 h-4 w-4" />
              )}
              Create company
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
