'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, onSubmit, placeholder, className }: Props) {
  return (
    <div className={cn('flex gap-2', className ?? 'max-w-sm')}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
      />
      <Button variant="outline" onClick={onSubmit} aria-label="Search">
        <Search className="h-4 w-4" />
      </Button>
    </div>
  );
}
