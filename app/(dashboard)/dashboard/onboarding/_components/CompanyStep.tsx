'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, ArrowRight } from 'lucide-react';

interface Props {
  legalName: string;
  onLegalNameChange: (value: string) => void;
  eik: string;
  onEikChange: (value: string) => void;
  isVatRegistered: boolean;
  onIsVatRegisteredChange: (value: boolean) => void;
  vatNumber: string;
  onVatNumberChange: (value: string) => void;
  mol: string;
  onMolChange: (value: string) => void;
  street: string;
  onStreetChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  postCode: string;
  onPostCodeChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
  saving: boolean;
  onSave: () => void;
}

export function CompanyStep({
  legalName,
  onLegalNameChange,
  eik,
  onEikChange,
  isVatRegistered,
  onIsVatRegisteredChange,
  vatNumber,
  onVatNumberChange,
  mol,
  onMolChange,
  street,
  onStreetChange,
  city,
  onCityChange,
  postCode,
  onPostCodeChange,
  country,
  onCountryChange,
  saving,
  onSave,
}: Props) {
  return (
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
              onChange={(e) => onLegalNameChange(e.target.value)}
              placeholder="ACME Ltd."
            />
          </div>
          <div>
            <Label htmlFor="ob-eik">ЕИК (EIK / BULSTAT) *</Label>
            <Input
              id="ob-eik"
              value={eik}
              onChange={(e) => onEikChange(e.target.value)}
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
              onValueChange={(v) => onIsVatRegisteredChange(v === 'yes')}
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
                onChange={(e) => onVatNumberChange(e.target.value)}
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
            onChange={(e) => onMolChange(e.target.value)}
            placeholder="Иван Иванов"
          />
        </div>

        <hr className="my-2" />

        <div>
          <Label htmlFor="ob-street">Street *</Label>
          <Input
            id="ob-street"
            value={street}
            onChange={(e) => onStreetChange(e.target.value)}
            placeholder="ул. Граф Игнатиев 1"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="ob-city">City *</Label>
            <Input
              id="ob-city"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="София"
            />
          </div>
          <div>
            <Label htmlFor="ob-postCode">Post code</Label>
            <Input
              id="ob-postCode"
              value={postCode}
              onChange={(e) => onPostCodeChange(e.target.value)}
              placeholder="1000"
            />
          </div>
          <div>
            <Label htmlFor="ob-country">Country code</Label>
            <Input
              id="ob-country"
              value={country}
              onChange={(e) => onCountryChange(e.target.value)}
              placeholder="BG"
              maxLength={2}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={onSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white"
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
  );
}
