import { CompanyRole } from '@/lib/db/schema';

export function canManageMembers(role: string): boolean {
  return role === CompanyRole.OWNER;
}

export function canInviteMembers(role: string): boolean {
  return role === CompanyRole.OWNER || role === CompanyRole.ACCOUNTANT;
}

export function canRemoveMembers(role: string): boolean {
  return role === CompanyRole.OWNER;
}

export function canEditCompanySettings(role: string): boolean {
  return role === CompanyRole.OWNER;
}

export function canDeleteCompany(role: string): boolean {
  return role === CompanyRole.OWNER;
}

export function canTransferOwnership(role: string): boolean {
  return role === CompanyRole.OWNER;
}

export function canManageInvoices(role: string): boolean {
  return true;
}
