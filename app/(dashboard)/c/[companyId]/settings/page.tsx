'use client';

import { useState, useEffect, useCallback } from 'react';
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
  getCompanyMembersAction,
  transferOwnershipAction,
  deleteCompanyAction,
} from '@/src/features/invoicing/actions';
import { canEditCompanySettings } from '@/lib/auth/permissions';
import { useCompany } from '@/lib/context/company-context';
import type { UpsertCompanyProfileInput } from '@/src/features/invoicing/schemas';
import type { Company } from '@/lib/db/schema';
import {
  Loader2,
  Save,
  Building2,
  CheckCircle,
  ShieldAlert,
  ArrowRightLeft,
  Trash2,
} from 'lucide-react';

const CURRENCIES = ['EUR', 'BGN'];
const PAYMENT_METHODS = [
  { value: 'bank', label: 'Банков път (Bank)' },
  { value: 'cash', label: 'В брой (Cash)' },
  { value: 'barter', label: 'Бартер (Barter)' },
] as const;

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
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<
    'bank' | 'cash' | 'barter'
  >('bank');

  // Danger zone state
  const [members, setMembers] = useState<
    { userId: number; userName: string; userEmail: string; role: string }[]
  >([]);
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
          (p.defaultPaymentMethod as 'bank' | 'cash' | 'barter') ?? 'bank'
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

  const otherMembers = members.filter(
    (m) => m.role !== 'owner'
  );

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

      {/* Identity */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Company identity</CardTitle>
          <CardDescription>
            Legal name and registration numbers
          </CardDescription>
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
                disabled={!!profile}
                className={profile ? 'bg-gray-50 text-gray-500' : ''}
              />
              {profile && (
                <p className="mt-1 text-xs text-muted-foreground">
                  EIK cannot be changed after company creation.
                </p>
              )}
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
          <CardDescription>
            Used when payment method is &quot;bank&quot;
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
          </div>
        </CardContent>
      </Card>

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

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Danger zone</CardTitle>
          <CardDescription>
            Irreversible actions. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-gray-200 p-4">
            <div>
              <p className="text-sm font-medium">Transfer ownership</p>
              <p className="text-xs text-muted-foreground">
                Transfer this company to another member. You will become an
                accountant.
              </p>
            </div>
            <Button variant="outline" onClick={openTransferModal}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Transfer
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50/50 p-4">
            <div>
              <p className="text-sm font-medium text-red-700">
                Delete company
              </p>
              <p className="text-xs text-muted-foreground">
                Soft-deletes this company. All members lose access. You can
                restore it later.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transfer ownership modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Transfer ownership</CardTitle>
              <CardDescription>
                Select a member to become the new owner. You will be demoted to
                accountant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {otherMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No other members to transfer to. Invite someone first.
                </p>
              ) : (
                <div className="space-y-2">
                  {otherMembers.map((m) => (
                    <label
                      key={m.userId}
                      className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer ${
                        transferTargetId === m.userId
                          ? 'border-orange-400 bg-orange-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="transferTarget"
                        checked={transferTargetId === m.userId}
                        onChange={() => setTransferTargetId(m.userId)}
                        className="h-4 w-4"
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {m.userName || m.userEmail}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.userEmail} · {m.role}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowTransferModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  disabled={!transferTargetId || dangerLoading}
                  onClick={handleTransfer}
                >
                  {dangerLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirm transfer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-red-700">Delete company</CardTitle>
              <CardDescription>
                This will remove access for all members. The company can be
                restored later by contacting support.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                Type{' '}
                <span className="font-mono font-medium">
                  {company.legalName}
                </span>{' '}
                to confirm:
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={company.legalName}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={
                    deleteConfirmText !== company.legalName || dangerLoading
                  }
                  onClick={handleDelete}
                >
                  {dangerLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Permanently delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
