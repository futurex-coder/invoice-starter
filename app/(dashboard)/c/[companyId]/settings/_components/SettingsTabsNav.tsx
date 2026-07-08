'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Building2, Users } from 'lucide-react';
import { requireStringParam } from '@/lib/route-params';
import { cn } from '@/lib/utils';

/** MENU-1: Company + Members live under one "Company" menu entry as tabs. */
export function SettingsTabsNav() {
  const params = useParams();
  const pathname = usePathname();
  const companyId = requireStringParam(params, 'companyId');
  const base = `/c/${companyId}/settings`;

  const tabs = [
    { label: 'Company', href: base, icon: Building2 },
    { label: 'Members', href: `${base}/members`, icon: Users },
  ];

  return (
    <div className="mb-6 border-b border-gray-200 px-4 pt-4 lg:px-0 lg:pt-0">
      <nav className="-mb-px flex gap-1" aria-label="Company settings">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-primary/90'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
