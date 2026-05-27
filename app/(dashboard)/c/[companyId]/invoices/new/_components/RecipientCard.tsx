'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Partner } from '@/lib/db/schema';
import type { RecipientForm } from './types';

interface Props {
  partners: Partner[];
  selectedPartnerId: number | '';
  recipient: RecipientForm;
  onPartnerSelect: (id: number | '') => void;
  onRecipientChange: (patch: Partial<RecipientForm>) => void;
}

export function RecipientCard({
  partners,
  selectedPartnerId,
  recipient,
  onPartnerSelect,
  onRecipientChange,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Получател (Recipient)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Select partner (optional)</Label>
          <Select
            value={selectedPartnerId === '' ? '__manual__' : String(selectedPartnerId)}
            onValueChange={(v) =>
              onPartnerSelect(v === '__manual__' ? '' : Number(v))
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__manual__">— Manual entry —</SelectItem>
              {partners.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name} ({p.eik})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="recipientName">Name *</Label>
            <Input
              id="recipientName"
              value={recipient.name}
              onChange={(e) => onRecipientChange({ name: e.target.value })}
              placeholder="Legal name"
            />
          </div>
          <div>
            <Label htmlFor="recipientEik">EIK / EGN *</Label>
            <div className="flex gap-2">
              <Input
                id="recipientEik"
                value={recipient.eik}
                onChange={(e) => onRecipientChange({ eik: e.target.value })}
                placeholder="9 or 10 digits"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                title="Fetch by EIK (coming soon)"
              >
                Fetch by EIK
              </Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="recipientCity">City *</Label>
            <Input
              id="recipientCity"
              value={recipient.city}
              onChange={(e) => onRecipientChange({ city: e.target.value })}
              placeholder="City"
            />
          </div>
          <div>
            <Label htmlFor="recipientStreet">Street *</Label>
            <Input
              id="recipientStreet"
              value={recipient.street}
              onChange={(e) => onRecipientChange({ street: e.target.value })}
              placeholder="Street address"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="recipientPostCode">Post code</Label>
            <Input
              id="recipientPostCode"
              value={recipient.postCode}
              onChange={(e) => onRecipientChange({ postCode: e.target.value })}
              placeholder="1000"
            />
          </div>
          <div>
            <Label htmlFor="recipientCountry">Country</Label>
            <Input
              id="recipientCountry"
              value={recipient.country}
              onChange={(e) => onRecipientChange({ country: e.target.value })}
              placeholder="BG"
              maxLength={2}
            />
          </div>
          <div>
            <Label htmlFor="recipientMol">MOL</Label>
            <Input
              id="recipientMol"
              value={recipient.mol}
              onChange={(e) => onRecipientChange({ mol: e.target.value })}
              placeholder="Representative"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="recipientVat">VAT number (optional)</Label>
          <Input
            id="recipientVat"
            value={recipient.vatNumber}
            onChange={(e) => onRecipientChange({ vatNumber: e.target.value })}
            placeholder="BG123456789"
          />
        </div>
      </CardContent>
    </Card>
  );
}
