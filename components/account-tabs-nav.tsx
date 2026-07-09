'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

/** MENU-1: General + Security live under one "Account" entry as tabs. */
export function AccountTabsNav() {
  const pathname = usePathname();

  const tabs = [
    { label: 'Общи', href: '/dashboard/general', icon: Settings },
    { label: 'Сигурност', href: '/dashboard/security', icon: Shield },
  ];

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex gap-1" aria-label="Настройки на профила">
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
