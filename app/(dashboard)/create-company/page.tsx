'use client';

import { useCallback, useReducer, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  lookupCompanyByEik,
  createCompanyAction,
  type CreateCompanyInput,
} from '@/src/features/invoicing/actions';
import { Building2, Loader2 } from 'lucide-react';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { IdentityCard } from './_components/IdentityCard';
import { AddressCard } from '@/components/company-form/AddressCard';
import { BankDetailsCard } from '@/components/company-form/BankDetailsCard';
import { InvoiceDefaultsCard } from './_components/InvoiceDefaultsCard';
import {
  createCompanyFormReducer,
  initialCreateCompanyForm,
  type CreateCompanyFormState,
  type EikStatus,
} from './_components/form-state';

export default function CreateCompanyPage() {
  const router = useRouter();
  const [form, dispatch] = useReducer(createCompanyFormReducer, initialCreateCompanyForm);
  const update = useCallback(
    (patch: Partial<CreateCompanyFormState>) => dispatch({ type: 'SET', patch }),
    []
  );

  const [eikStatus, setEikStatus] = useState<EikStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkEik = async () => {
    const trimmed = form.eik.trim();
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
    form.legalName.trim() &&
    form.eik.trim().length >= 9 &&
    form.city.trim() &&
    form.street.trim() &&
    eikStatus !== 'taken' &&
    eikStatus !== 'checking' &&
    !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    const input: CreateCompanyInput = {
      legalName: form.legalName,
      eik: form.eik,
      vatNumber: form.vatNumber.trim() || null,
      isVatRegistered: form.isVatRegistered,
      country: form.country,
      city: form.city,
      street: form.street,
      postCode: form.postCode.trim() || null,
      mol: form.mol.trim() || null,
      bankName: form.bankName.trim() || null,
      iban: form.iban.trim() || null,
      bicSwift: form.bicSwift.trim() || null,
      defaultCurrency: form.defaultCurrency,
      defaultVatRate: form.defaultVatRate,
      defaultPaymentMethod: form.defaultPaymentMethod,
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
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="text-lg lg:text-2xl font-medium">Create Company</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <IdentityCard
          legalName={form.legalName}
          onLegalNameChange={(v) => update({ legalName: v })}
          eik={form.eik}
          onEikChange={(v) => {
            update({ eik: v });
            setEikStatus('idle');
          }}
          onEikBlur={checkEik}
          eikStatus={eikStatus}
          isVatRegistered={form.isVatRegistered}
          onIsVatRegisteredChange={(reg) =>
            update({
              isVatRegistered: reg,
              ...(!reg && { vatNumber: '' }),
            })
          }
          vatNumber={form.vatNumber}
          onVatNumberChange={(v) => update({ vatNumber: v })}
          mol={form.mol}
          onMolChange={(v) => update({ mol: v })}
        />

        <AddressCard
          street={form.street}
          onStreetChange={(v) => update({ street: v })}
          city={form.city}
          onCityChange={(v) => update({ city: v })}
          postCode={form.postCode}
          onPostCodeChange={(v) => update({ postCode: v })}
          country={form.country}
          onCountryChange={(v) => update({ country: v })}
        />

        <BankDetailsCard
          bankName={form.bankName}
          onBankNameChange={(v) => update({ bankName: v })}
          iban={form.iban}
          onIbanChange={(v) => update({ iban: v })}
          bicSwift={form.bicSwift}
          onBicSwiftChange={(v) => update({ bicSwift: v })}
        />

        <InvoiceDefaultsCard
          defaultCurrency={form.defaultCurrency}
          onDefaultCurrencyChange={(v) => update({ defaultCurrency: v })}
          defaultVatRate={form.defaultVatRate}
          onDefaultVatRateChange={(v) => update({ defaultVatRate: v })}
          defaultPaymentMethod={form.defaultPaymentMethod}
          onDefaultPaymentMethodChange={(v) => update({ defaultPaymentMethod: v })}
        />

        <ErrorAlert message={error} className="mb-6" />

        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-primary hover:bg-primary/90 text-white"
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
