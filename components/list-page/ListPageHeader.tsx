import type { ReactNode } from 'react';

interface Props {
  title: string;
  action?: ReactNode;
}

export function ListPageHeader({ title, action }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <h1 className="text-lg lg:text-2xl font-medium">{title}</h1>
      {action}
    </div>
  );
}
