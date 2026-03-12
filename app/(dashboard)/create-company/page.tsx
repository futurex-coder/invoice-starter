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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  lookupCompanyByEik,
  createCompanyAction,
  type CreateCompanyInput,
} from '@/src/features/invoicing/actions';
import {
  Building2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

const CURRENCIES = ['EUR', 'BGN', 'USD'];
const PAYMENT_METHODS = [
  { value: 'bank', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
] as const;

type EikStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function CreateCompanyPage() {
  const router = useRouter();

  const [legalName, setLegalName] = useState('');
  const [eik, setEik] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [isVatRegistered, setIsVatRegistered] = useState(true);
  const [country, setCountry] = useState('BG');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [postCode, setPostCode] = useState('');
  const [mol, setMol] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [bicSwift, setBicSwift] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('EUR');
  const [defaultVatRate, setDefaultVatRate] = useState(20);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState('bank');

  const [eikStatus, setEikStatus] = useState<EikStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkEik = async () => {
    const trimmed = eik.trim();
    if (!trimmed || trimmed.length < 9) {
      setEikStatus('idle');
      return;
    }
    setEikStatus('checking');
    const res = await lookupCompanyByEik(trimmed);
    if (res.error) {
      setEikStatus('idle');
      return;
    }
    setEikStatus(res.data ? 'taken' : 'available');
  };

  const canSubmit =
    legalName.trim() &&
    eik.trim().length >= 9 &&
    city.trim() &&
    street.trim() &&
    eikStatus !== 'taken' &&
    eikStatus !== 'checking' &&
    !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    const input: CreateCompanyInput = {
      legalName,
      eik,
      vatNumber: vatNumber.trim() || null,
      isVatRegistered,
      country,
      city,
      street,
      postCode: postCode.trim() || null,
      mol: mol.trim() || null,
      bankName: bankName.trim() || null,
      iban: iban.trim() || null,
      bicSwift: bicSwift.trim() || null,
      defaultCurrency,
      defaultVatRate,
      defaultPaymentMethod,
    };

    const res = await createCompanyAction(input);
    setSaving(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    if (res.data) {
      router.push(`/c/${res.data.companyId}/dashboard`);
    }
  };

  return (
    <section className="flex-1 p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-orange-500" />
        <h1 className="text-lg lg:text-2xl font-medium">Create Company</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Identity */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Company identity</CardTitle>
            <CardDescription>
              Legal name and registration numbers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label htmlFor="eik">ЕИК (EIK / BULSTAT) *</Label>
              <div className="relative">
                <Input
                  id="eik"
                  value={eik}
                  onChange={(e) => {
                    setEik(e.target.value);
                    setEikStatus('idle');
                  }}
                  onBlur={checkEik}
                  placeholder="123456789"
                  maxLength={13}
                  required
                  className={
                    eikStatus === 'taken'
                      ? 'border-red-400 pr-9'
                      : eikStatus === 'available'
                        ? 'border-green-400 pr-9'
                        : ''
                  }
                />
                {eikStatus === 'checking' && (
                  <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-gray-400" />
                )}
                {eikStatus === 'available' && (
                  <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-green-500" />
                )}
                {eikStatus === 'taken' && (
                  <AlertCircle className="absolute right-2.5 top-2.5 h-4 w-4 text-red-500" />
                )}
              </div>
              {eikStatus === 'taken' && (
                <p className="mt-1.5 text-sm text-red-600">
                  A company with this EIK already exists. Please ask the company
                  owner to invite you instead.
                </p>
              )}
              {eikStatus === 'available' && (
                <p className="mt-1.5 text-sm text-green-600">
                  EIK is available.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>VAT registered?</Label>
                <RadioGroup
                  value={isVatRegistered ? 'yes' : 'no'}
                  onValueChange={(v) => {
                    const reg = v === 'yes';
                    setIsVatRegistered(reg);
                    if (!reg) setVatNumber('');
                  }}
                  className="flex gap-4 pt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="vat-yes" />
                    <Label htmlFor="vat-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="vat-no" />
                    <Label htmlFor="vat-no">No</Label>
                  </div>
                </RadioGroup>
              </div>
              {isVatRegistered && (
                <div>
                  <Label htmlFor="vatNumber">ДДС № (VAT number)</Label>
                  <Input
                    id="vatNumber"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    placeholder="BG123456789"
                    maxLength={14}
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="mol">МОЛ / Representative</Label>
              <Input
                id="mol"
                value={mol}
                onChange={(e) => setMol(e.target.value)}
                placeholder="Иван Иванов"
              />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>Registered business address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="street">Street *</Label>
              <Input
                id="street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="ул. Граф Игнатиев 1"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="София"
                  required
                />
              </div>
              <div>
                <Label htmlFor="postCode">Post code</Label>
                <Input
                  id="postCode"
                  value={postCode}
                  onChange={(e) => setPostCode(e.target.value)}
                  placeholder="1000"
                />
              </div>
              <div>
                <Label htmlFor="country">Country code</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="BG"
                  maxLength={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Bank details</CardTitle>
            <CardDescription>
              Optional — used when payment method is &quot;bank&quot;
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="bankName">Bank name</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="UniCredit Bulbank"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="BG80BNBG96611020345678"
                  maxLength={34}
                />
              </div>
              <div>
                <Label htmlFor="bicSwift">BIC / SWIFT</Label>
                <Input
                  id="bicSwift"
                  value={bicSwift}
                  onChange={(e) => setBicSwift(e.target.value)}
                  placeholder="UNCRBGSF"
                  maxLength={11}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice defaults */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Invoice defaults</CardTitle>
            <CardDescription>
              Pre-filled values for new invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Default currency</Label>
                <select
                  className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="defaultVatRate">Default VAT rate (%)</Label>
                <Input
                  id="defaultVatRate"
                  type="number"
                  min={0}
                  max={100}
                  value={defaultVatRate}
                  onChange={(e) =>
                    setDefaultVatRate(Number(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <Label>Default payment method</Label>
                <select
                  className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={defaultPaymentMethod}
                  onChange={(e) => setDefaultPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 rounded-md bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating company...
            </>
          ) : (
            <>
              <Building2 className="mr-2 h-4 w-4" />
              Create company
            </>
          )}
        </Button>
      </form>
    </section>
  );
}
