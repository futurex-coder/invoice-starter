'use client';

import { createContext, useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Company, UserCompanyMembership } from '@/lib/db/schema';

interface CompanyContextValue {
  company: Company;
  role: string;
  memberships: UserCompanyMembership[];
  switchCompany: (companyId: number) => void;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

interface CompanyProviderProps {
  company: Company;
  role: string;
  memberships: UserCompanyMembership[];
  children: React.ReactNode;
}

/**
 * Wraps company-scoped pages. Populated by a server layout that calls
 * `getCompaniesForUser` + `verifyCompanyAccess`, then passes the data here.
 */
export function CompanyProvider({
  company,
  role,
  memberships,
  children,
}: CompanyProviderProps) {
  const router = useRouter();

  const switchCompany = useCallback(
    (companyId: number) => {
      document.cookie = `activeCompanyId=${companyId};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
      router.push(`/c/${companyId}/dashboard`);
    },
    [router]
  );

  return (
    <CompanyContext.Provider
      value={{ company, role, memberships, switchCompany }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

/**
 * Access the current company context. Throws if used outside a CompanyProvider
 * (i.e. outside a `/c/[companyId]/...` route).
 */
export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error(
      'useCompany must be used within a CompanyProvider (company-scoped route)'
    );
  }
  return ctx;
}

/**
 * Same as useCompany but returns null instead of throwing when there is no
 * active company context. Useful in shared components that render both inside
 * and outside company routes.
 */
export function useCompanyOptional() {
  return useContext(CompanyContext);
}
