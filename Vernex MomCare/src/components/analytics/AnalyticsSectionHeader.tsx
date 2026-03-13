import type { ReactNode } from 'react';

interface AnalyticsSectionHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function AnalyticsSectionHeader({
  title,
  description,
  action,
}: AnalyticsSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
