'use client';

import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FormField } from '@/components/forms/form-field';
import type { ValidationIssue } from '@/lib/actions/result';

interface Props {
  street: string;
  onStreetChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  postCode: string;
  onPostCodeChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
  validationErrors?: ValidationIssue[] | null;
}

export function AddressCard({
  street,
  onStreetChange,
  city,
  onCityChange,
  postCode,
  onPostCodeChange,
  country,
  onCountryChange,
  validationErrors,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Address</CardTitle>
        <CardDescription>Registered business address</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField name="street" label="Street" required errors={validationErrors}>
          <Input
            value={street}
            onChange={(e) => onStreetChange(e.target.value)}
            placeholder="ул. Граф Игнатиев 1"
            required
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField name="city" label="City" required errors={validationErrors}>
            <Input
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="София"
              required
            />
          </FormField>
          <FormField name="postCode" label="Post code" errors={validationErrors}>
            <Input
              value={postCode}
              onChange={(e) => onPostCodeChange(e.target.value)}
              placeholder="1000"
            />
          </FormField>
          <FormField name="country" label="Country code" errors={validationErrors}>
            <Input
              value={country}
              onChange={(e) => onCountryChange(e.target.value)}
              placeholder="BG"
              maxLength={2}
            />
          </FormField>
        </div>
      </CardContent>
    </Card>
  );
}
