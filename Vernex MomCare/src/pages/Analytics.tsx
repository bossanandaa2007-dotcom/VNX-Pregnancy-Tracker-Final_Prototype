import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Droplets,
  Flame,
  Footprints,
  Heart,
  Info,
  Moon,
  Plus,
  Scale,
  X,
  type LucideIcon,
} from 'lucide-react';

import { AnalyticsSectionHeader } from '@/components/analytics/AnalyticsSectionHeader';
import {
  TrackerDetailPanel,
  type TrackerDetailItem,
} from '@/components/analytics/TrackerDetailPanel';
import { TrackerSummaryCard } from '@/components/analytics/TrackerSummaryCard';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type {
  AnalyticsSeverity,
  AnalyticsSummary,
  AnalyticsSummaryItem,
  AnalyticsTrackerId,
  AnalyticsUiState,
  RecentValue,
  RecentValuesState,
  SelectedTracker,
  SymptomRecord,
  SyncStatus,
  TrackerHistoryPoint,
  TrackerHistoryState,
} from '@/types/analytics';

type TrackerDefinition = SelectedTracker & {
  icon: LucideIcon;
  iconClassName: string;
  chartColor: string;
  emptyStateCopy: string;
  backendMetric: 'steps' | 'calories' | 'heartrate' | 'spo2' | 'sleep' | 'water' | 'weight';
};

interface TrackerApiEntry {
  _id?: string;
  value: number;
  recordedAt: string;
  source?: string;
  note?: string;
  duration?: number;
}

const trackerOrder: AnalyticsTrackerId[] = [
  'steps',
  'calories',
  'heartRate',
  'spo2',
  'sleep',
  'waterIntake',
  'weight',
];

const commonSymptoms = [
  'Nausea',
  'Headache',
  'Back pain',
  'Dizziness',
  'Fatigue',
  'Vomiting',
  'Swelling',
  'Leg cramps',
  'Heartburn',
  'Insomnia',
] as const;

const trackerDefinitions: Record<AnalyticsTrackerId, TrackerDefinition> = {
  steps: {
    trackerId: 'steps',
    title: 'Steps',
    unit: 'steps',
    description: 'Movement history and synced activity totals.',
    supportsManualEntry: false,
    icon: Footprints,
    iconClassName: 'text-success',
    chartColor: '#22c55e',
    emptyStateCopy: 'Connect a device or sync source to populate daily step history.',
    backendMetric: 'steps',
  },
  calories: {
    trackerId: 'calories',
    title: 'Calories',
    unit: 'kcal',
    description: 'Nutrition totals once food logging or sync is available.',
    supportsManualEntry: false,
    icon: Flame,
    iconClassName: 'text-warning',
    chartColor: '#f97316',
    emptyStateCopy: 'Calorie readings will appear once meal or nutrition data is available.',
    backendMetric: 'calories',
  },
  heartRate: {
    trackerId: 'heartRate',
    title: 'Heart Rate',
    unit: 'bpm',
    description: 'Heart rate trends from wearable or clinical sync.',
    supportsManualEntry: false,
    icon: Heart,
    iconClassName: 'text-destructive',
    chartColor: '#ef4444',
    emptyStateCopy: 'Heart rate history is empty until a sensor or backend feed is connected.',
    backendMetric: 'heartrate',
  },
  spo2: {
    trackerId: 'spo2',
    title: 'SpO2',
    unit: '%',
    description: 'Blood oxygen readings from supported sources.',
    supportsManualEntry: false,
    icon: Activity,
    iconClassName: 'text-info',
    chartColor: '#3b82f6',
    emptyStateCopy: 'SpO2 measurements will show here when synced from a supported source.',
    backendMetric: 'spo2',
  },
  sleep: {
    trackerId: 'sleep',
    title: 'Sleep',
    unit: 'hrs',
    description: 'Sleep duration and rest history ready for sync.',
    supportsManualEntry: false,
    icon: Moon,
    iconClassName: 'text-primary',
    chartColor: '#8b5cf6',
    emptyStateCopy: 'Sleep history will appear here after nightly tracking is connected.',
    backendMetric: 'sleep',
  },
  waterIntake: {
    trackerId: 'waterIntake',
    title: 'Water Intake',
    unit: 'ml',
    description: 'Hydration logs can be added manually and persisted.',
    supportsManualEntry: true,
    icon: Droplets,
    iconClassName: 'text-primary',
    chartColor: '#0ea5e9',
    emptyStateCopy: 'Add hydration entries to start building water intake history.',
    backendMetric: 'water',
  },
  weight: {
    trackerId: 'weight',
    title: 'Weight',
    unit: 'kg',
    description: 'Weight history can be added manually and persisted.',
    supportsManualEntry: true,
    icon: Scale,
    iconClassName: 'text-primary',
    chartColor: '#f472b6',
    emptyStateCopy: 'Add weight entries to build a longitudinal weight history.',
    backendMetric: 'weight',
  },
};

const summaryKeyMap: Record<AnalyticsTrackerId, string> = {
  steps: 'steps',
  calories: 'calories',
  heartRate: 'heartRate',
  spo2: 'spo2',
  sleep: 'sleep',
  waterIntake: 'water',
  weight: 'weight',
};

const createEmptyTrackerHistory = (): TrackerHistoryState =>
  trackerOrder.reduce((state, trackerId) => {
    state[trackerId] = [];
    return state;
  }, {} as TrackerHistoryState);

const createEmptyRecentValues = (): RecentValuesState =>
  trackerOrder.reduce((state, trackerId) => {
    state[trackerId] = [];
    return state;
  }, {} as RecentValuesState);

const createInitialSummaryItem = (trackerId: AnalyticsTrackerId): AnalyticsSummaryItem => ({
  trackerId,
  title: trackerDefinitions[trackerId].title,
  unit: trackerDefinitions[trackerId].unit,
  currentValue: null,
  targetValue: null,
  lastUpdatedAt: null,
  uiState: trackerDefinitions[trackerId].supportsManualEntry ? 'no-data' : 'sync-ready',
});

const createInitialAnalyticsSummary = (): AnalyticsSummary => ({
  trackers: trackerOrder.reduce((state, trackerId) => {
    state[trackerId] = createInitialSummaryItem(trackerId);
    return state;
  }, {} as AnalyticsSummary['trackers']),
  lastUpdatedAt: null,
});

const createSelectedTracker = (trackerId: AnalyticsTrackerId): SelectedTracker => {
  const tracker = trackerDefinitions[trackerId];
  return {
    trackerId: tracker.trackerId,
    title: tracker.title,
    unit: tracker.unit,
    description: tracker.description,
    supportsManualEntry: tracker.supportsManualEntry,
  };
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'No data available yet';
  }

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const buildRecentValues = (
  entries: TrackerHistoryPoint[],
  unit: string,
): RecentValue[] =>
  [...entries]
    .slice(-3)
    .reverse()
    .map((entry) => ({
      id: entry.id,
      label: formatDateTime(entry.recordedAt),
      value: entry.value,
      unit,
      recordedAt: entry.recordedAt,
    }));

const createLocalId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getUiStateLabel = (state: AnalyticsUiState) => {
  switch (state) {
    case 'loading':
      return 'Loading';
    case 'manual':
      return 'Manual';
    case 'sync-ready':
      return 'Sync ready';
    case 'synced':
      return 'Synced';
    case 'disconnected':
      return 'Disconnected';
    case 'unavailable':
      return 'Unavailable';
    case 'no-data':
    default:
      return 'No data';
  }
};

const getUiStateVariant = (state: AnalyticsUiState) => {
  switch (state) {
    case 'loading':
    case 'manual':
    case 'sync-ready':
    case 'synced':
      return 'secondary' as const;
    case 'disconnected':
    case 'unavailable':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
};

const getUiStateMessage = (state: AnalyticsUiState) => {
  switch (state) {
    case 'loading':
      return 'Tracker data is preparing for display.';
    case 'manual':
      return 'This tracker is updated from saved entries.';
    case 'sync-ready':
      return 'This tracker is ready to connect to a device or backend source.';
    case 'synced':
      return 'This tracker is receiving synced or persisted readings.';
    case 'disconnected':
      return 'Reconnect the source to resume incoming readings.';
    case 'unavailable':
      return 'This tracker is temporarily unavailable.';
    case 'no-data':
    default:
      return 'No readings have been recorded yet.';
  }
};

const getSeverityClassName = (severity: AnalyticsSeverity) => {
  switch (severity) {
    case 'moderate':
      return 'text-warning';
    case 'severe':
      return 'text-destructive';
    default:
      return 'text-success';
  }
};

const mapHistoryEntries = (
  trackerId: AnalyticsTrackerId,
  entries: TrackerApiEntry[],
): TrackerHistoryPoint[] =>
  entries.map((entry, index) => ({
    id: entry._id || `${trackerId}-${index}-${entry.recordedAt}`,
    recordedAt: entry.recordedAt,
    value:
      trackerId === 'sleep' && typeof entry.duration === 'number'
        ? entry.duration
        : entry.value,
    source: entry.source === 'manual' ? 'manual' : 'integration',
    note: entry.note,
  }));

export default function Analytics() {
  const { user } = useAuth();
  const { patientId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const isDoctor = user?.role === 'doctor';
  const isDoctorView = isDoctor && !!patientId;
  const targetPatientId = isDoctorView ? patientId ?? '' : user?.id ?? '';

  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [isTrackerDetailOpen, setIsTrackerDetailOpen] = useState(false);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary>(
    () => createInitialAnalyticsSummary(),
  );
  const [selectedTracker, setSelectedTracker] = useState<SelectedTracker | null>(null);
  const [trackerHistory, setTrackerHistory] = useState<TrackerHistoryState>(() =>
    createEmptyTrackerHistory(),
  );
  const [recentValues, setRecentValues] = useState<RecentValuesState>(() =>
    createEmptyRecentValues(),
  );
  const [symptoms, setSymptoms] = useState<SymptomRecord[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'sync-ready',
    lastSyncedAt: null,
    source: null,
    message: 'Analytics is ready for device sync or backend integration.',
  });

  const [openSymptomModal, setOpenSymptomModal] = useState(false);
  const [symptomForm, setSymptomForm] = useState({
    recordedAt: '',
    symptom: '',
    severity: 'mild' as AnalyticsSeverity,
  });
  const [waterForm, setWaterForm] = useState({
    amountMl: '',
    recordedAt: '',
    note: '',
  });
  const [weightForm, setWeightForm] = useState({
    valueKg: '',
    recordedAt: '',
    note: '',
  });

  const selectedTrackerDefinition = selectedTracker
    ? trackerDefinitions[selectedTracker.trackerId]
    : null;
  const SelectedTrackerIcon = selectedTrackerDefinition?.icon ?? Footprints;
  const selectedTrackerSummary = selectedTracker
    ? analyticsSummary.trackers[selectedTracker.trackerId]
    : null;
  const selectedTrackerHistory = selectedTracker
    ? trackerHistory[selectedTracker.trackerId]
    : [];
  const selectedTrackerRecentValues = selectedTracker
    ? recentValues[selectedTracker.trackerId]
    : [];

  const normalizedSymptomInput = symptomForm.symptom.trim().toLowerCase();
  const filteredSymptomSuggestions = useMemo(
    () =>
      commonSymptoms.filter((symptom) =>
        symptom.toLowerCase().includes(normalizedSymptomInput),
      ),
    [normalizedSymptomInput],
  );
  const exactSymptomMatch = commonSymptoms.some(
    (symptom) => symptom.toLowerCase() === normalizedSymptomInput,
  );

  const setTrackerState = (
    trackerId: AnalyticsTrackerId,
    entries: TrackerHistoryPoint[],
    summaryValue: number | null,
    uiState: AnalyticsUiState,
  ) => {
    const latest = entries[entries.length - 1]?.recordedAt ?? null;
    setTrackerHistory((prev) => ({
      ...prev,
      [trackerId]: entries,
    }));
    setRecentValues((prev) => ({
      ...prev,
      [trackerId]: buildRecentValues(entries, trackerDefinitions[trackerId].unit),
    }));
    setAnalyticsSummary((prev) => ({
      trackers: {
        ...prev.trackers,
        [trackerId]: {
          ...prev.trackers[trackerId],
          currentValue: summaryValue,
          lastUpdatedAt: latest,
          uiState,
        },
      },
      lastUpdatedAt: latest ?? prev.lastUpdatedAt,
    }));
  };

  const loadDevices = async (patientTargetId: string) => {
    const response = await fetch(`${API_BASE}/api/device/${patientTargetId}`);
    const devices = await response.json();

    if (!response.ok) {
      throw new Error(devices?.message || 'Failed to load device connections');
    }

    if (Array.isArray(devices) && devices.length > 0) {
      setSyncStatus({
        state: 'synced',
        lastSyncedAt: devices[0]?.lastSync ?? null,
        source:
          devices
            .map((device: { sourceApp?: string }) => device.sourceApp)
            .filter(Boolean)
            .join(', ') || 'Connected device',
        message: 'Connected device sources are available for syncing tracker data.',
      });
      return;
    }

    setSyncStatus({
      state: 'sync-ready',
      lastSyncedAt: null,
      source: null,
      message: 'Analytics is ready for device sync or backend integration.',
    });
  };

  const loadAnalytics = async () => {
    if (!targetPatientId) {
      return;
    }

    setIsAnalyticsLoading(true);
    setAnalyticsError(null);
    setAnalyticsSummary(createInitialAnalyticsSummary());
    setTrackerHistory(createEmptyTrackerHistory());
    setRecentValues(createEmptyRecentValues());

    try {
      const summaryResponse = await fetch(
        `${API_BASE}/api/analytics/summary/${targetPatientId}`,
      );
      const summaryPayload = await summaryResponse.json();

      if (!summaryResponse.ok) {
        throw new Error(summaryPayload?.message || 'Failed to load analytics summary');
      }

      await Promise.all(
        trackerOrder.map(async (trackerId) => {
          const definition = trackerDefinitions[trackerId];
          const historyResponse = await fetch(
            `${API_BASE}/api/analytics/history/${definition.backendMetric}/${targetPatientId}`,
          );
          const historyPayload = await historyResponse.json();

          if (!historyResponse.ok) {
            throw new Error(historyPayload?.message || `Failed to load ${definition.title}`);
          }

          const entries = mapHistoryEntries(
            trackerId,
            Array.isArray(historyPayload) ? historyPayload : [],
          );
          const summaryValue = summaryPayload?.[summaryKeyMap[trackerId]] ?? null;
          const nextUiState: AnalyticsUiState =
            entries.length > 0
              ? 'synced'
              : definition.supportsManualEntry
                ? 'no-data'
                : 'sync-ready';

          setTrackerState(trackerId, entries, summaryValue, nextUiState);
        }),
      );

      await loadDevices(targetPatientId);
    } catch (error) {
      console.error('Analytics load error:', error);
      setAnalyticsError(
        error instanceof Error ? error.message : 'Failed to load analytics data.',
      );
      setSyncStatus({
        state: 'unavailable',
        lastSyncedAt: null,
        source: null,
        message: 'Analytics data is temporarily unavailable.',
      });
      setAnalyticsSummary((prev) => ({
        trackers: trackerOrder.reduce((state, trackerId) => {
          state[trackerId] = {
            ...prev.trackers[trackerId],
            uiState: 'unavailable',
          };
          return state;
        }, {} as AnalyticsSummary['trackers']),
        lastUpdatedAt: prev.lastUpdatedAt,
      }));
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, [targetPatientId]);

  const getTrackerLatestValue = (trackerId: AnalyticsTrackerId) => {
    const summary = analyticsSummary.trackers[trackerId];

    if (isAnalyticsLoading) {
      return 'Loading...';
    }

    if (summary.currentValue === null) {
      return summary.uiState === 'sync-ready' ? 'Waiting for sync' : 'No data';
    }

    return summary.currentValue.toLocaleString();
  };

  const getTrackerLastUpdated = (trackerId: AnalyticsTrackerId) => {
    const summary = analyticsSummary.trackers[trackerId];
    if (isAnalyticsLoading) {
      return 'Preparing tracker state';
    }

    return summary.lastUpdatedAt
      ? `Updated ${formatDateTime(summary.lastUpdatedAt)}`
      : getUiStateMessage(summary.uiState);
  };

  const getTrackerValueDisplay = (trackerId: AnalyticsTrackerId) => {
    const summary = analyticsSummary.trackers[trackerId];
    if (isAnalyticsLoading) {
      return 'Loading...';
    }
    if (summary.currentValue === null) {
      switch (summary.uiState) {
        case 'sync-ready':
          return 'Waiting for sync';
        case 'disconnected':
          return 'Disconnected';
        case 'unavailable':
          return 'Unavailable';
        default:
          return 'No data available yet';
      }
    }

    return `${summary.currentValue.toLocaleString()} ${summary.unit}`;
  };

  const getSelectedTrackerValueLabel = (trackerId: AnalyticsTrackerId) => {
    switch (trackerId) {
      case 'steps':
        return 'Latest steps total';
      case 'calories':
        return 'Latest calorie total';
      case 'heartRate':
        return 'Latest heart rate';
      case 'spo2':
        return 'Latest SpO2 reading';
      case 'sleep':
        return 'Latest sleep duration';
      case 'waterIntake':
        return 'Latest water intake';
      case 'weight':
        return 'Latest weight entry';
      default:
        return 'Latest value';
    }
  };

  const getTrackerDetailItems = (trackerId: AnalyticsTrackerId): TrackerDetailItem[] => [
    {
      label: 'Status',
      value: getUiStateLabel(analyticsSummary.trackers[trackerId].uiState),
    },
    {
      label: 'Last synced',
      value: syncStatus.lastSyncedAt ? formatDateTime(syncStatus.lastSyncedAt) : 'Not synced yet',
    },
    {
      label: 'Source',
      value: syncStatus.source ?? 'No source connected',
    },
  ];

  const handleSelectTracker = (trackerId: AnalyticsTrackerId) => {
    setSelectedTracker(createSelectedTracker(trackerId));
    setIsTrackerDetailOpen(true);
  };

  const handleTrackerDetailOpenChange = (open: boolean) => {
    setIsTrackerDetailOpen(open);
    if (!open) {
      setSelectedTracker(null);
    }
  };

  const saveTrackerEntry = async (
    trackerId: AnalyticsTrackerId,
    payload: Record<string, unknown>,
  ) => {
    const definition = trackerDefinitions[trackerId];
    const response = await fetch(`${API_BASE}/api/trackers/${definition.backendMetric}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responsePayload = await response.json();
    if (!response.ok) {
      throw new Error(responsePayload?.message || `Failed to save ${definition.title}`);
    }
    await loadAnalytics();
  };

  const handleAddWaterLog = async () => {
    if (isDoctorView || !targetPatientId) return;

    const amountMl = Number(waterForm.amountMl);
    if (!Number.isFinite(amountMl) || amountMl <= 0) return;

    try {
      await saveTrackerEntry('waterIntake', {
        patientId: targetPatientId,
        value: amountMl,
        unit: 'ml',
        source: 'manual',
        device: 'manual-entry',
        recordedAt: waterForm.recordedAt
          ? new Date(waterForm.recordedAt).toISOString()
          : new Date().toISOString(),
      });
      setWaterForm({
        amountMl: '',
        recordedAt: '',
        note: '',
      });
    } catch (error) {
      setAnalyticsError(error instanceof Error ? error.message : 'Failed to save water log.');
    }
  };

  const handleAddWeightEntry = async () => {
    if (isDoctorView || !targetPatientId) return;

    const valueKg = Number(weightForm.valueKg);
    if (!Number.isFinite(valueKg) || valueKg <= 0) return;

    try {
      await saveTrackerEntry('weight', {
        patientId: targetPatientId,
        value: valueKg,
        unit: 'kg',
        source: 'manual',
        device: 'manual-entry',
        recordedAt: weightForm.recordedAt
          ? new Date(weightForm.recordedAt).toISOString()
          : new Date().toISOString(),
      });
      setWeightForm({
        valueKg: '',
        recordedAt: '',
        note: '',
      });
    } catch (error) {
      setAnalyticsError(error instanceof Error ? error.message : 'Failed to save weight entry.');
    }
  };

  const handleAddSymptom = () => {
    if (isDoctorView || !symptomForm.symptom.trim()) {
      return;
    }

    const recordedAt = symptomForm.recordedAt
      ? new Date(symptomForm.recordedAt).toISOString()
      : new Date().toISOString();

    setSymptoms((prev) => [
      {
        id: createLocalId('symptom'),
        recordedAt,
        symptoms: [symptomForm.symptom.trim()],
        severity: symptomForm.severity,
      },
      ...prev,
    ]);

    setSymptomForm({
      recordedAt: '',
      symptom: '',
      severity: 'mild',
    });
    setOpenSymptomModal(false);
  };

  const trackerDetailCloseControl = isMobile ? (
    <DrawerClose asChild>
      <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Close tracker details">
        <X className="h-4 w-4" />
      </Button>
    </DrawerClose>
  ) : (
    <DialogClose asChild>
      <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Close tracker details">
        <X className="h-4 w-4" />
      </Button>
    </DialogClose>
  );

  const trackerDetailContent =
    selectedTracker && selectedTrackerDefinition && selectedTrackerSummary ? (
      <div className="space-y-4">
        <TrackerDetailPanel
          selectedTracker={selectedTracker}
          summary={selectedTrackerSummary}
          recentValues={selectedTrackerRecentValues}
          history={selectedTrackerHistory}
          icon={SelectedTrackerIcon}
          iconClassName={selectedTrackerDefinition.iconClassName}
          chartColor={selectedTrackerDefinition.chartColor}
          currentValueLabel={getSelectedTrackerValueLabel(selectedTracker.trackerId)}
          currentValueDisplay={getTrackerValueDisplay(selectedTracker.trackerId)}
          uiState={isAnalyticsLoading ? 'loading' : selectedTrackerSummary.uiState}
          closeControl={trackerDetailCloseControl}
          statusLabel={getUiStateLabel(selectedTrackerSummary.uiState)}
          statusMessage={
            analyticsError && selectedTrackerHistory.length === 0
              ? analyticsError
              : getUiStateMessage(selectedTrackerSummary.uiState)
          }
          detailItems={getTrackerDetailItems(selectedTracker.trackerId)}
        />

        {selectedTracker.trackerId === 'waterIntake' && !isDoctorView && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Add Water Log</CardTitle>
              <CardDescription>
                Save hydration manually while device sync is optional.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="water-amount">Amount (ml)</Label>
                <Input
                  id="water-amount"
                  type="number"
                  min="1"
                  placeholder="Enter water intake"
                  value={waterForm.amountMl}
                  onChange={(event) =>
                    setWaterForm((prev) => ({
                      ...prev,
                      amountMl: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="water-recorded-at">Recorded At (optional)</Label>
                <Input
                  id="water-recorded-at"
                  type="datetime-local"
                  value={waterForm.recordedAt}
                  onChange={(event) =>
                    setWaterForm((prev) => ({
                      ...prev,
                      recordedAt: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="water-note">Note (optional)</Label>
                <Input
                  id="water-note"
                  placeholder="Add context for this entry"
                  value={waterForm.note}
                  onChange={(event) =>
                    setWaterForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                />
              </div>
              <Button className="w-full md:col-span-3" onClick={() => void handleAddWaterLog()}>
                Save Water Log
              </Button>
            </CardContent>
          </Card>
        )}

        {selectedTracker.trackerId === 'weight' && !isDoctorView && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Add Weight Entry</CardTitle>
              <CardDescription>
                Save weight manually while keeping future sync compatibility.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="weight-value">Weight (kg)</Label>
                <Input
                  id="weight-value"
                  type="number"
                  min="1"
                  step="0.1"
                  placeholder="Enter weight"
                  value={weightForm.valueKg}
                  onChange={(event) =>
                    setWeightForm((prev) => ({
                      ...prev,
                      valueKg: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="weight-recorded-at">Recorded At (optional)</Label>
                <Input
                  id="weight-recorded-at"
                  type="datetime-local"
                  value={weightForm.recordedAt}
                  onChange={(event) =>
                    setWeightForm((prev) => ({
                      ...prev,
                      recordedAt: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="weight-note">Note (optional)</Label>
                <Input
                  id="weight-note"
                  placeholder="Add context for this entry"
                  value={weightForm.note}
                  onChange={(event) =>
                    setWeightForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                />
              </div>
              <Button className="w-full md:col-span-3" onClick={() => void handleAddWeightEntry()}>
                Save Weight Entry
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    ) : null;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {isDoctorView && (
          <Button
            variant="ghost"
            className="flex items-center gap-2"
            onClick={() => navigate('/doctor/analytics')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Patient List
          </Button>
        )}

        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Health Analytics</h1>
          <p className="text-muted-foreground">
            {isDoctorView
              ? 'Read-only view of patient health metrics'
              : 'Track your pregnancy health journey'}
          </p>
        </div>

        <div className="flex gap-3 rounded-xl border border-info/20 bg-info/10 p-4">
          <Info className="h-5 w-5 text-info" />
          <div>
            <p className="text-sm font-medium">Informational only</p>
            <p className="text-xs text-muted-foreground">
              These metrics are for awareness only and do not replace medical advice.
            </p>
          </div>
        </div>

        {analyticsError ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {analyticsError}
          </div>
        ) : null}

        <section className="space-y-4">
          <AnalyticsSectionHeader
            title="Tracker Cards"
            description="Select a tracker to view its detail panel, current state, and latest readings."
            action={
              <Badge variant={getUiStateVariant(syncStatus.state)}>
                {getUiStateLabel(syncStatus.state)}
              </Badge>
            }
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {trackerOrder.map((trackerId) => {
              const tracker = trackerDefinitions[trackerId];
              const summary = analyticsSummary.trackers[trackerId];

              return (
                <TrackerSummaryCard
                  key={trackerId}
                  title={tracker.title}
                  latestValue={getTrackerLatestValue(trackerId)}
                  unit={tracker.unit}
                  lastUpdated={getTrackerLastUpdated(trackerId)}
                  status={getUiStateLabel(isAnalyticsLoading ? 'loading' : summary.uiState)}
                  stateMessage={
                    analyticsError && trackerHistory[trackerId].length === 0
                      ? analyticsError
                      : getUiStateMessage(summary.uiState)
                  }
                  icon={tracker.icon}
                  iconClassName={tracker.iconClassName}
                  isSelected={selectedTracker?.trackerId === trackerId}
                  onSelect={() => handleSelectTracker(trackerId)}
                />
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <AnalyticsSectionHeader
            title="Symptoms"
            description="Capture symptom notes with severity and quick suggestions while keeping doctor views read-only."
            action={
              !isDoctorView ? (
                <Button size="sm" className="gap-2" onClick={() => setOpenSymptomModal(true)}>
                  <Plus className="h-4 w-4" />
                  Add Symptom
                </Button>
              ) : (
                <Badge variant="outline">Read only</Badge>
              )
            }
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">Recent Symptoms</CardTitle>
                <CardDescription>
                  Symptom entries appear here as they are recorded.
                </CardDescription>
              </div>
              <Badge variant="outline">
                {symptoms.length} {symptoms.length === 1 ? 'entry' : 'entries'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {symptoms.length > 0 ? (
                symptoms.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-3 rounded-xl bg-accent/30 p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(entry.recordedAt)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {entry.symptoms.map((symptom) => (
                          <span
                            key={symptom}
                            className="rounded-full bg-background px-3 py-1 text-xs"
                          >
                            {symptom}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium capitalize',
                        getSeverityClassName(entry.severity),
                      )}
                    >
                      {entry.severity}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-accent/20 p-6 text-center">
                  <p className="font-medium">No symptoms logged yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add the first symptom entry to start building this timeline.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {isMobile ? (
          <Drawer open={isTrackerDetailOpen} onOpenChange={handleTrackerDetailOpenChange}>
            <DrawerContent className="inset-0 mt-0 h-[100dvh] max-h-[100dvh] w-screen rounded-none border-0 [&>div:first-child]:hidden">
              <DrawerHeader className="sr-only">
                <DrawerTitle>
                  {selectedTracker ? `${selectedTracker.title} Details` : 'Tracker Details'}
                </DrawerTitle>
              </DrawerHeader>
              <div className="h-full overflow-y-auto bg-background p-0">{trackerDetailContent}</div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={isTrackerDetailOpen} onOpenChange={handleTrackerDetailOpenChange}>
            <DialogContent className="h-[88vh] max-h-[88vh] max-w-5xl overflow-hidden p-0">
              <DialogHeader className="sr-only">
                <DialogTitle>
                  {selectedTracker ? `${selectedTracker.title} Details` : 'Tracker Details'}
                </DialogTitle>
              </DialogHeader>
              <div className="h-full overflow-y-auto p-6">{trackerDetailContent}</div>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={openSymptomModal} onOpenChange={setOpenSymptomModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Symptom</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="symptom-recorded-at">Recorded At</Label>
                <Input
                  id="symptom-recorded-at"
                  type="datetime-local"
                  value={symptomForm.recordedAt}
                  onChange={(event) =>
                    setSymptomForm((prev) => ({
                      ...prev,
                      recordedAt: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="symptom-name">Symptom</Label>
                <Input
                  id="symptom-name"
                  placeholder="Search or enter a symptom"
                  value={symptomForm.symptom}
                  onChange={(event) =>
                    setSymptomForm((prev) => ({
                      ...prev,
                      symptom: event.target.value,
                    }))
                  }
                />
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Suggestions
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {normalizedSymptomInput
                        ? 'Choose a match or keep typing a custom symptom'
                        : 'Start typing to filter common symptoms'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(normalizedSymptomInput
                      ? filteredSymptomSuggestions
                      : commonSymptoms.slice(0, 5)
                    ).map((symptom) => (
                      <Button
                        key={symptom}
                        type="button"
                        variant={
                          symptomForm.symptom.trim().toLowerCase() === symptom.toLowerCase()
                            ? 'default'
                            : 'outline'
                        }
                        className="h-auto rounded-full px-3 py-1.5 text-xs"
                        onClick={() =>
                          setSymptomForm((prev) => ({
                            ...prev,
                            symptom,
                          }))
                        }
                      >
                        {symptom}
                      </Button>
                    ))}
                  </div>
                  {normalizedSymptomInput && filteredSymptomSuggestions.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border bg-accent/20 p-3 text-sm text-muted-foreground">
                      No common symptom match found. You can save
                      <span className="mx-1 font-medium text-foreground">
                        {symptomForm.symptom.trim()}
                      </span>
                      as a custom symptom.
                    </div>
                  )}
                  {normalizedSymptomInput &&
                    filteredSymptomSuggestions.length > 0 &&
                    !exactSymptomMatch && (
                      <div className="rounded-xl border border-dashed border-border bg-accent/20 p-3 text-sm text-muted-foreground">
                        You can also save
                        <span className="mx-1 font-medium text-foreground">
                          {symptomForm.symptom.trim()}
                        </span>
                        as a custom symptom.
                      </div>
                    )}
                </div>
              </div>

              <div>
                <Label>Severity</Label>
                <div className="flex gap-2">
                  {(['mild', 'moderate', 'severe'] as AnalyticsSeverity[]).map((severity) => (
                    <Button
                      key={severity}
                      type="button"
                      variant={symptomForm.severity === severity ? 'default' : 'outline'}
                      onClick={() =>
                        setSymptomForm((prev) => ({
                          ...prev,
                          severity,
                        }))
                      }
                      className="capitalize"
                    >
                      {severity}
                    </Button>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={handleAddSymptom}>
                Save Symptom
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
