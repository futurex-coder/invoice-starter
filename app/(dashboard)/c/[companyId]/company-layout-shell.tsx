'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/lib/context/company-context';
import { CompanySwitcher } from '@/components/company-switcher';
import {
  FileText,
  Handshake,
  Package,
  Building2,
  Activity,
  Menu,
  LayoutDashboard,
  Settings,
  Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function CompanyLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { company } = useCompany();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const base = `/c/${company.id}`;

  // MENU-1: consolidated nav — Received lives under the Invoices tabs,
  // Members under Company (settings tabs), General/Security under one
  // Account entry (tabs on the page).
  const companyNav = [
    { href: `${base}/dashboard`, icon: LayoutDashboard, label: 'Dashboard' },
    { href: `${base}/invoices`, icon: FileText, label: 'Invoices' },
    { href: `${base}/vat`, icon: Calculator, label: 'ДДС / VAT' },
    { href: `${base}/partners`, icon: Handshake, label: 'Partners' },
    { href: `${base}/articles`, icon: Package, label: 'Articles' },
    { href: `${base}/settings`, icon: Building2, label: 'Company' },
    { href: `${base}/activity`, icon: Activity, label: 'Activity' },
  ];

  const userNav = [
    { href: '/dashboard/general', icon: Settings, label: 'Account' },
  ];

  // Highlight the entry whose path prefix matches (so /invoices/all,
  // /settings/members, /received-invoices/* still light up their section).
  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === `${base}/invoices` &&
      pathname.startsWith(`${base}/received-invoices`));

  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] max-w-7xl mx-auto w-full">
      {/* Mobile top bar (drawer trigger) */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <div className="flex items-center">
          <span className="font-medium">{company.legalName}</span>
        </div>
        <Button
          className="-mr-3"
          variant="ghost"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      {/* MENU-1: desktop horizontal nav */}
      <div className="hidden lg:flex items-center gap-1 border-b border-gray-200 bg-white px-4">
        <div className="mr-3 py-2">
          <CompanySwitcher />
        </div>
        {companyNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'border-primary text-primary/90'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
        <div className="ml-auto">
          {userNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'border-primary text-primary/90'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden h-full">
        {/* Mobile drawer (unchanged pattern) */}
        <aside
          className={cn(
            'w-64 bg-white border-r border-gray-200 lg:hidden',
            isSidebarOpen ? 'block' : 'hidden',
            'absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out',
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <nav className="h-full overflow-y-auto p-4">
            <div className="mb-3 pb-3 border-b border-gray-200">
              <CompanySwitcher />
            </div>

            {companyNav.map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button
                  variant={isActive(item.href) ? 'secondary' : 'ghost'}
                  className={cn(
                    'shadow-none my-1 w-full justify-start',
                    isActive(item.href) && 'bg-gray-100'
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}

            <div className="my-3 border-t border-gray-200" />

            {userNav.map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button
                  variant={isActive(item.href) ? 'secondary' : 'ghost'}
                  className={cn(
                    'shadow-none my-1 w-full justify-start',
                    isActive(item.href) && 'bg-gray-100'
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-0 lg:p-4">{children}</main>
      </div>
    </div>
  );
}
