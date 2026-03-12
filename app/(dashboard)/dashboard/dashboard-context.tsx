'use client';

import { createContext, useContext } from 'react';

export interface OnboardingStatus {
  hasCompanyProfile: boolean;
  hasBankDetails: boolean;
  articleCount: number;
  partnerCount: number;
  invoiceCount: number;
  companyName: string;
}

const DashboardContext = createContext<OnboardingStatus | null>(null);

export function DashboardProvider({
  value,
  children,
}: {
  value: OnboardingStatus | null;
  children: React.ReactNode;
}) {
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardStatus() {
  return useContext(DashboardContext);
}
