'use client';

import { useState, useEffect, useCallback } from 'react';
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
import type { Company } from '@/lib/db/schema';
import { Loader2, Save, Building2, CheckCircle, ShieldAlert } from 'lucide-react';
import { IdentityCard } from './_components/IdentityCard';
import { AddressCard } from './_components/AddressCard';
import { BankDetailsCard } from './_components/BankDetailsCard';
import { InvoiceDefaultsCard } from './_components/InvoiceDefaultsCard';
import { DangerZoneCard } from './_components/DangerZoneCard';
import { TransferOwnershipModal } from './_components/TransferOwnershipModal';
import { DeleteCompanyModal } from './_components/DeleteCompanyModal';
import type { MemberSummary, PaymentMethod } from './_components/types';

export default function CompanySettingsPage() {
  const router = useRouter();
  const { company, role } = useCompany();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<Company | null>(null);

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
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethod>('bank');

  // Danger zone state
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

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
        setDefaultPaymentMethod(
          (p.defaultPaymentMethod as PaymentMethod) ?? 'bank'
        );
      }
    })();
  }, []);

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
        legalName={legalName}
        onLegalNameChange={setLegalName}
        eik={eik}
        onEikChange={setEik}
        eikLocked={!!profile}
        isVatRegistered={isVatRegistered}
        onIsVatRegisteredChange={(reg) => {
          setIsVatRegistered(reg);
          if (!reg) setVatNumber('');
        }}
        vatNumber={vatNumber}
        onVatNumberChange={setVatNumber}
        mol={mol}
        onMolChange={setMol}
      />

      <AddressCard
        street={street}
        onStreetChange={setStreet}
        city={city}
        onCityChange={setCity}
        postCode={postCode}
        onPostCodeChange={setPostCode}
        country={country}
        onCountryChange={setCountry}
      />

      <BankDetailsCard
        bankName={bankName}
        onBankNameChange={setBankName}
        iban={iban}
        onIbanChange={setIban}
        bicSwift={bicSwift}
        onBicSwiftChange={setBicSwift}
      />

      <InvoiceDefaultsCard
        defaultCurrency={defaultCurrency}
        onDefaultCurrencyChange={setDefaultCurrency}
        defaultVatRate={defaultVatRate}
        onDefaultVatRateChange={setDefaultVatRate}
        defaultPaymentMethod={defaultPaymentMethod}
        onDefaultPaymentMethodChange={setDefaultPaymentMethod}
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
