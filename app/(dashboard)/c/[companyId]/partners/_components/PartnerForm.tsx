'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Company } from '@/lib/db/schema';
import { X, Loader2, Link2 } from 'lucide-react';

export interface PartnerForm {
  name: string;
  eik: string;
  vatNumber: string;
  isIndividual: boolean;
  country: string;
  city: string;
  street: string;
  postCode: string;
  mol: string;
  linkedCompanyId: number | null;
}

export const emptyPartnerForm: PartnerForm = {
  name: '',
  eik: '',
  vatNumber: '',
  isIndividual: false,
  country: 'BG',
  city: '',
  street: '',
  postCode: '',
  mol: '',
  linkedCompanyId: null,
};

interface Props {
  isEditing: boolean;
  form: PartnerForm;
  onFormChange: (patch: Partial<PartnerForm>) => void;
  onEikChange: (value: string) => void;
  eikLooking: boolean;
  linkedCompany: Company | null;
  selfEikError: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function PartnerFormCard({
  isEditing,
  form,
  onFormChange,
  onEikChange,
  eikLooking,
  linkedCompany,
  selfEikError,
  saving,
  onSave,
  onCancel,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{isEditing ? 'Edit partner' : 'New partner'}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkedCompany && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <Link2 className="inline h-4 w-4 mr-1 -mt-0.5" />
            This partner is a registered company in the system. Fields pre-filled from their profile.
          </div>
        )}
        {selfEikError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            You cannot add yourself as a partner.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pName">Name *</Label>
            <Input
              id="pName"
              value={form.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
              placeholder="Legal name"
            />
          </div>
          <div>
            <Label htmlFor="pEik">EIK *</Label>
            <div className="relative">
              <Input
                id="pEik"
                value={form.eik}
                onChange={(e) => onEikChange(e.target.value)}
                placeholder="9 or 10 digits"
                className={selfEikError ? 'border-red-400' : ''}
              />
              {eikLooking && (
                <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pCity">City *</Label>
            <Input
              id="pCity"
              value={form.city}
              onChange={(e) => onFormChange({ city: e.target.value })}
              placeholder="City"
            />
          </div>
          <div>
            <Label htmlFor="pStreet">Street *</Label>
            <Input
              id="pStreet"
              value={form.street}
              onChange={(e) => onFormChange({ street: e.target.value })}
              placeholder="Street address"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="pPostCode">Post code</Label>
            <Input
              id="pPostCode"
              value={form.postCode}
              onChange={(e) => onFormChange({ postCode: e.target.value })}
              placeholder="1000"
            />
          </div>
          <div>
            <Label htmlFor="pCountry">Country</Label>
            <Input
              id="pCountry"
              value={form.country}
              onChange={(e) => onFormChange({ country: e.target.value })}
              placeholder="BG"
              maxLength={2}
            />
          </div>
          <div>
            <Label htmlFor="pVat">VAT number</Label>
            <Input
              id="pVat"
              value={form.vatNumber}
              onChange={(e) => onFormChange({ vatNumber: e.target.value })}
              placeholder="BG123456789"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pMol">MOL</Label>
            <Input
              id="pMol"
              value={form.mol}
              onChange={(e) => onFormChange({ mol: e.target.value })}
              placeholder="Representative"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer h-9">
              <input
                type="checkbox"
                checked={form.isIndividual}
                onChange={(e) => onFormChange({ isIndividual: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">Individual person (EGN)</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={onSave} disabled={saving || selfEikError}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Update' : 'Create'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
