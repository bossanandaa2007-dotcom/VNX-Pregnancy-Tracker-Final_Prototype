import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type {
  AnalyticsSummaryItem,
  AnalyticsUiState,
  RecentValue,
  SelectedTracker,
  TrackerHistoryPoint,
} from '@/types/analytics';
import { cn } from '@/lib/utils';

export interface TrackerDetailItem {
  label: string;
  value: string;
}

interface TrackerDetailPanelProps {
  selectedTracker: SelectedTracker;
  summary: AnalyticsSummaryItem;
  icon: LucideIcon;
  iconClassName: string;
  chartColor: string;
  currentValueLabel: string;
  currentValueDisplay: string;
  uiState: AnalyticsUiState;
  closeControl?: ReactNode;
  recentValues: RecentValue[];
  history: TrackerHistoryPoint[];
  statusLabel: string;
  statusMessage: string;
  detailItems: TrackerDetailItem[];
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Not available yet';
  }

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export function TrackerDetailPanel({
  selectedTracker,
  summary,
  icon: Icon,
  iconClassName,
  chartColor,
  currentValueLabel,
  currentValueDisplay,
  uiState,
  closeControl,
  recentValues,
  history,
  statusLabel,
  statusMessage,
  detailItems,
}: TrackerDetailPanelProps) {
  return (
    <Card className="overflow-hidden border-0 bg-transparent shadow-none sm:border sm:bg-card sm:shadow-sm">
      <CardHeader className="sticky top-0 z-20 gap-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-accent/40 p-4">
              <Icon className={cn('h-6 w-6', iconClassName)} />
            </div>
            <div className="space-y-1">
              <CardTitle>{selectedTracker.title}</CardTitle>
              <CardDescription>{selectedTracker.description}</CardDescription>
              <p className="text-2xl font-semibold leading-none sm:text-3xl">
                {currentValueDisplay}
              </p>
            </div>
          </div>
          {closeControl}
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{currentValueLabel}</span>
          <span>&bull;</span>
          <span>{statusLabel}</span>
          {summary.lastUpdatedAt ? (
            <>
              <span>&bull;</span>
              <span>Updated {formatDateTime(summary.lastUpdatedAt)}</span>
            </>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-6">
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Main Graph</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64 sm:h-72">
              {uiState === 'loading' ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-background/70 p-6 text-center">
                  <div className="space-y-2">
                    <p className="font-medium">Loading tracker data</p>
                    <p className="text-sm text-muted-foreground">{statusMessage}</p>
                  </div>
                </div>
              ) : history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="recordedAt"
                      tickFormatter={(value: string) =>
                        new Date(value).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value: string) => formatDateTime(value)}
                      formatter={(value: number) => [
                        `${value.toLocaleString()} ${selectedTracker.unit}`,
                        selectedTracker.title,
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={chartColor}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-background/70 p-6 text-center">
                  <div className="space-y-2">
                    <p className="font-medium">No data available yet</p>
                    <p className="text-sm text-muted-foreground">
                      Your graph will appear after syncing starts.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Values</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {uiState === 'loading' ? (
                <div className="rounded-xl border border-dashed border-border bg-accent/20 p-4 text-sm text-muted-foreground">
                  Loading recent values...
                </div>
              ) : recentValues.length > 0 ? (
                recentValues.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-accent/20 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(entry.recordedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {entry.value.toLocaleString()} {entry.unit}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-accent/20 p-4 text-sm text-muted-foreground">
                  Recent values will appear here once readings are available.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tracker Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="rounded-xl bg-accent/20 p-3">
                <p className="text-sm font-medium">{statusLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">{statusMessage}</p>
              </div>

              {detailItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-dashed p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
