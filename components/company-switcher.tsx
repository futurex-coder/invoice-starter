'use client';

import Link from 'next/link';
import { useCompany } from '@/lib/context/company-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';

function RoleBadge({ role }: { role: string }) {
  const isOwner = role === 'owner';
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${
        isOwner
          ? 'bg-orange-100 text-orange-700'
          : 'bg-gray-100 text-gray-600'
      }`}
    >
      {isOwner ? 'Owner' : 'Accountant'}
    </span>
  );
}

export function CompanySwitcher() {
  const { company, memberships, switchCompany } = useCompany();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between gap-2 px-3 py-2 h-auto text-left"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 shrink-0 text-orange-500" />
            <span className="truncate text-sm font-medium">
              {company.legalName}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Companies</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {memberships.map((m) => {
            const isActive = m.company.id === company.id;
            return (
              <DropdownMenuItem
                key={m.company.id}
                className="flex items-center gap-2 cursor-pointer"
                onSelect={() => {
                  if (!isActive) switchCompany(m.company.id);
                }}
              >
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isActive ? 'text-orange-500' : 'text-transparent'
                  }`}
                />
                <span className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="truncate text-sm">{m.company.legalName}</span>
                </span>
                <RoleBadge role={m.role} />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/create-company" className="flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />
            <span className="text-sm">Create Company</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
