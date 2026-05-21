'use client';

import { useState, useEffect, useReducer, useCallback } from 'react';
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
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { Loader2, Save, Building2, CheckCircle, ShieldAlert } from 'lucide-react';
import { IdentityCard } from './_components/IdentityCard';
import { AddressCard } from './_components/AddressCard';
import { BankDetailsCard } from './_components/BankDetailsCard';
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
  const [success, setSuccess] = useState<string | null>(null);

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
    setSuccess(null);

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
      return;
    }

    if (res.data) {
      mutateProfile(res.data, { revalidate: false });
      setSuccess('Company profile saved successfully.');
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
      <section className="flex-1 p-4 lg:p-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldAlert className="h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-lg font-medium mb-2">Access denied</h2>
            <p className="text-sm text-muted-foreground">
              Only the company owner can edit company settings.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="flex-1 p-4 lg:p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  const otherMembers = members.filter((m) => m.role !== 'owner');

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-orange-500" />
        <h1 className="text-lg lg:text-2xl font-medium">Company Settings</h1>
      </div>

      {!profile && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          You need to complete your company profile before you can create
          invoices. This data is used as the Supplier (Доставчик) on every
          invoice.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-md bg-green-50 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
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
      />

      <BankDetailsCard
        bankName={form.bankName}
        onBankNameChange={(v) => updateForm({ bankName: v })}
        iban={form.iban}
        onIbanChange={(v) => updateForm({ iban: v })}
        bicSwift={form.bicSwift}
        onBicSwiftChange={(v) => updateForm({ bicSwift: v })}
      />

      <InvoiceDefaultsCard
        defaultCurrency={form.defaultCurrency}
        onDefaultCurrencyChange={(v) => updateForm({ defaultCurrency: v })}
        defaultVatRate={form.defaultVatRate}
        onDefaultVatRateChange={(v) => updateForm({ defaultVatRate: v })}
        defaultPaymentMethod={form.defaultPaymentMethod}
        onDefaultPaymentMethodChange={(v) => updateForm({ defaultPaymentMethod: v })}
      />

      {/* Save button */}
      <div className="flex gap-3 mb-10">
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

      <DangerZoneCard
        onTransferClick={openTransferModal}
        onDeleteClick={() => setShowDeleteConfirm(true)}
      />

      {showTransferModal && (
        <TransferOwnershipModal
          otherMembers={otherMembers}
          selectedMemberId={transferTargetId}
          onSelectMember={setTransferTargetId}
          loading={dangerLoading}
          onCancel={() => setShowTransferModal(false)}
          onConfirm={handleTransfer}
        />
      )}

      {showDeleteConfirm && (
        <DeleteCompanyModal
          companyName={company.legalName}
          confirmText={deleteConfirmText}
          onConfirmTextChange={setDeleteConfirmText}
          loading={dangerLoading}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setDeleteConfirmText('');
          }}
          onConfirm={handleDelete}
        />
      )}
    </section>
  );
}
