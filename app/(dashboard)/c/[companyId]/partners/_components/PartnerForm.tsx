'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Company } from '@/lib/db/schema';
import { X, Loader2, Link2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/forms/form-field';
import type { ValidationIssue } from '@/lib/actions/result';

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
  validationErrors?: ValidationIssue[] | null;
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
  validationErrors,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{isEditing ? 'Edit partner' : 'New partner'}</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Close form"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkedCompany && (
          <Alert variant="info" icon={Link2}>
            This partner is a registered company in the system. Fields pre-filled from their profile.
          </Alert>
        )}
        {selfEikError && (
          <Alert variant="error">
            You cannot add yourself as a partner.
          </Alert>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField name="name" label="Name" required errors={validationErrors}>
            <Input
              value={form.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
              placeholder="Legal name"
            />
          </FormField>
          <FormField name="eik" label="EIK" errors={validationErrors}>
            <div className="relative">
              <Input
                value={form.eik}
                onChange={(e) => onEikChange(e.target.value)}
                placeholder="9 or 10 digits"
                className={selfEikError ? 'border-red-400' : ''}
              />
              {eikLooking && (
                <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField name="city" label="City" errors={validationErrors}>
            <Input
              value={form.city}
              onChange={(e) => onFormChange({ city: e.target.value })}
              placeholder="City"
            />
          </FormField>
          <FormField name="street" label="Street" errors={validationErrors}>
            <Input
              value={form.street}
              onChange={(e) => onFormChange({ street: e.target.value })}
              placeholder="Street address"
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField name="postCode" label="Post code" errors={validationErrors}>
            <Input
              value={form.postCode}
              onChange={(e) => onFormChange({ postCode: e.target.value })}
              placeholder="1000"
            />
          </FormField>
          <FormField name="country" label="Country" errors={validationErrors}>
            <Input
              value={form.country}
              onChange={(e) => onFormChange({ country: e.target.value })}
              placeholder="BG"
              maxLength={2}
            />
          </FormField>
          <FormField
            name="vatNumber"
            label="VAT number"
            errors={validationErrors}
            hint="Format: BG followed by 9 or 10 digits"
          >
            <Input
              value={form.vatNumber}
              onChange={(e) => onFormChange({ vatNumber: e.target.value })}
              placeholder="BG123456789"
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField name="mol" label="MOL" errors={validationErrors}>
            <Input
              value={form.mol}
              onChange={(e) => onFormChange({ mol: e.target.value })}
              placeholder="Representative"
            />
          </FormField>
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
