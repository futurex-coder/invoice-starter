export type CompanyMetric = {
  companyId: number;
  companyName: string;
  currency: string;
  revenue: number;
  outstanding: number;
  invoiceCountThisMonth: number;
  overdueCount: number;
  role: string;
};

export type Totals = {
  revenue: number;
  outstanding: number;
  invoiceCount: number;
  overdueCount: number;
};

export type ActivityLog = {
  id: number;
  action: string;
  timestamp: Date | null;
  ipAddress: string | null;
  userName: string | null;
  userId: number | null;
  companyId: number;
  companyName: string;
};

export type DeletedCompanyRow = {
  company: {
    id: number;
    legalName: string;
    eik: string;
    deletedAt: Date | null;
  };
  role: string;
};
