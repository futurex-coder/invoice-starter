import { redirect } from 'next/navigation';
import { getUser, verifyCompanyAccess, getCompaniesForUser } from '@/lib/db/queries';
import { CompanyProvider } from '@/lib/context/company-context';
import { CompanyLayoutShell } from './company-layout-shell';

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId: companyIdStr } = await params;
  const companyId = parseInt(companyIdStr, 10);

  if (isNaN(companyId)) {
    redirect('/dashboard');
  }

  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const membership = await verifyCompanyAccess(user.id, companyId);
  if (!membership) {
    redirect('/dashboard');
  }

  const memberships = await getCompaniesForUser(user.id);
  const currentCompany = memberships.find((m) => m.company.id === companyId);

  if (!currentCompany) {
    redirect('/dashboard');
  }

  return (
    <CompanyProvider
      company={currentCompany.company}
      role={currentCompany.role}
      memberships={memberships}
    >
      
      <CompanyLayoutShell>{children}</CompanyLayoutShell>
    </CompanyProvider>
  );
}
