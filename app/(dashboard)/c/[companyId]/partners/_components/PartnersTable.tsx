'use client';

import type { Partner } from '@/lib/db/schema';
import { DataTableHead, DATA_ROW_CLASS } from '@/components/list-page/DataTableHead';
import { RowActionsMenu } from '@/components/list-page/RowActionsMenu';
import { Pencil, Trash2, Link2 } from 'lucide-react';

interface Props {
  partners: Partner[];
  onEdit: (partner: Partner) => void;
  onDelete: (partner: Partner) => void;
}

export function PartnersTable({ partners, onEdit, onDelete }: Props) {
  return (
    <table className="w-full">
      <DataTableHead
        columns={[
          { label: 'Name' },
          { label: 'EIK' },
          { label: 'VAT Number' },
          { label: 'City' },
          { label: 'Country' },
          { label: 'Actions', align: 'right' },
        ]}
      />
      <tbody>
        {partners.map((p) => (
          <tr key={p.id} className={DATA_ROW_CLASS}>
            <td className="px-4 py-3 text-sm font-medium">
              {p.name}
              {p.isIndividual && (
                <span className="ml-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  Individual
                </span>
              )}
              {p.linkedCompanyId && (
                <span
                  className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"
                  title="Linked to a registered company"
                >
                  <Link2 className="h-3 w-3" />
                  Linked
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-sm">{p.eik}</td>
            <td className="px-4 py-3 text-sm">{p.vatNumber ?? '—'}</td>
            <td className="px-4 py-3 text-sm">{p.city}</td>
            <td className="px-4 py-3 text-sm">{p.country}</td>
            <td className="px-4 py-3 text-right">
              <RowActionsMenu
                actions={[
                  { icon: Pencil, label: 'Edit', onClick: () => onEdit(p) },
                  { icon: Trash2, label: 'Delete', onClick: () => onDelete(p), destructive: true },
                ]}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
