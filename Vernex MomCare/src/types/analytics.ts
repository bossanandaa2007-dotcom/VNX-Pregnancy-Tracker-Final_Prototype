export type AnalyticsTrackerId =
  | 'steps'
  | 'calories'
  | 'heartRate'
  | 'spo2'
  | 'sleep'
  | 'waterIntake'
  | 'weight';

export type AnalyticsSeverity = 'mild' | 'moderate' | 'severe';
export type AnalyticsUiState =
  | 'loading'
  | 'no-data'
  | 'manual'
  | 'sync-ready'
  | 'synced'
  | 'disconnected'
  | 'unavailable';
export type AnalyticsValueSource = 'manual' | 'device' | 'integration';

export interface AnalyticsSummaryItem {
  trackerId: AnalyticsTrackerId;
  title: string;
  unit: string;
  currentValue: number | null;
  targetValue: number | null;
  lastUpdatedAt: string | null;
  uiState: AnalyticsUiState;
}

export interface AnalyticsSummary {
  trackers: Record<AnalyticsTrackerId, AnalyticsSummaryItem>;
  lastUpdatedAt: string | null;
}

export interface SelectedTracker {
  trackerId: AnalyticsTrackerId;
  title: string;
  unit: string;
  description: string;
  supportsManualEntry: boolean;
}

export interface TrackerHistoryPoint {
  id: string;
  recordedAt: string;
  value: number;
  source: AnalyticsValueSource;
  note?: string;
}

export type TrackerHistoryState = Record<AnalyticsTrackerId, TrackerHistoryPoint[]>;

export interface RecentValue {
  id: string;
  label: string;
  value: number;
  unit: string;
  recordedAt: string;
}

export type RecentValuesState = Record<AnalyticsTrackerId, RecentValue[]>;

export interface SymptomRecord {
  id: string;
  recordedAt: string;
  symptoms: string[];
  severity: AnalyticsSeverity;
}

export interface WaterLog {
  id: string;
  recordedAt: string;
  amountMl: number;
  source: AnalyticsValueSource;
  note?: string;
}

export interface WeightHistoryEntry {
  id: string;
  recordedAt: string;
  valueKg: number;
  source: AnalyticsValueSource;
  note?: string;
}

export interface SyncStatus {
  state: AnalyticsUiState;
  lastSyncedAt: string | null;
  source: string | null;
  message: string | null;
}
