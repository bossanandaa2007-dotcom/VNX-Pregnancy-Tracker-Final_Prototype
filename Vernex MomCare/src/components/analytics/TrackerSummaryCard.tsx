import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TrackerSummaryCardProps {
  title: string;
  latestValue: string;
  unit: string;
  lastUpdated: string;
  status: string;
  stateMessage: string;
  icon: LucideIcon;
  iconClassName: string;
  isSelected: boolean;
  onSelect: () => void;
}

export function TrackerSummaryCard({
  title,
  latestValue,
  unit,
  lastUpdated,
  status,
  stateMessage,
  icon: Icon,
  iconClassName,
  isSelected,
  onSelect,
}: TrackerSummaryCardProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onSelect}
      className="w-full text-left"
    >
      <Card
        className={cn(
          'h-full transition-colors hover:bg-accent/20 focus-within:ring-2 focus-within:ring-ring',
          isSelected && 'border-primary/50 bg-accent/20 ring-1 ring-primary/20 shadow-sm',
        )}
      >
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-accent/40 p-3">
                <Icon className={cn('h-5 w-5', iconClassName)} />
              </div>
              <div className="space-y-1">
                <p className="font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">
                  {isSelected ? 'Selected tracker' : 'Latest value'}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {isSelected ? <Badge variant="secondary">Selected</Badge> : null}
              <Badge variant="outline">{status}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-semibold">{latestValue}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {unit}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">{lastUpdated}</p>
            <p className="text-xs text-muted-foreground">{stateMessage}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
