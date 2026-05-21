'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCompanyProfile,
  upsertCompanyProfile,
  createArticle,
  listArticles,
} from '@/src/features/invoicing/actions';
import type { UpsertCompanyProfileInput } from '@/src/features/invoicing/schemas';
import { Loader2 } from 'lucide-react';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Stepper } from './_components/Stepper';
import { CompanyStep } from './_components/CompanyStep';
import { BankStep } from './_components/BankStep';
import { ArticlesStep } from './_components/ArticlesStep';
import type { ArticleRow, PaymentMethod } from './_components/types';

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
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethod>('bank');
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
          (profile.defaultPaymentMethod as PaymentMethod) ?? 'bank'
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
      vatNumber: isVatRegistered && vatNumber.trim() ? vatNumber.trim() : null,
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

  const handleSaveBank = async () => {
    setSaving(true);
    setError(null);

    const input: UpsertCompanyProfileInput = {
      legalName,
      eik,
      vatNumber: isVatRegistered && vatNumber.trim() ? vatNumber.trim() : null,
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
        <h1 className="text-2xl font-semibold text-gray-900">Set up your account</h1>
        <p className="text-gray-500 mt-1">
          Complete these steps to start creating invoices.
        </p>
      </div>

      <Stepper current={step} />

      <ErrorAlert message={error} className="mb-4" />

      {step === 0 && (
        <CompanyStep
          legalName={legalName}
          onLegalNameChange={setLegalName}
          eik={eik}
          onEikChange={setEik}
          isVatRegistered={isVatRegistered}
          onIsVatRegisteredChange={(reg) => {
            setIsVatRegistered(reg);
            if (!reg) setVatNumber('');
          }}
          vatNumber={vatNumber}
          onVatNumberChange={setVatNumber}
          mol={mol}
          onMolChange={setMol}
          street={street}
          onStreetChange={setStreet}
          city={city}
          onCityChange={setCity}
          postCode={postCode}
          onPostCodeChange={setPostCode}
          country={country}
          onCountryChange={setCountry}
          saving={saving}
          onSave={handleSaveCompany}
        />
      )}

      {step === 1 && (
        <BankStep
          bankName={bankName}
          onBankNameChange={setBankName}
          iban={iban}
          onIbanChange={setIban}
          bicSwift={bicSwift}
          onBicSwiftChange={setBicSwift}
          defaultPaymentMethod={defaultPaymentMethod}
          onDefaultPaymentMethodChange={setDefaultPaymentMethod}
          defaultCurrency={defaultCurrency}
          onDefaultCurrencyChange={setDefaultCurrency}
          defaultVatRate={defaultVatRate}
          onDefaultVatRateChange={setDefaultVatRate}
          saving={saving}
          onSave={handleSaveBank}
          onSkip={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <ArticlesStep
          rows={articleRows}
          onUpdateRow={updateArticleRow}
          onAddRow={addArticleRow}
          onRemoveRow={removeArticleRow}
          saving={saving}
          onSave={handleSaveArticles}
          onSkip={() => router.push('/dashboard')}
        />
      )}
    </div>
  );
}
