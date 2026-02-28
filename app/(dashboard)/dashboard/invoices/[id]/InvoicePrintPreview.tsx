'use client';

import type { Invoice } from '@/lib/db/schema';
import {
  buildPrintModel,
  type PrintModel,
} from '@/src/features/bulgarian-invoicing/formatter';

export interface InvoicePrintPreviewProps {
  invoice: Invoice;
  /** Display name for "Съставил" (e.g. current user or creator) */
  createdByName?: string | null;
}

export function InvoicePrintPreview({ invoice, createdByName }: InvoicePrintPreviewProps) {
  const model: PrintModel = buildPrintModel(
    {
      docType: invoice.docType,
      number: invoice.number,
      issueDate: invoice.issueDate,
      supplyDate: invoice.supplyDate,
      currency: invoice.currency ?? 'EUR',
      fxRate: invoice.fxRate ?? 1,
      supplierSnapshot: invoice.supplierSnapshot,
      recipientSnapshot: invoice.recipientSnapshot,
      items: invoice.items,
      totals: invoice.totals,
      amountInWords: invoice.amountInWords,
      paymentMethod: invoice.paymentMethod,
    },
    { createdByName }
  );

  return (
    <div className="invoice-preview-wrap bg-white text-black text-sm">
      {/* Title block */}
      <div className="invoice-preview-title flex justify-between items-start border-b-2 border-black pb-2 mb-4">
        <h1 className="text-lg font-bold uppercase tracking-wide">
          {model.docTypeTitle}
        </h1>
        <span className="text-sm font-semibold uppercase">{model.originalLabel}</span>
      </div>

      {/* Number and dates */}
      <div className="invoice-preview-meta grid grid-cols-2 gap-x-8 mb-4 text-sm">
        <div>
          <span className="text-gray-600">№:</span> {model.invoiceNumber}
        </div>
        <div>
          <span className="text-gray-600">Дата на издаване:</span> {model.issueDate}
        </div>
        {model.taxEventDate && (
          <div>
            <span className="text-gray-600">Дата на събитие:</span> {model.taxEventDate}
          </div>
        )}
      </div>

      {/* Supplier and Recipient blocks */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="invoice-preview-block border border-gray-300 rounded p-3">
          <h2 className="text-xs font-bold uppercase text-gray-600 mb-2">Доставчик</h2>
          <p className="font-medium">{model.supplier.legalName}</p>
          <p className="whitespace-pre-line text-gray-700">{model.supplier.address}</p>
          <p>ЕИК: {model.supplier.eik}</p>
          {model.supplier.vatNumber && (
            <p>ДДС №: {model.supplier.vatNumber}</p>
          )}
        </div>
        <div className="invoice-preview-block border border-gray-300 rounded p-3">
          <h2 className="text-xs font-bold uppercase text-gray-600 mb-2">Получател</h2>
          <p className="font-medium">{model.recipient.legalName}</p>
          <p className="whitespace-pre-line text-gray-700">{model.recipient.address}</p>
          <p>ЕИК: {model.recipient.eik}</p>
          {model.recipient.vatNumber && (
            <p>ДДС №: {model.recipient.vatNumber}</p>
          )}
        </div>
      </div>

      {/* Items table: №, Артикул, Количество, Ед. цена, Стойност */}
      <table className="w-full border-collapse invoice-preview-table mb-4">
        <thead>
          <tr className="border-b-2 border-black bg-gray-100">
            <th className="text-left py-2 px-2 w-10">№</th>
            <th className="text-left py-2 px-2">Артикул</th>
            <th className="text-right py-2 px-2 w-20">Количество</th>
            <th className="text-right py-2 px-2 w-24">Ед. цена</th>
            <th className="text-right py-2 px-2 w-28">Стойност</th>
          </tr>
        </thead>
        <tbody>
          {model.items.map((row) => (
            <tr key={row.no} className="border-b border-gray-200">
              <td className="py-1.5 px-2">{row.no}</td>
              <td className="py-1.5 px-2">{row.artukul}</td>
              <td className="py-1.5 px-2 text-right">{row.quantity}</td>
              <td className="py-1.5 px-2 text-right">{row.unitPrice}</td>
              <td className="py-1.5 px-2 text-right font-medium">{row.stoimost}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals: Данъчна основа, ДДС %, Начислен ДДС, Сума за плащане */}
      <div className="flex justify-end mb-3">
        <table className="invoice-preview-totals text-sm w-72">
          <tbody>
            <tr>
              <td className="py-1 text-gray-700">Данъчна основа:</td>
              <td className="py-1 text-right">{model.totals.danuchnaOsnova} {model.totals.currency}</td>
            </tr>
            <tr>
              <td className="py-1 text-gray-700">ДДС {model.totals.ddsPercent}</td>
              <td className="py-1 text-right">Начислен ДДС: {model.totals.ddsAmount} {model.totals.currency}</td>
            </tr>
            <tr className="border-t-2 border-black">
              <td className="py-2 font-bold">Сума за плащане:</td>
              <td className="py-2 text-right font-bold">{model.totals.sumaZaPlashtane} {model.totals.currency}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Currency conversion when EUR */}
      {model.currencyConversion && (
        <p className="text-sm text-gray-600 mb-3">
          По курса: {model.currencyConversion.amountEur} EUR × {model.currencyConversion.rate} = {model.currencyConversion.amountBgn} BGN
        </p>
      )}

      {/* Bank details when payment method is bank */}
      {model.bankDetails && model.bankDetails.iban && (
        <div className="invoice-preview-bank border border-gray-300 rounded p-3 mb-3 bg-gray-50">
          <h3 className="text-xs font-bold uppercase text-gray-600 mb-1">Банкови данни</h3>
          {model.bankDetails.bankName && <p>{model.bankDetails.bankName}</p>}
          <p>IBAN: {model.bankDetails.iban}</p>
          {model.bankDetails.bic && <p>BIC: {model.bankDetails.bic}</p>}
        </div>
      )}

      {/* Словом */}
      {model.amountInWords && (
        <p className="mb-3">
          <span className="font-semibold">Словом:</span> {model.amountInWords}
        </p>
      )}

      {/* Начин на плащане */}
      <p className="text-sm mb-2">
        <span className="font-semibold">Начин на плащане:</span> {model.paymentMethodLabel}
      </p>

      {/* Съставил */}
      {model.createdBy && (
        <p className="text-sm">
          <span className="font-semibold">Съставил:</span> {model.createdBy}
        </p>
      )}

      {/* Optional footer */}
      <footer className="invoice-preview-footer mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500">
        <p>Получател: {model.recipient.legalName || '—'}</p>
        <p>Доставчик: {model.supplier.legalName || '—'}</p>
      </footer>
    </div>
  );
}
