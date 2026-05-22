'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
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
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { Stepper } from './_components/Stepper';
import { CompanyStep } from './_components/CompanyStep';
import { BankStep } from './_components/BankStep';
import { ArticlesStep } from './_components/ArticlesStep';
import type { ArticleRow } from './_components/types';
import {
  initialOnboardingForm,
  onboardingFormReducer,
  profileToOnboardingForm,
  type OnboardingFormState,
} from './_components/form-state';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useActionSWR(
    'companyProfile',
    getCompanyProfile
  );
  const { data: articlesData, isLoading: articlesLoading } = useActionSWR(
    ['articles', 'onboarding-count'],
    () => listArticles({ page: 1, pageSize: 1 })
  );

  const loading = profileLoading || articlesLoading;
  const hydratedRef = useRef(false);

  const [form, dispatch] = useReducer(onboardingFormReducer, initialOnboardingForm);
  const updateForm = useCallback(
    (patch: Partial<OnboardingFormState>) => dispatch({ type: 'SET', patch }),
    []
  );

  const [articleRows, setArticleRows] = useState<ArticleRow[]>([
    { name: '', unit: 'бр.', defaultUnitPrice: '0' },
  ]);

  useEffect(() => {
    if (loading || hydratedRef.current) return;
    hydratedRef.current = true;
    if (!profile?.legalName) return;

    dispatch({ type: 'HYDRATE', state: profileToOnboardingForm(profile) });

    if (profile.iban) {
      if (articlesData && articlesData.total > 0) {
        router.replace('/dashboard');
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(2); // one-shot: pick the initial step from hydrated SWR data
    } else {
      setStep(1);
    }
  }, [loading, profile, articlesData, router]);

  const buildProfileInput = (): UpsertCompanyProfileInput => ({
    legalName: form.legalName.trim() || form.legalName,
    eik: form.eik.trim() || form.eik,
    vatNumber: form.isVatRegistered && form.vatNumber.trim() ? form.vatNumber.trim() : null,
    isVatRegistered: form.isVatRegistered,
    country: form.country.trim() || 'BG',
    city: form.city.trim() || form.city,
    street: form.street.trim() || form.street,
    postCode: form.postCode.trim() || null,
    mol: form.mol.trim() || null,
    bankName: form.bankName.trim() || null,
    iban: form.iban.trim() || null,
    bicSwift: form.bicSwift.trim() || null,
    defaultCurrency: form.defaultCurrency,
    defaultVatRate: form.defaultVatRate,
    defaultPaymentMethod: form.defaultPaymentMethod,
  });

  const handleSaveCompany = async () => {
    setError(null);
    if (!form.legalName.trim()) return setError('Legal name is required');
    if (!form.eik.trim() || !/^\d{9,10}$/.test(form.eik.trim()))
      return setError('EIK must be 9 or 10 digits');
    if (!form.street.trim()) return setError('Street is required');
    if (!form.city.trim()) return setError('City is required');

    setSaving(true);
    const res = await upsertCompanyProfile(buildProfileInput());
    setSaving(false);
    if (res.error) return setError(res.error);
    setStep(1);
  };

  const handleSaveBank = async () => {
    setSaving(true);
    setError(null);
    const res = await upsertCompanyProfile(buildProfileInput());
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
        currency: form.defaultCurrency || 'EUR',
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
          legalName={form.legalName}
          onLegalNameChange={(v) => updateForm({ legalName: v })}
          eik={form.eik}
          onEikChange={(v) => updateForm({ eik: v })}
          isVatRegistered={form.isVatRegistered}
          onIsVatRegisteredChange={(reg) =>
            updateForm({
              isVatRegistered: reg,
              ...(!reg && { vatNumber: '' }),
            })
          }
          vatNumber={form.vatNumber}
          onVatNumberChange={(v) => updateForm({ vatNumber: v })}
          mol={form.mol}
          onMolChange={(v) => updateForm({ mol: v })}
          street={form.street}
          onStreetChange={(v) => updateForm({ street: v })}
          city={form.city}
          onCityChange={(v) => updateForm({ city: v })}
          postCode={form.postCode}
          onPostCodeChange={(v) => updateForm({ postCode: v })}
          country={form.country}
          onCountryChange={(v) => updateForm({ country: v })}
          saving={saving}
          onSave={handleSaveCompany}
        />
      )}

      {step === 1 && (
        <BankStep
          bankName={form.bankName}
          onBankNameChange={(v) => updateForm({ bankName: v })}
          iban={form.iban}
          onIbanChange={(v) => updateForm({ iban: v })}
          bicSwift={form.bicSwift}
          onBicSwiftChange={(v) => updateForm({ bicSwift: v })}
          defaultPaymentMethod={form.defaultPaymentMethod}
          onDefaultPaymentMethodChange={(v) => updateForm({ defaultPaymentMethod: v })}
          defaultCurrency={form.defaultCurrency}
          onDefaultCurrencyChange={(v) => updateForm({ defaultCurrency: v })}
          defaultVatRate={form.defaultVatRate}
          onDefaultVatRateChange={(v) => updateForm({ defaultVatRate: v })}
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
