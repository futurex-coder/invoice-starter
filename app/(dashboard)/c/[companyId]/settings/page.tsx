'use client';

import { useState, useEffect, useReducer, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getCompanyProfile,
  upsertCompanyProfile,
  getCompanyMembersAction,
  transferOwnershipAction,
  deleteCompanyAction,
} from '@/src/features/invoicing/actions';
import { canEditCompanySettings } from '@/lib/auth/permissions';
import { useCompany } from '@/lib/context/company-context';
import type { UpsertCompanyProfileInput } from '@/src/features/invoicing/schemas';
import type { ValidationIssue } from '@/lib/actions/result';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { Loader2, Save, Building2, ShieldAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { IdentityCard } from './_components/IdentityCard';
import { AddressCard } from '@/components/company-form/AddressCard';
import { BankDetailsCard } from '@/components/company-form/BankDetailsCard';
import { InvoiceDefaultsCard } from './_components/InvoiceDefaultsCard';
import { DangerZoneCard } from './_components/DangerZoneCard';
import { TransferOwnershipModal } from './_components/TransferOwnershipModal';
import { DeleteCompanyModal } from './_components/DeleteCompanyModal';
import type { MemberSummary } from './_components/types';
import {
  initialSettingsForm,
  profileToFormState,
  settingsFormReducer,
} from './_components/form-state';
import { PageShell } from '@/components/page-shell';

export default function CompanySettingsPage() {
  const router = useRouter();
  const { company, role } = useCompany();

  const {
    data: profile,
    isLoading: loading,
    mutate: mutateProfile,
  } = useActionSWR('companyProfile', getCompanyProfile);

  const [form, dispatch] = useReducer(settingsFormReducer, initialSettingsForm);
  const updateForm = useCallback(
    (patch: Partial<typeof form>) => dispatch({ type: 'SET', patch }),
    []
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    ValidationIssue[] | null
  >(null);

  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    dispatch({ type: 'HYDRATE', state: profileToFormState(profile) });
  }, [profile]);

  const loadMembers = useCallback(async () => {
    const res = await getCompanyMembersAction();
    if (res.data) {
      setMembers(
        res.data.members.map((m) => ({
          userId: m.user.id,
          userName: m.user.name ?? '',
          userEmail: m.user.email,
          role: m.role,
        }))
      );
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setValidationErrors(null);

    const input: UpsertCompanyProfileInput = {
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

    const res = await upsertCompanyProfile(input);
    setSaving(false);

    if (res.error) {
      setError(res.error);
      if (res.validationErrors && res.validationErrors.length > 0) {
        setValidationErrors(res.validationErrors);
      }
      return;
    }

    if (res.data) {
      mutateProfile(res.data, { revalidate: false });
      toast.success('Профилът на фирмата е запазен успешно.');
    }
  };

  const openTransferModal = async () => {
    await loadMembers();
    setTransferTargetId(null);
    setShowTransferModal(true);
  };

  const handleTransfer = async () => {
    if (!transferTargetId) return;
    setDangerLoading(true);
    setError(null);
    const res = await transferOwnershipAction(transferTargetId);
    setDangerLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setShowTransferModal(false);
    router.push(`/c/${company.id}/dashboard`);
  };

  const handleDelete = async () => {
    setDangerLoading(true);
    setError(null);
    const res = await deleteCompanyAction();
    setDangerLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push('/dashboard');
  };

  if (!canEditCompanySettings(role)) {
    return (
      <PageShell>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldAlert className="h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-lg font-medium mb-2">Достъпът е отказан</h2>
            <p className="text-sm text-muted-foreground">
              Само собственикът на фирмата може да редактира настройките на
              фирмата.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </PageShell>
    );
  }

  const otherMembers = members.filter((m) => m.role !== 'owner');

  return (
    <PageShell>
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="text-lg lg:text-2xl font-medium">Настройки на фирмата</h1>
      </div>

      {!profile && (
        <Alert variant="warning" className="mb-6">
          Трябва да попълните профила на фирмата, преди да можете да създавате
          фактури. Тези данни се използват като Доставчик във всяка фактура.
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}
      <IdentityCard
        legalName={form.legalName}
        onLegalNameChange={(v) => updateForm({ legalName: v })}
        eik={form.eik}
        onEikChange={(v) => updateForm({ eik: v })}
        eikLocked={!!profile}
        isVatRegistered={form.isVatRegistered}
        onIsVatRegisteredChange={(reg) =>
          updateForm({ isVatRegistered: reg, ...(!reg && { vatNumber: '' }) })
        }
        vatNumber={form.vatNumber}
        onVatNumberChange={(v) => updateForm({ vatNumber: v })}
        mol={form.mol}
        onMolChange={(v) => updateForm({ mol: v })}
        validationErrors={validationErrors}
      />

      <AddressCard
        street={form.street}
        onStreetChange={(v) => updateForm({ street: v })}
        city={form.city}
        onCityChange={(v) => updateForm({ city: v })}
        postCode={form.postCode}
        onPostCodeChange={(v) => updateForm({ postCode: v })}
        country={form.country}
        onCountryChange={(v) => updateForm({ country: v })}
        validationErrors={validationErrors}
      />

      <BankDetailsCard
        bankName={form.bankName}
        onBankNameChange={(v) => updateForm({ bankName: v })}
        iban={form.iban}
        onIbanChange={(v) => updateForm({ iban: v })}
        bicSwift={form.bicSwift}
        onBicSwiftChange={(v) => updateForm({ bicSwift: v })}
        validationErrors={validationErrors}
      />

      <InvoiceDefaultsCard
        defaultCurrency={form.defaultCurrency}
        onDefaultCurrencyChange={(v) => updateForm({ defaultCurrency: v })}
        defaultVatRate={form.defaultVatRate}
        onDefaultVatRateChange={(v) => updateForm({ defaultVatRate: v })}
        defaultPaymentMethod={form.defaultPaymentMethod}
        onDefaultPaymentMethodChange={(v) => updateForm({ defaultPaymentMethod: v })}
        validationErrors={validationErrors}
      />

      {/* Save button */}
      <div className="flex gap-3 mb-10">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-white"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Запазване…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Запази профила на фирмата
            </>
          )}
        </Button>
      </div>

      <DangerZoneCard
        onTransferClick={openTransferModal}
        onDeleteClick={() => setShowDeleteConfirm(true)}
      />

      <TransferOwnershipModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        otherMembers={otherMembers}
        selectedMemberId={transferTargetId}
        onSelectMember={setTransferTargetId}
        loading={dangerLoading}
        onConfirm={handleTransfer}
      />

      <DeleteCompanyModal
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          setShowDeleteConfirm(open);
          if (!open) setDeleteConfirmText('');
        }}
        companyName={company.legalName}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        loading={dangerLoading}
        onConfirm={handleDelete}
      />
    </PageShell>
  );
}
