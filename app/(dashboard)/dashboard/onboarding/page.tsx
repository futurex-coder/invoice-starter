'use client';

import { useState, useEffect } from 'react';
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
  getCompanyProfile,
  upsertCompanyProfile,
  createArticle,
  listArticles,
} from '@/src/features/invoicing/actions';
import type { UpsertCompanyProfileInput } from '@/src/features/invoicing/schemas';
import {
  Loader2,
  Check,
  Building2,
  Landmark,
  Package,
  ArrowRight,
  Plus,
  X,
} from 'lucide-react';

const STEPS = [
  { label: 'Company', icon: Building2 },
  { label: 'Bank Details', icon: Landmark },
  { label: 'Articles', icon: Package },
];

const CURRENCIES = ['BGN', 'EUR', 'USD'];

const PAYMENT_METHODS = [
  { value: 'bank', label: 'Банков път (Bank)' },
  { value: 'cash', label: 'В брой (Cash)' },
  { value: 'barter', label: 'Бартер (Barter)' },
] as const;

const UNITS = [
  'бр.',
  'кг',
  'л',
  'м',
  'услуга',
  'час',
  'ден',
  'км',
  'кв.м',
  'куб.м',
];

interface ArticleRow {
  name: string;
  unit: string;
  defaultUnitPrice: string;
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const completed = i < current;
        const active = i === current;
        return (
          <div key={s.label} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-orange-500 text-white'
                  : completed
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {completed ? (
                <Check className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-6 sm:w-10 h-0.5 mx-1 ${
                  completed ? 'bg-orange-300' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Company
  const [legalName, setLegalName] = useState('');
  const [eik, setEik] = useState('');
  const [isVatRegistered, setIsVatRegistered] = useState(true);
  const [vatNumber, setVatNumber] = useState('');
  const [mol, setMol] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postCode, setPostCode] = useState('1000');
  const [country, setCountry] = useState('BG');

  // Step 2 — Bank
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [bicSwift, setBicSwift] = useState('');
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<
    'bank' | 'cash' | 'barter'
  >('bank');
  const [defaultCurrency, setDefaultCurrency] = useState('EUR');
  const [defaultVatRate, setDefaultVatRate] = useState(20);

  // Step 3 — Articles
  const [articleRows, setArticleRows] = useState<ArticleRow[]>([
    { name: '', unit: 'бр.', defaultUnitPrice: '0' },
  ]);

  useEffect(() => {
    (async () => {
      const [profileRes, articlesRes] = await Promise.all([
        getCompanyProfile(),
        listArticles({ page: 1, pageSize: 1 }),
      ]);

      const profile = profileRes.data;
      if (profile?.legalName) {
        setLegalName(profile.legalName);
        setEik(profile.eik);
        setIsVatRegistered(profile.isVatRegistered);
        setVatNumber(profile.vatNumber ?? '');
        setMol(profile.mol ?? '');
        setStreet(profile.street);
        setCity(profile.city);
        setPostCode(profile.postCode ?? '1000');
        setCountry(profile.country);
        setBankName(profile.bankName ?? '');
        setIban(profile.iban ?? '');
        setBicSwift(profile.bicSwift ?? '');
        setDefaultPaymentMethod(
          (profile.defaultPaymentMethod as 'bank' | 'cash' | 'barter') ??
            'bank'
        );
        setDefaultCurrency(profile.defaultCurrency);
        setDefaultVatRate(profile.defaultVatRate);

        if (profile.iban) {
          if (articlesRes.data && articlesRes.data.total > 0) {
            router.replace('/dashboard');
            return;
          }
          setStep(2);
        } else {
          setStep(1);
        }
      }

      setLoading(false);
    })();
  }, [router]);

  // ---- Step 1 save ----
  const handleSaveCompany = async () => {
    setError(null);
    if (!legalName.trim()) return setError('Legal name is required');
    if (!eik.trim() || !/^\d{9,10}$/.test(eik.trim()))
      return setError('EIK must be 9 or 10 digits');
    if (!street.trim()) return setError('Street is required');
    if (!city.trim()) return setError('City is required');

    setSaving(true);

    const input: UpsertCompanyProfileInput = {
      legalName: legalName.trim(),
      eik: eik.trim(),
      vatNumber:
        isVatRegistered && vatNumber.trim() ? vatNumber.trim() : null,
      isVatRegistered,
      country: country.trim() || 'BG',
      city: city.trim(),
      street: street.trim(),
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
    if (res.error) return setError(res.error);
    setStep(1);
  };

  // ---- Step 2 save ----
  const handleSaveBank = async () => {
    setSaving(true);
    setError(null);

    const input: UpsertCompanyProfileInput = {
      legalName,
      eik,
      vatNumber:
        isVatRegistered && vatNumber.trim() ? vatNumber.trim() : null,
      isVatRegistered,
      country,
      city,
      street,
      postCode: postCode || null,
      mol: mol || null,
      bankName: bankName.trim() || null,
      iban: iban.trim() || null,
      bicSwift: bicSwift.trim() || null,
      defaultCurrency,
      defaultVatRate,
      defaultPaymentMethod,
    };

    const res = await upsertCompanyProfile(input);
    setSaving(false);
    if (res.error) return setError(res.error);
    setStep(2);
  };

  // ---- Step 3 save ----
  const handleSaveArticles = async () => {
    const valid = articleRows.filter((a) => a.name.trim());
    if (valid.length === 0) {
      router.push('/dashboard');
      return;
    }

    setSaving(true);
    setError(null);

    for (const article of valid) {
      const res = await createArticle({
        name: article.name.trim(),
        unit: article.unit || 'бр.',
        defaultUnitPrice: Number(article.defaultUnitPrice) || 0,
        currency: defaultCurrency || 'EUR',
      });
      if (res.error) {
        setSaving(false);
        return setError(res.error);
      }
    }

    setSaving(false);
    router.push('/dashboard');
  };

  const updateArticleRow = (
    index: number,
    field: keyof ArticleRow,
    value: string
  ) => {
    setArticleRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const addArticleRow = () => {
    setArticleRows((rows) => [
      ...rows,
      { name: '', unit: 'бр.', defaultUnitPrice: '0' },
    ]);
  };

  const removeArticleRow = (index: number) => {
    setArticleRows((rows) => rows.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Set up your account
        </h1>
        <p className="text-gray-500 mt-1">
          Complete these steps to start creating invoices.
        </p>
      </div>

      <Stepper current={step} />

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step 1 — Company Details */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>
              Legal information used as the supplier on every invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ob-legalName">Legal name *</Label>
                <Input
                  id="ob-legalName"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="ACME Ltd."
                />
              </div>
              <div>
                <Label htmlFor="ob-eik">ЕИК (EIK / BULSTAT) *</Label>
                <Input
                  id="ob-eik"
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
                    <RadioGroupItem value="yes" id="ob-vat-yes" />
                    <Label htmlFor="ob-vat-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="ob-vat-no" />
                    <Label htmlFor="ob-vat-no">No</Label>
                  </div>
                </RadioGroup>
              </div>
              {isVatRegistered && (
                <div>
                  <Label htmlFor="ob-vatNumber">ДДС № (VAT number)</Label>
                  <Input
                    id="ob-vatNumber"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    placeholder="BG123456789"
                    maxLength={14}
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="ob-mol">МОЛ / Contact person</Label>
              <Input
                id="ob-mol"
                value={mol}
                onChange={(e) => setMol(e.target.value)}
                placeholder="Иван Иванов"
              />
            </div>

            <hr className="my-2" />

            <div>
              <Label htmlFor="ob-street">Street *</Label>
              <Input
                id="ob-street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="ул. Граф Игнатиев 1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ob-city">City *</Label>
                <Input
                  id="ob-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="София"
                />
              </div>
              <div>
                <Label htmlFor="ob-postCode">Post code</Label>
                <Input
                  id="ob-postCode"
                  value={postCode}
                  onChange={(e) => setPostCode(e.target.value)}
                  placeholder="1000"
                />
              </div>
              <div>
                <Label htmlFor="ob-country">Country code</Label>
                <Input
                  id="ob-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="BG"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSaveCompany}
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Save &amp; Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Bank Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Bank Details</CardTitle>
            <CardDescription>
              Optional — used when payment method is &quot;bank&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ob-bankName">Bank name</Label>
              <Input
                id="ob-bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="UniCredit Bulbank"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ob-iban">IBAN</Label>
                <Input
                  id="ob-iban"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="BG80BNBG96611020345678"
                  maxLength={34}
                />
              </div>
              <div>
                <Label htmlFor="ob-bicSwift">BIC / SWIFT</Label>
                <Input
                  id="ob-bicSwift"
                  value={bicSwift}
                  onChange={(e) => setBicSwift(e.target.value)}
                  placeholder="UNCRBGSF"
                  maxLength={11}
                />
              </div>
            </div>

            <hr className="my-2" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Default payment method</Label>
                <select
                  className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={defaultPaymentMethod}
                  onChange={(e) =>
                    setDefaultPaymentMethod(
                      e.target.value as 'bank' | 'cash' | 'barter'
                    )
                  }
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
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
                <Label htmlFor="ob-vatRate">Default VAT rate (%)</Label>
                <Input
                  id="ob-vatRate"
                  type="number"
                  min={0}
                  max={100}
                  value={defaultVatRate}
                  onChange={(e) =>
                    setDefaultVatRate(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Skip for now
              </button>
              <Button
                onClick={handleSaveBank}
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Save &amp; Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Articles */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Add Your First Articles</CardTitle>
            <CardDescription>
              Optional — create catalog items you use on invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {articleRows.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[1fr_120px_100px_36px] gap-2 items-end"
              >
                <div>
                  <Label htmlFor={`ob-art-name-${i}`}>
                    {i === 0 ? 'Article name *' : ''}
                  </Label>
                  <Input
                    id={`ob-art-name-${i}`}
                    value={row.name}
                    onChange={(e) =>
                      updateArticleRow(i, 'name', e.target.value)
                    }
                    placeholder="Article name"
                  />
                </div>
                <div>
                  <Label htmlFor={`ob-art-unit-${i}`}>
                    {i === 0 ? 'Unit' : ''}
                  </Label>
                  <select
                    id={`ob-art-unit-${i}`}
                    className="block w-full h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                    value={row.unit}
                    onChange={(e) =>
                      updateArticleRow(i, 'unit', e.target.value)
                    }
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor={`ob-art-price-${i}`}>
                    {i === 0 ? 'Price' : ''}
                  </Label>
                  <Input
                    id={`ob-art-price-${i}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.defaultUnitPrice}
                    onChange={(e) =>
                      updateArticleRow(i, 'defaultUnitPrice', e.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>
                <div>
                  {articleRows.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-gray-400 hover:text-red-500"
                      onClick={() => removeArticleRow(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={addArticleRow}
              className="mt-2"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add another
            </Button>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Skip
              </button>
              <Button
                onClick={handleSaveArticles}
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Save &amp; Finish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
