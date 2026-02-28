/**
 * Validation for Bulgarian invoice documents.
 *
 * Pure functions — no DB access. Returns structured ValidationError[]
 * with machine-readable codes and field paths.
 */

import type {
  DocType,
  InvoiceDocument,
  LineItem,
  PartySnapshot,
  ValidationError,
  ValidationResult,
} from './types';
import { DOC_TYPES, STATUSES, BG_VAT_RATES } from './types';
import {
  isValidUic,
  isValidBgVatNumber,
  isValidInvoiceNumber,
  isValidCurrency,
  isIssueDateWithinLimit,
  isValidVatRate,
  requiresReference,
} from './rules';

// ---------------------------------------------------------------------------
// Error builder
// ---------------------------------------------------------------------------

function err(code: string, field: string, message: string): ValidationError {
  return { code, field, message };
}

// ---------------------------------------------------------------------------
// Sub-validators
// ---------------------------------------------------------------------------

function validateParty(
  party: PartySnapshot | null | undefined,
  prefix: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!party) {
    errors.push(err('REQUIRED', prefix, `${prefix} is required`));
    return errors;
  }
  if (!party.legalName || party.legalName.trim().length === 0) {
    errors.push(
      err('REQUIRED', `${prefix}.legalName`, 'Legal name is required')
    );
  }
  if (!party.address || party.address.trim().length === 0) {
    errors.push(err('REQUIRED', `${prefix}.address`, 'Address is required'));
  }
  if (!party.uic || !isValidUic(party.uic)) {
    errors.push(
      err(
        'INVALID_UIC',
        `${prefix}.uic`,
        'UIC must be 9 or 10 digits (BULSTAT)'
      )
    );
  }
  if (party.vatNumber !== null && party.vatNumber !== undefined) {
    if (!isValidBgVatNumber(party.vatNumber)) {
      errors.push(
        err(
          'INVALID_VAT_NUMBER',
          `${prefix}.vatNumber`,
          'VAT number must match BG + 9-10 digits'
        )
      );
    }
  }
  return errors;
}

function validateLineItem(
  item: LineItem,
  index: number
): ValidationError[] {
  const errors: ValidationError[] = [];
  const p = `items[${index}]`;

  if (!item.description || item.description.trim().length === 0) {
    errors.push(err('REQUIRED', `${p}.description`, 'Description is required'));
  }
  if (typeof item.quantity !== 'number' || item.quantity <= 0) {
    errors.push(
      err('INVALID_QUANTITY', `${p}.quantity`, 'Quantity must be > 0')
    );
  }
  if (!item.unit || item.unit.trim().length === 0) {
    errors.push(err('REQUIRED', `${p}.unit`, 'Unit is required'));
  }
  if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
    errors.push(
      err(
        'INVALID_UNIT_PRICE',
        `${p}.unitPrice`,
        'Unit price must be >= 0'
      )
    );
  }
  if (!isValidVatRate(item.vatRate)) {
    errors.push(
      err(
        'INVALID_VAT_RATE',
        `${p}.vatRate`,
        `VAT rate must be one of: ${BG_VAT_RATES.join(', ')}`
      )
    );
  }
  const dp = item.discountPercent ?? 0;
  if (dp < 0 || dp > 100) {
    errors.push(
      err(
        'INVALID_DISCOUNT',
        `${p}.discountPercent`,
        'Discount must be between 0 and 100'
      )
    );
  }
  return errors;
}

function validateDates(doc: InvoiceDocument): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!doc.issueDate) {
    errors.push(err('REQUIRED', 'issueDate', 'Issue date is required'));
    return errors;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.issueDate)) {
    errors.push(
      err('INVALID_DATE', 'issueDate', 'Issue date must be YYYY-MM-DD')
    );
  }

  if (doc.supplyDate && !/^\d{4}-\d{2}-\d{2}$/.test(doc.supplyDate)) {
    errors.push(
      err('INVALID_DATE', 'supplyDate', 'Supply date must be YYYY-MM-DD')
    );
  }

  if (doc.status === 'issued') {
    if (!isIssueDateWithinLimit(doc.issueDate, doc.supplyDate)) {
      errors.push(
        err(
          'ISSUE_DATE_TOO_LATE',
          'issueDate',
          'Invoice must be issued within 5 days of supply date'
        )
      );
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

/**
 * Validate a full invoice document. Returns all errors found.
 */
export function validateInvoice(doc: InvoiceDocument): ValidationResult {
  const errors: ValidationError[] = [];

  // docType
  if (!DOC_TYPES.includes(doc.docType)) {
    errors.push(
      err(
        'INVALID_DOC_TYPE',
        'docType',
        `Document type must be one of: ${DOC_TYPES.join(', ')}`
      )
    );
  }

  // status
  if (!STATUSES.includes(doc.status)) {
    errors.push(
      err(
        'INVALID_STATUS',
        'status',
        `Status must be one of: ${STATUSES.join(', ')}`
      )
    );
  }

  // number (required when issued)
  if (doc.status === 'issued') {
    if (doc.number === null || doc.number === undefined) {
      errors.push(
        err(
          'REQUIRED',
          'number',
          'Invoice number is required for issued documents'
        )
      );
    } else if (!isValidInvoiceNumber(doc.number)) {
      errors.push(
        err(
          'INVALID_NUMBER',
          'number',
          'Invoice number must be an integer between 1 and 9999999999'
        )
      );
    }
  }

  // series
  if (!doc.series || doc.series.trim().length === 0) {
    errors.push(err('REQUIRED', 'series', 'Series is required'));
  }

  // currency
  if (!isValidCurrency(doc.currency)) {
    errors.push(
      err('INVALID_CURRENCY', 'currency', 'Currency must be a 3-letter ISO code')
    );
  }

  // fxRate
  if (typeof doc.fxRate !== 'number' || doc.fxRate <= 0) {
    errors.push(
      err('INVALID_FX_RATE', 'fxRate', 'FX rate must be a positive number')
    );
  }

  // referenced invoice (required for credit/debit notes)
  if (requiresReference(doc.docType as DocType) && !doc.referencedInvoiceNumber) {
    errors.push(
      err(
        'REFERENCE_REQUIRED',
        'referencedInvoiceNumber',
        `${doc.docType} must reference an original invoice`
      )
    );
  }

  // dates
  errors.push(...validateDates(doc));

  // parties
  errors.push(...validateParty(doc.supplier, 'supplier'));
  errors.push(...validateParty(doc.recipient, 'recipient'));

  // items
  if (!doc.items || doc.items.length === 0) {
    errors.push(
      err('REQUIRED', 'items', 'At least one line item is required')
    );
  } else {
    for (let i = 0; i < doc.items.length; i++) {
      errors.push(...validateLineItem(doc.items[i], i));
    }
  }

  // totals cross-check (only if items exist and there are no item-level errors)
  if (
    doc.items?.length > 0 &&
    errors.filter((e) => e.field.startsWith('items[')).length === 0
  ) {
    const expectedNet = doc.items.reduce((s, it) => s + it.netAmount, 0);
    const expectedVat = doc.items.reduce((s, it) => s + it.vatAmount, 0);
    const roundedNet = Number(expectedNet.toFixed(2));
    const roundedVat = Number(expectedVat.toFixed(2));

    if (Math.abs(doc.totals.totalNet - roundedNet) > 0.01) {
      errors.push(
        err(
          'TOTALS_MISMATCH',
          'totals.totalNet',
          `totalNet (${doc.totals.totalNet}) does not match sum of line netAmounts (${roundedNet})`
        )
      );
    }
    if (Math.abs(doc.totals.totalVat - roundedVat) > 0.01) {
      errors.push(
        err(
          'TOTALS_MISMATCH',
          'totals.totalVat',
          `totalVat (${doc.totals.totalVat}) does not match sum of line vatAmounts (${roundedVat})`
        )
      );
    }
    const expectedGross = Number((roundedNet + roundedVat).toFixed(2));
    if (Math.abs(doc.totals.totalGross - expectedGross) > 0.01) {
      errors.push(
        err(
          'TOTALS_MISMATCH',
          'totals.totalGross',
          `totalGross (${doc.totals.totalGross}) does not match totalNet + totalVat (${expectedGross})`
        )
      );
    }
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
}
