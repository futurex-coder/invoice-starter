'use client';

/**
 * KONT-1 — the shared „Меню Контиране" body, matching the Microinvest layout:
 * a two-column header (label : value) over side-by-side Дебит / Кредит grids.
 * Dumb + presentational — it takes a pre-formatted header view-model and the
 * Дт/Кт lines; the owning panel keeps the data fetch, the classification
 * controls (Основание / чл.70 for purchases) and the post/reverse actions.
 */

import type { ReactNode } from 'react';
import type { ContraLine } from '@/src/features/kontirovka/contra';
import { ContraField, LedgerColumn } from './contra-ledger';

export interface KontirovkaHeader {
  /** Контировка N — padded once posted, „(нова)" while a draft. */
  postingNumberLabel: string;
  /** Дата на осчетоводяване — BG date once posted, „—" while a draft. */
  postingDateLabel: string;
  documentType: string;
  documentNumber: string;
  documentDateLabel: string;
  partnerName: string;
  partnerUic: string | null;
  /** „Партньор" for sales; kept as a prop so the label can read the same either way. */
  partnerLabel: string;
  basisLabel: string;
  note: string | null;
  dealTypeLabel: string;
  vatOperationLabel: string;
  viesLabel: string;
  exportMonthLabel: string;
}

export function KontirovkaForm({
  header,
  debitLines,
  creditLines,
  currency,
  totalDebit,
  totalCredit,
  classificationSlot,
}: {
  header: KontirovkaHeader;
  debitLines: ContraLine[];
  creditLines: ContraLine[];
  currency: string;
  totalDebit: number;
  totalCredit: number;
  /** Purchase passes the Основание Select + чл.70 toggle here (renders in the
   *  Основание position, replacing the static field); sales passes nothing. */
  classificationSlot?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-8 rounded-lg border border-sky-100 bg-sky-50/40 p-3 md:grid-cols-2">
        <div>
          <ContraField label="Контировка N">{header.postingNumberLabel}</ContraField>
          <ContraField label="Дата на осчетоводяване">
            {header.postingDateLabel}
          </ContraField>
          <ContraField label="Тип на документа">{header.documentType}</ContraField>
          <ContraField label="Номер на документ">{header.documentNumber}</ContraField>
          <ContraField label="Дата на документа">{header.documentDateLabel}</ContraField>
          <ContraField label={header.partnerLabel}>
            {header.partnerName || '—'}
            {header.partnerUic ? (
              <span className="text-gray-400"> · {header.partnerUic}</span>
            ) : null}
          </ContraField>
        </div>
        <div>
          {classificationSlot ?? (
            <ContraField label="Основание">{header.basisLabel}</ContraField>
          )}
          <ContraField label="Забележка">
            {header.note ? header.note : <span className="text-gray-400">—</span>}
          </ContraField>
          <ContraField label="Тип на сделката">{header.dealTypeLabel}</ContraField>
          <ContraField label="Операция по ДДС">{header.vatOperationLabel}</ContraField>
          <ContraField label="VIES">{header.viesLabel}</ContraField>
          <ContraField label="Месец за експорт">{header.exportMonthLabel}</ContraField>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <LedgerColumn
          title="Дебит"
          lines={debitLines}
          total={totalDebit}
          currency={currency}
          accent="debit"
        />
        <LedgerColumn
          title="Кредит"
          lines={creditLines}
          total={totalCredit}
          currency={currency}
          accent="credit"
        />
      </div>
    </div>
  );
}
