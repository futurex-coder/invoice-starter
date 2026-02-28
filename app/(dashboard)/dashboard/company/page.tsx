'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  getCompanyProfile,
  upsertCompanyProfile,
} from '@/src/features/invoicing/actions';
import type { TeamCompanyProfile } from '@/lib/db/schema';
import type { UpsertCompanyProfileInput } from '@/src/features/invoicing/schemas';
import { Loader2, Save, Building2, CheckCircle } from 'lucide-react';

const CURRENCIES = ['EUR', 'BGN'];
const PAYMENT_METHODS = [
  { value: 'bank', label: 'Банков път (Bank)' },
  { value: 'cash', label: 'В брой (Cash)' },
  { value: 'barter', label: 'Бартер (Barter)' },
] as const;

export default function CompanyProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<TeamCompanyProfile | null>(null);

  // Form fields
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
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<'bank' | 'cash' | 'barter'>('bank');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await getCompanyProfile();
      setLoading(false);
      if (res.data) {
        const p = res.data;
        setProfile(p);
        setLegalName(p.legalName);
        setEik(p.eik);
        setVatNumber(p.vatNumber ?? '');
        setIsVatRegistered(p.isVatRegistered);
        setCountry(p.country);
        setCity(p.city);
        setStreet(p.street);
        setPostCode(p.postCode ?? '');
        setMol(p.mol ?? '');
        setBankName(p.bankName ?? '');
        setIban(p.iban ?? '');
        setBicSwift(p.bicSwift ?? '');
        setDefaultCurrency(p.defaultCurrency);
        setDefaultVatRate(p.defaultVatRate);
        setDefaultPaymentMethod((p.defaultPaymentMethod as 'bank' | 'cash' | 'barter') ?? 'bank');
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const input: UpsertCompanyProfileInput = {
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

    const res = await upsertCompanyProfile(input);
    setSaving(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    if (res.data) {
      setProfile(res.data);
      setSuccess('Company profile saved successfully.');
    }
  };

  if (loading) {
    return (
      <section className="flex-1 p-4 lg:p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-orange-500" />
        <h1 className="text-lg lg:text-2xl font-medium">Company Profile</h1>
      </div>

      {!profile && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          You need to complete your company profile before you can create invoices. This data is used as the Supplier (Доставчик) on every invoice.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-md bg-green-50 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Identity */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Company identity</CardTitle>
          <CardDescription>Legal name and registration numbers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="legalName">Legal name *</Label>
              <Input
                id="legalName"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="ACME Ltd."
              />
            </div>
            <div>
              <Label htmlFor="eik">ЕИК (EIK / BULSTAT) *</Label>
              <Input
                id="eik"
                value={eik}
                onChange={(e) => setEik(e.target.value)}
                placeholder="123456789"
                maxLength={10}
              />
            </div>
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
            <Label htmlFor="mol">МОЛ / Contact person</Label>
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
          <CardDescription>Used when payment method is &quot;bank&quot;</CardDescription>
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
          <CardDescription>Pre-filled values for new invoices</CardDescription>
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
                  <option key={c} value={c}>{c}</option>
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
                onChange={(e) => setDefaultVatRate(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Default payment method</Label>
              <select
                className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={defaultPaymentMethod}
                onChange={(e) => setDefaultPaymentMethod(e.target.value as 'bank' | 'cash' | 'barter')}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save company profile
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
