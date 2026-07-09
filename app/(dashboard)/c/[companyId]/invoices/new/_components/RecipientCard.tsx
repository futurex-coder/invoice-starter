'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityPicker } from '@/components/forms/entity-picker';
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
        <CardTitle>Получател</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="partner-picker">Изберете контрагент (по желание)</Label>
          <EntityPicker
            id="partner-picker"
            className="mt-1"
            items={partners}
            value={selectedPartnerId === '' ? null : selectedPartnerId}
            onChange={(v) => onPartnerSelect(v ?? '')}
            getKey={(p) => p.id}
            getLabel={(p) => p.name}
            getSecondary={(p) => `ЕИК ${p.eik}`}
            getSearchText={(p) => `${p.name} ${p.eik}`}
            placeholder="— Ръчно въвеждане —"
            clearLabel="— Ръчно въвеждане —"
            emptyMessage="Няма съвпадащи контрагенти"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="recipientName">Наименование *</Label>
            <Input
              id="recipientName"
              value={recipient.name}
              onChange={(e) => onRecipientChange({ name: e.target.value })}
              placeholder="Наименование"
            />
          </div>
          <div>
            <Label htmlFor="recipientEik">ЕИК / ЕГН *</Label>
            <div className="flex gap-2">
              <Input
                id="recipientEik"
                value={recipient.eik}
                onChange={(e) => onRecipientChange({ eik: e.target.value })}
                placeholder="9 или 10 цифри"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                title="Извличане по ЕИК (очаквайте скоро)"
              >
                Извлечи по ЕИК
              </Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="recipientCity">Град *</Label>
            <Input
              id="recipientCity"
              value={recipient.city}
              onChange={(e) => onRecipientChange({ city: e.target.value })}
              placeholder="Град"
            />
          </div>
          <div>
            <Label htmlFor="recipientStreet">Улица *</Label>
            <Input
              id="recipientStreet"
              value={recipient.street}
              onChange={(e) => onRecipientChange({ street: e.target.value })}
              placeholder="Адрес"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="recipientPostCode">Пощенски код</Label>
            <Input
              id="recipientPostCode"
              value={recipient.postCode}
              onChange={(e) => onRecipientChange({ postCode: e.target.value })}
              placeholder="1000"
            />
          </div>
          <div>
            <Label htmlFor="recipientCountry">Държава</Label>
            <Input
              id="recipientCountry"
              value={recipient.country}
              onChange={(e) => onRecipientChange({ country: e.target.value })}
              placeholder="BG"
              maxLength={2}
            />
          </div>
          <div>
            <Label htmlFor="recipientMol">МОЛ</Label>
            <Input
              id="recipientMol"
              value={recipient.mol}
              onChange={(e) => onRecipientChange({ mol: e.target.value })}
              placeholder="Представител"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="recipientVat">ДДС номер (по желание)</Label>
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
