'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface Props {
  street: string;
  onStreetChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  postCode: string;
  onPostCodeChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
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
}: Props) {
  return (
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
            onChange={(e) => onStreetChange(e.target.value)}
            placeholder="ул. Граф Игнатиев 1"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="София"
              required
            />
          </div>
          <div>
            <Label htmlFor="postCode">Post code</Label>
            <Input
              id="postCode"
              value={postCode}
              onChange={(e) => onPostCodeChange(e.target.value)}
              placeholder="1000"
            />
          </div>
          <div>
            <Label htmlFor="country">Country code</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => onCountryChange(e.target.value)}
              placeholder="BG"
              maxLength={2}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
