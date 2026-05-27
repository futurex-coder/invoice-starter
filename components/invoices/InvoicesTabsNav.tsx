import Link from 'next/link';
import { FileText, Inbox } from 'lucide-react';

type Tab = 'outgoing' | 'received';

interface Props {
  companyId: string;
  active: Tab;
  pendingReceivedCount?: number;
}

export function InvoicesTabsNav({ companyId, active, pendingReceivedCount }: Props) {
  const tabs: { id: Tab; label: string; href: string; icon: typeof FileText; badge?: number }[] = [
    {
      id: 'outgoing',
      label: 'Outgoing',
      href: `/c/${companyId}/invoices`,
      icon: FileText,
    },
    {
      id: 'received',
      label: 'Received',
      href: `/c/${companyId}/received-invoices`,
      icon: Inbox,
      badge: pendingReceivedCount && pendingReceivedCount > 0 ? pendingReceivedCount : undefined,
    },
  ];

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="flex gap-1 -mb-px" aria-label="Invoice views">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-primary text-primary/90'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={`ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
