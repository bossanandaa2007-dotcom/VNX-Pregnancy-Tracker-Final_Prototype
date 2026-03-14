import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Baby,
  Bell,
  Calendar,
  ChevronDown,
  Heart,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API_BASE } from "@/config/api";
import {
  createReminder,
  deleteReminder,
  fetchPatientReminders,
  getLocalDateKey,
  normalizeReminder,
  updateReminder,
  updateReminderStatus,
} from '@/lib/reminders';
import type { HealthReminder } from '@/types/reminder';
import {
  fetchResources,
  refreshNotifications,
  NotificationItem,
  ResourceLink,
  WeatherSummary,
} from '@/lib/notifications';

type PatientProfile = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  pregnancyStartDate?: string;
  gestationalWeek?: number;
  age?: number;
  contactPhone?: string;
  riskStatus?: 'normal' | 'attention' | 'high-risk';
  doctorId?: string;
};

type ReminderConfirmAction =
  | { type: 'update' }
  | { type: 'toggle'; reminder: HealthReminder; isDone: boolean; time?: string }
  | { type: 'delete'; reminder: HealthReminder }
  | null;

const DAY_MS = 24 * 60 * 60 * 1000;
const OVERDUE_REMINDER_DELAY_MINUTES = 15;

const getMilestoneByWeek = (week: number) => {
  if (week <= 13) return 'First Trimester';
  if (week <= 27) return 'Second Trimester';
  return 'Third Trimester';
};

const getBabySizeVisual = (week: number) => {
  if (week <= 8) return { emoji: '\u{1FAD0}', label: 'Blueberry', description: '~1.5 cm long' };
  if (week <= 12) return { emoji: '\u{1F34B}', label: 'Lemon', description: '~6 cm long' };
  if (week <= 16) return { emoji: '\u{1F951}', label: 'Avocado', description: '~12 cm long' };
  if (week <= 20) return { emoji: '\u{1F34C}', label: 'Banana', description: '~25 cm long' };
  if (week <= 24) return { emoji: '\u{1F33D}', label: 'Corn', description: '~30 cm long' };
  if (week <= 28) return { emoji: '\u{1F346}', label: 'Eggplant', description: '~37 cm long' };
  if (week <= 32) return { emoji: '\u{1F965}', label: 'Coconut', description: '~42 cm long' };
  if (week <= 36) return { emoji: '\u{1F34D}', label: 'Pineapple', description: '~47 cm long' };
  return { emoji: '\u{1F349}', label: 'Watermelon', description: '~50 cm long' };
};

const calculatePregnancyProgress = (startDate: string | undefined, now: Date) => {
  const conceptionDate = startDate ? new Date(startDate) : now;
  const elapsedDays = Math.max(0, Math.floor((now.getTime() - conceptionDate.getTime()) / DAY_MS));
  const week = Math.min(40, Math.max(1, Math.floor(elapsedDays / 7) + 1));
  const day = (elapsedDays % 7) + 1;
  const dueDate = new Date(conceptionDate.getTime() + 280 * DAY_MS);
  const progressPercent = Math.min((elapsedDays / 280) * 100, 100);
  const daysUntilDue = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / DAY_MS));

  const remainingMs = Math.max(0, dueDate.getTime() - now.getTime());
  const hours = Math.floor((remainingMs % DAY_MS) / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);

  return {
    week,
    day,
    dueDate,
    progressPercent,
    daysUntilDue,
    countdown: { hours, minutes, seconds },
  };
};

const pad2 = (n: number) => n.toString().padStart(2, '0');
const formatDesktopTimeInputValue = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  const letters = value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
  if (!digits) return letters;
  if (digits.length <= 2) return digits;
  const base = `${digits.slice(0, 2)}:${digits.slice(2)}`;
  if (!letters) return digits.length === 4 ? `${base}  ` : base;
  return `${base}  ${letters}`;
};
const formatReminderTime = (time: string) => {
  const [hoursText, minutesText] = time.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};
const parseReminderTimeInput = (value: string, meridiem: 'AM' | 'PM') => {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hoursRaw = Number(match[1]);
  const minutesRaw = Number(match[2]);
  if (Number.isNaN(hoursRaw) || Number.isNaN(minutesRaw) || hoursRaw < 1 || hoursRaw > 12 || minutesRaw < 0 || minutesRaw > 59) {
    return null;
  }
  const hours24 = (hoursRaw % 12) + (meridiem === 'PM' ? 12 : 0);
  return `${pad2(hours24)}:${pad2(minutesRaw)}`;
};
const parseDesktopReminderTimeInput = (value: string) => {
  const normalized = value.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ');
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match) return null;
  return parseReminderTimeInput(`${match[1]}:${match[2]}`, match[3] as 'AM' | 'PM');
};
const parseStoredDate = (value: string) => {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};
const formatDateForInput = (date: Date | undefined) => {
  if (!date) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};
const formatReminderDateLabel = (value: string, fallback: string) => {
  const date = parseStoredDate(value);
  return date
    ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : fallback;
};
const formatReminderActiveRange = (startDate?: string, endDate?: string) => {
  if (!startDate && !endDate) return '';

  const startLabel = startDate ? formatReminderDateLabel(startDate, 'Today') : 'Today';
  const endLabel = endDate ? formatReminderDateLabel(endDate, 'Ongoing') : 'Ongoing';

  if (startDate && endDate) {
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }

  if (endDate) return `Until ${endLabel}`;
  return `From ${startLabel}`;
};
const normalizeReminderDateRange = (startDate?: string, endDate?: string) => {
  if (startDate && endDate && startDate > endDate) {
    return { startDate: endDate, endDate: startDate };
  }
  return { startDate: startDate || '', endDate: endDate || '' };
};
const isReminderVisibleOnDate = (reminder: HealthReminder, dateKey: string) => {
  const startDate = reminder.startDate ? String(reminder.startDate).slice(0, 10) : '';
  const endDate = reminder.endDate ? String(reminder.endDate).slice(0, 10) : '';

  if (startDate && startDate > dateKey) return false;
  if (endDate && endDate < dateKey) return false;
  return true;
};
const getReminderCompletedTimes = (reminder: HealthReminder) =>
  Array.isArray(reminder.completedTimes) ? reminder.completedTimes : [];

const getReminderProgressLabel = (reminder: HealthReminder) => {
  const totalCount = reminder.totalCount || Math.max(reminder.notifyTimes?.length || 0, 1);
  const completionCount = reminder.completionCount || 0;

  if (completionCount <= 0) return 'Pending';
  if (completionCount >= totalCount) return 'Done';
  return `${completionCount}/${totalCount} done`;
};

const getReminderStatusClasses = (reminder: HealthReminder) => {
  const totalCount = reminder.totalCount || Math.max(reminder.notifyTimes?.length || 0, 1);
  const completionCount = reminder.completionCount || 0;

  if (completionCount >= totalCount) return 'bg-green-100 text-green-700';
  if (completionCount > 0) return 'bg-sky-100 text-sky-700';
  return 'bg-amber-100 text-amber-700';
};

const getReminderNextPendingTime = (reminder: HealthReminder) => {
  const completedTimes = getReminderCompletedTimes(reminder);
  const notifyTimes = Array.isArray(reminder.notifyTimes) ? reminder.notifyTimes : [];
  return notifyTimes.find((time) => !completedTimes.includes(time)) || notifyTimes[0];
};

const getTimeInMinutes = (value: string) => {
  const [hoursText, minutesText] = value.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};
const getReminderTitleSuggestions = (
  reminders: HealthReminder[],
  query: string,
  defaultTitles: string[],
  limit = 8
) => {
  const normalizedQuery = query.trim().toLowerCase();
  const recentTitles = reminders
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.lastMarkedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.lastMarkedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    })
    .map((reminder) => reminder.title.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  return [...recentTitles, ...defaultTitles]
    .filter((title) => {
      const key = title.toLowerCase();
      if (seen.has(key)) return false;
      if (normalizedQuery && !key.includes(normalizedQuery)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};
const COMMON_REMINDER_TITLES = [
  'Take iron tablet',
  'Take prenatal vitamins',
  'Drink water',
  'Morning walk',
  'Check blood pressure',
  'Take calcium tablet',
  'Track baby movements',
  'Eat healthy snacks',
  'Take folic acid',
  'Do breathing exercises',
  'Check blood sugar',
  'Attend doctor appointment',
  'Get enough rest',
  'Take evening medicine',
];
const MOBILE_PICKER_HOURS = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, '0')
);
const MOBILE_PICKER_MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, '0')
);
const MOBILE_PICKER_MERIDIEMS = ['AM', 'PM'] as const;

export function PatientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState('');
  const [reminders, setReminders] = useState<HealthReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [showReminderActions, setShowReminderActions] = useState(false);
  const [confirmReminderAction, setConfirmReminderAction] = useState<ReminderConfirmAction>(null);
  const [mobileTimePickerOpen, setMobileTimePickerOpen] = useState(false);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const [titleSuggestionsOpen, setTitleSuggestionsOpen] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    title: '',
    notifyTimeInput: '',
    notifyHourInput: '',
    notifyMinuteInput: '',
    notifyMeridiemInput: 'AM' as 'AM' | 'PM',
    notifyTimes: [] as string[],
    startDate: '',
    endDate: '',
    details: '',
  });

  const [city, setCity] = useState(() => localStorage.getItem('vnx_city') || 'Chennai');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [summary, setSummary] = useState<WeatherSummary | null>(null);
  const [resources, setResources] = useState<ResourceLink[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [secondsToNext, setSecondsToNext] = useState(0);
  const reminderTitleSuggestions = useMemo(
    () => getReminderTitleSuggestions(reminders, reminderForm.title, COMMON_REMINDER_TITLES),
    [reminders, reminderForm.title]
  );

  const loadReminders = async () => {
    if (!patientId || user?.role !== 'patient') return;
    setRemindersLoading(true);
    try {
      const rows = await fetchPatientReminders(patientId);
      setReminders(rows);
    } catch (error) {
      console.error('Reminder fetch error:', error);
    } finally {
      setRemindersLoading(false);
    }
  };
  const [lastManualRefreshAt, setLastManualRefreshAt] = useState<number | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const visibleReminders = useMemo(() => {
    const todayKey = getLocalDateKey(now);
    return reminders.filter((reminder) => isReminderVisibleOnDate(reminder, todayKey));
  }, [now, reminders]);
  const [babyDevelopmentText, setBabyDevelopmentText] = useState(
    'Your baby continues to grow and develop every day.'
  );
  const [babyHighlights, setBabyHighlights] = useState<string[]>([
    'Baby continues steady growth this week',
    'Sleep and wake cycles become more defined',
    'Continue hydration, rest, and regular checkups',
  ]);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const mobileHourRef = useRef<HTMLDivElement>(null);
  const mobileMinuteRef = useRef<HTMLDivElement>(null);
  const mobileMeridiemRef = useRef<HTMLDivElement>(null);
  const mobileHourScrollTimeoutRef = useRef<number | null>(null);
  const mobileMinuteScrollTimeoutRef = useRef<number | null>(null);
  const mobileMeridiemScrollTimeoutRef = useRef<number | null>(null);

  const refreshIntervalMs = 10 * 60 * 1000;
  const cities = [
    'Chennai',
    'Bengaluru',
    'Mumbai',
    'Delhi',
    'Kolkata',
    'Hyderabad',
    'Pune',
    'Ahmedabad',
    'Jaipur',
    'Lucknow',
    'Kochi',
    'Coimbatore',
  ];

  const profile = (patient ?? (user as unknown as PatientProfile) ?? {}) as PatientProfile;
  const patientId = String(profile._id || profile.id || user?.id || '');
  const pregnancy = useMemo(
    () => calculatePregnancyProgress(profile.pregnancyStartDate, now),
    [profile.pregnancyStartDate, now]
  );
  const babySize = getBabySizeVisual(pregnancy.week);

  const filteredNotifications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const positiveOnly = notifications.filter((n) => n.severity === 'info');
    if (!q) return positiveOnly;
    return positiveOnly.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        n.city.toLowerCase().includes(q)
    );
  }, [notifications, searchQuery]);

  const loadNotifications = async (nextCity: string) => {
    if (!user?.id) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await refreshNotifications(user.id, nextCity);
      const onlyCity = data.notifications.filter(
        (n) => n.city?.toLowerCase() === data.city.toLowerCase()
      );
      setNotifications(onlyCity);
      setSummary(data.summary);
      setLastUpdatedAt(Date.now());
    } catch (err) {
      console.error('Notification refresh error:', err);
      setErrorMessage('Unable to fetch weather updates. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications(city);
    const id = setInterval(() => loadNotifications(city), refreshIntervalMs);
    return () => clearInterval(id);
  }, [city, user?.id]);

  useEffect(() => {
    fetchResources()
      .then(setResources)
      .catch((err) => console.error('Resources error:', err));
  }, []);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!lastUpdatedAt) return setSecondsToNext(0);
      const elapsed = Date.now() - lastUpdatedAt;
      const remaining = Math.max(refreshIntervalMs - elapsed, 0);
      setSecondsToNext(Math.ceil(remaining / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  useEffect(() => {
    const loadPatient = async () => {
      if (!user?.id || user.role !== 'patient') return;
      setPatientLoading(true);
      setPatientError('');
      try {
        let data: any = null;

        const byIdRes = await fetch(`${API_BASE}/api/auth/patient/${user.id}`);
        if (byIdRes.ok) {
          data = await byIdRes.json();
        } else if (user.email) {
          const byEmailRes = await fetch(
            `${API_BASE}/api/auth/patient/by-email/${encodeURIComponent(user.email)}`
          );
          if (byEmailRes.ok) {
            data = await byEmailRes.json();
          }
        }

        if (data?.success && data?.patient) {
          setPatient(data.patient);
        } else {
          setPatient(user as unknown as PatientProfile);
          setPatientError('Using basic profile data. Restart backend for full sync.');
        }
      } catch (err) {
        console.error('Patient fetch error:', err);
        setPatient(user as unknown as PatientProfile);
        setPatientError('Using basic profile data. Restart backend for full sync.');
      } finally {
        setPatientLoading(false);
      }
    };

    loadPatient();
  }, [user?.id, user?.role, user?.email]);

  useEffect(() => {
    loadReminders();
  }, [patientId, user?.role]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!patientId || user?.role !== 'patient' || reminders.length === 0) return;

    const tick = () => {
      const nowValue = new Date();
      const currentTime = `${pad2(nowValue.getHours())}:${pad2(nowValue.getMinutes())}`;
      const currentMinutes = nowValue.getHours() * 60 + nowValue.getMinutes();
      const today = getLocalDateKey(nowValue);

      reminders.forEach((reminder) => {
        if (reminder.startDate && String(reminder.startDate).slice(0, 10) > today) return;
        if (reminder.endDate && String(reminder.endDate).slice(0, 10) < today) return;
        const reminderId = String(reminder._id || reminder.id || '');
        const times = Array.isArray(reminder.notifyTimes) ? reminder.notifyTimes : [];
        const completedTimes = getReminderCompletedTimes(reminder);

        times.forEach((time) => {
          if (completedTimes.includes(time)) return;

          const dueStorageKey = `vnx-reminder-due-${reminderId}-${today}-${time}`;
          const overdueStorageKey = `vnx-reminder-overdue-${reminderId}-${today}-${time}`;
          const scheduledMinutes = getTimeInMinutes(time);
          if (scheduledMinutes === null) return;

          if (time === currentTime && !localStorage.getItem(dueStorageKey)) {
            localStorage.setItem(dueStorageKey, '1');
            toast({
              title: reminder.title,
              description: reminder.details || `Reminder scheduled for ${formatReminderTime(time)}`,
            });

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Health Reminder', {
                body: `${reminder.title} at ${formatReminderTime(time)}`,
              });
            }
            return;
          }

          const isOverdue = currentMinutes >= scheduledMinutes + OVERDUE_REMINDER_DELAY_MINUTES;
          if (!isOverdue || localStorage.getItem(overdueStorageKey)) return;

          localStorage.setItem(overdueStorageKey, '1');
          toast({
            title: `${reminder.title} is overdue`,
            description: `You have not marked the ${formatReminderTime(time)} reminder as done yet.`,
          });

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Reminder overdue', {
              body: `${reminder.title} for ${formatReminderTime(time)} is still pending.`,
            });
          }
        });
      });
    };

    tick();
    const intervalId = setInterval(tick, 30_000);
    return () => clearInterval(intervalId);
  }, [patientId, reminders, toast, user?.role]);

  useEffect(() => {
    if (typeof window === 'undefined' || reminders.length === 0) return;

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 1, 0);
    const timeoutId = window.setTimeout(() => {
      setReminders((prev) => prev.map((item) => normalizeReminder({ ...item })));
      loadReminders();
    }, Math.max(1_000, nextMidnight.getTime() - now.getTime()));

    return () => window.clearTimeout(timeoutId);
  }, [reminders, patientId, user?.role]);

  useEffect(() => {
    const loadBabyDevelopment = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pregnancy/development/${pregnancy.week}`);
        const data = await res.json();
        if (res.ok && data?.success) {
          if (data.summary) setBabyDevelopmentText(data.summary);
          if (Array.isArray(data.highlights) && data.highlights.length > 0) {
            setBabyHighlights(data.highlights);
          }
        }
      } catch (error) {
        console.error('Baby development fetch error:', error);
      }
    };

    loadBabyDevelopment();
  }, [pregnancy.week]);

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${pad2(m)}:${pad2(s)}`;
  };

  const latest = notifications[0];

  const openCreateReminder = () => {
    setEditingReminderId(null);
    setStartDatePickerOpen(false);
    setEndDatePickerOpen(false);
    setTitleSuggestionsOpen(false);
    setReminderForm({
      title: '',
      notifyTimeInput: '',
      notifyHourInput: '',
      notifyMinuteInput: '',
      notifyMeridiemInput: 'AM',
      notifyTimes: [],
      startDate: '',
      endDate: '',
      details: '',
    });
    setReminderDialogOpen(true);
  };

  const openEditReminder = (reminder: HealthReminder) => {
    setEditingReminderId(String(reminder._id || reminder.id || ''));
    setStartDatePickerOpen(false);
    setEndDatePickerOpen(false);
    setTitleSuggestionsOpen(false);
    setReminderForm({
      title: reminder.title || '',
      notifyTimeInput: '',
      notifyHourInput: '',
      notifyMinuteInput: '',
      notifyMeridiemInput: 'AM',
      notifyTimes: Array.isArray(reminder.notifyTimes) ? reminder.notifyTimes : [],
      startDate: reminder.startDate ? String(reminder.startDate).slice(0, 10) : '',
      endDate: reminder.endDate ? String(reminder.endDate).slice(0, 10) : '',
      details: reminder.details || '',
    });
    setReminderDialogOpen(true);
  };

  const persistReminder = async () => {
    if (!patientId || !user?.id || !reminderForm.title.trim() || reminderForm.notifyTimes.length === 0) return;
    setReminderSaving(true);
    try {
      const intervalLabel = reminderForm.notifyTimes
        .slice()
        .sort()
        .map((time) => {
          const [hoursText, minutesText] = time.split(':');
          const hours = Number(hoursText);
          const minutes = Number(minutesText);
          const date = new Date();
          date.setHours(hours, minutes, 0, 0);
          return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
        })
        .join(', ');

      const payload = {
        actorRole: 'patient' as const,
        actorId: user.id,
        title: reminderForm.title.trim(),
        intervalLabel,
        notifyTimes: reminderForm.notifyTimes,
        startDate: reminderForm.startDate || null,
        endDate: reminderForm.endDate || null,
        details: reminderForm.details.trim(),
      };

      const reminder = editingReminderId
        ? await updateReminder(editingReminderId, payload)
        : await createReminder(patientId, payload);

      setReminders((prev) => {
        const next = editingReminderId
          ? prev.map((item) =>
              String(item._id || item.id) === String(reminder._id || reminder.id) ? reminder : item
            )
          : [reminder, ...prev];
        return next;
      });

      toast({
        title: editingReminderId ? 'Reminder updated' : 'Reminder added',
        description: editingReminderId
          ? 'Your health reminder was updated successfully.'
          : 'Your health reminder was added successfully.',
      });
      setReminderDialogOpen(false);
      setEditingReminderId(null);
      setStartDatePickerOpen(false);
      setEndDatePickerOpen(false);
      setTitleSuggestionsOpen(false);
      setReminderForm({
        title: '',
        notifyTimeInput: '',
        notifyHourInput: '',
        notifyMinuteInput: '',
        notifyMeridiemInput: 'AM',
        notifyTimes: [],
        startDate: '',
        endDate: '',
        details: '',
      });
    } catch (error: any) {
      console.error('Save reminder error:', error);
      toast({
        title: 'Reminder save failed',
        description: error?.message || 'Unable to save reminder',
        variant: 'destructive',
      });
    } finally {
      setReminderSaving(false);
    }
  };

  const handleSaveReminder = async () => {
    if (editingReminderId) {
      setConfirmReminderAction({ type: 'update' });
      return;
    }
    await persistReminder();
  };

  const deleteReminderRecord = async (reminder: HealthReminder) => {
    const reminderId = String(reminder._id || reminder.id || '');
    if (!reminderId || !user?.id) return;
    try {
      await deleteReminder(reminderId, { actorRole: 'patient', actorId: user.id });
      setReminders((prev) => prev.filter((item) => String(item._id || item.id) !== reminderId));
      toast({
        title: 'Reminder deleted',
        description: 'Your reminder was removed successfully.',
      });
    } catch (error: any) {
      console.error('Delete reminder error:', error);
      toast({
        title: 'Delete failed',
        description: error?.message || 'Unable to delete reminder',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteReminder = (reminder: HealthReminder) => {
    setConfirmReminderAction({ type: 'delete', reminder });
  };

  const toggleReminderStatus = async (reminder: HealthReminder, isDone: boolean, time?: string) => {
    const reminderId = String(reminder._id || reminder.id || '');
    if (!reminderId || !patientId) return;
    try {
      const updated = await updateReminderStatus(reminderId, {
        patientId,
        isDone,
        time,
        dateKey: getLocalDateKey(),
      });
      setReminders((prev) =>
        prev.map((item) => (String(item._id || item.id) === reminderId ? updated : item))
      );
    } catch (error: any) {
      console.error('Toggle reminder status error:', error);
      toast({
        title: 'Update failed',
        description: error?.message || 'Unable to update reminder status',
        variant: 'destructive',
      });
    }
  };

  const handleToggleReminder = (reminder: HealthReminder, isDone: boolean, time?: string) => {
    setConfirmReminderAction({ type: 'toggle', reminder, isDone, time });
  };

  const handleAddNotifyTime = () => {
    const mobileValue =
      reminderForm.notifyHourInput && reminderForm.notifyMinuteInput
        ? parseReminderTimeInput(
            `${reminderForm.notifyHourInput}:${reminderForm.notifyMinuteInput}`,
            reminderForm.notifyMeridiemInput
          )
        : null;
    const value = mobileValue || parseDesktopReminderTimeInput(reminderForm.notifyTimeInput);
    if (!value) {
      if (
        reminderForm.notifyTimeInput.trim() ||
        reminderForm.notifyHourInput ||
        reminderForm.notifyMinuteInput
      ) {
        toast({
          title: 'Invalid time',
          description: 'Desktop: type like 10:30  PM. Mobile: pick hour, minute, then AM or PM.',
          variant: 'destructive',
        });
      }
      return;
    }
    if (reminderForm.notifyTimes.includes(value)) {
      setReminderForm((prev) => ({ ...prev, notifyTimeInput: '' }));
      return;
    }
    setReminderForm((prev) => ({
      ...prev,
      notifyTimes: [...prev.notifyTimes, value].sort(),
      notifyTimeInput: '',
      notifyHourInput: '',
      notifyMinuteInput: '',
      notifyMeridiemInput: prev.notifyMeridiemInput,
    }));
  };

  const handleRemoveNotifyTime = (value: string) => {
    setReminderForm((prev) => ({
      ...prev,
      notifyTimes: prev.notifyTimes.filter((item) => item !== value),
    }));
  };

  const syncMobilePickerColumn = (
    ref: React.RefObject<HTMLDivElement>,
    value: string,
    values: readonly string[]
  ) => {
    const index = values.indexOf(value);
    if (!ref.current || index < 0) return;
    const optionHeight = 44;
    ref.current.scrollTo({ top: index * optionHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!mobileTimePickerOpen) return;
    syncMobilePickerColumn(mobileHourRef, reminderForm.notifyHourInput || '06', MOBILE_PICKER_HOURS);
    syncMobilePickerColumn(
      mobileMinuteRef,
      reminderForm.notifyMinuteInput || '00',
      MOBILE_PICKER_MINUTES
    );
    syncMobilePickerColumn(
      mobileMeridiemRef,
      reminderForm.notifyMeridiemInput || 'AM',
      MOBILE_PICKER_MERIDIEMS
    );
  }, [
    mobileTimePickerOpen,
    reminderForm.notifyHourInput,
    reminderForm.notifyMinuteInput,
    reminderForm.notifyMeridiemInput,
  ]);

  useEffect(() => {
    return () => {
      if (mobileHourScrollTimeoutRef.current) window.clearTimeout(mobileHourScrollTimeoutRef.current);
      if (mobileMinuteScrollTimeoutRef.current) window.clearTimeout(mobileMinuteScrollTimeoutRef.current);
      if (mobileMeridiemScrollTimeoutRef.current) window.clearTimeout(mobileMeridiemScrollTimeoutRef.current);
    };
  }, []);

  const handleMobilePickerScroll = (
    ref: React.RefObject<HTMLDivElement>,
    timeoutRef: React.MutableRefObject<number | null>,
    values: readonly string[],
    onValueChange: (value: string) => void
  ) => {
    if (!ref.current) return;
    const optionHeight = 44;
    const index = Math.max(0, Math.min(values.length - 1, Math.round(ref.current.scrollTop / optionHeight)));
    onValueChange(values[index]);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      settleMobilePickerColumn(ref, values[index], values);
      timeoutRef.current = null;
    }, 90);
  };

  const settleMobilePickerColumn = (
    ref: React.RefObject<HTMLDivElement>,
    value: string,
    values: readonly string[]
  ) => {
    if (!ref.current) return;
    const optionHeight = 44;
    const index = Math.max(0, Math.min(values.length - 1, values.indexOf(value)));
    ref.current.scrollTo({ top: index * optionHeight, behavior: 'smooth' });
  };

  const applyMobilePickerTime = () => {
    setReminderForm((prev) => ({
      ...prev,
      notifyHourInput: prev.notifyHourInput || '06',
      notifyMinuteInput: prev.notifyMinuteInput || '00',
      notifyMeridiemInput: prev.notifyMeridiemInput || 'AM',
      notifyTimeInput: '',
    }));
    setMobileTimePickerOpen(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 rounded-[28px] border border-primary/10 bg-gradient-to-br from-primary/[0.08] via-background to-accent/30 p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Personal journey
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-[2.1rem]">
            Hello, {(profile?.name || user?.name || 'Mom').split(' ')[0]}!
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Here&apos;s your pregnancy journey at a glance</p>
          {patientLoading && <p className="text-xs text-muted-foreground">Loading your profile...</p>}
          {patientError && <p className="text-xs text-muted-foreground">{patientError}</p>}
        </div>
        <div className="hidden rounded-[24px] border bg-background/90 px-4 py-3 text-right shadow-sm sm:block">
          <p className="text-xs text-muted-foreground">
            {now.toLocaleDateString('en-IN', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <p className="text-lg font-semibold text-foreground">
            {now.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {summary ? `${city} - ${summary.temp} C` : `${city} - --`}
          </p>
        </div>
      </div>

      <Card className="border-none bg-gradient-to-r from-accent/40 via-background to-primary/10">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Real-time Update - {city}</p>
                <p className="text-xs text-muted-foreground">
                  {summary
                    ? `${summary.condition} - ${summary.temp}C - Humidity ${summary.humidity}%`
                    : 'Fetching weather updates...'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {lastUpdatedAt
                    ? `Last updated ${Math.floor((Date.now() - lastUpdatedAt) / 60000)} min ago - Next in ${formatSeconds(secondsToNext)}`
                    : 'Waiting for first update...'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={city}
                onChange={(e) => {
                  const v = e.target.value;
                  setCity(v);
                  localStorage.setItem('vnx_city', v);
                }}
              >
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                onClick={() => notificationsRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                View notifications
              </button>
              <button
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                onClick={() => {
                  const nowTs = Date.now();
                  if (lastManualRefreshAt && nowTs - lastManualRefreshAt < 60_000) return;
                  setLastManualRefreshAt(nowTs);
                  loadNotifications(city);
                }}
              >
                Refresh now
              </button>
            </div>
          </div>
          {latest && latest.severity === 'info' && (
            <div className="mt-3 rounded-xl border bg-background/70 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{latest.title}</span>
                  <span className="text-muted-foreground"> - {latest.message}</span>
                </div>
                {latest.url && (
                  <a
                    className="shrink-0 rounded-lg border border-border bg-background px-3 py-1 text-xs text-primary"
                    href={latest.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                )}
              </div>
            </div>
          )}
          {resources.length > 0 && (
            <div className="mt-3 grid gap-2">
              <p className="text-xs text-muted-foreground">Important links</p>
              <div className="flex flex-wrap gap-2">
                {resources.slice(0, 3).map((r) => (
                  <a
                    key={r.url}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border bg-background px-3 py-1 text-xs text-foreground hover:border-primary/40"
                    title={
                      r.updatedAt ? `Updated: ${new Date(r.updatedAt).toLocaleString()}` : 'Latest update'
                    }
                  >
                    {r.title}
                  </a>
                ))}
              </div>
            </div>
          )}
          {errorMessage && <p className="mt-2 text-xs text-red-500">{errorMessage}</p>}
          {isLoading && <p className="mt-2 text-xs text-muted-foreground">Refreshing updates...</p>}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-none bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 animate-fade-in">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
                  <Baby className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Progress</p>
                  <p className="text-3xl font-bold text-foreground">
                    Week {pregnancy.week}, Day {pregnancy.day}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pregnancy Progress</span>
                  <span className="font-medium text-primary">{Math.round(pregnancy.progressPercent)}%</span>
                </div>
                <Progress value={pregnancy.progressPercent} className="h-3 rounded-full" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Conception</span>
                  <span>
                    Due:{' '}
                    {pregnancy.dueDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center md:w-56">
              <div className="text-center p-6 rounded-2xl bg-background/60">
                <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-5xl">
                  {babySize.emoji}
                </div>
                <p className="text-3xl mb-1">{babySize.label}</p>
                <p className="text-sm font-medium text-foreground">Baby size this week</p>
                <p className="text-xs text-muted-foreground">{babySize.description}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Days Until Due"
          value={pregnancy.daysUntilDue}
          subtitle={`${pad2(pregnancy.countdown.hours)}h ${pad2(pregnancy.countdown.minutes)}m ${pad2(pregnancy.countdown.seconds)}s`}
          icon={<Calendar className="h-6 w-6" />}
          variant="primary"
        />
        <StatCard
          title="Week Milestone"
          value={getMilestoneByWeek(pregnancy.week)}
          subtitle={`Week ${pregnancy.week} of 40`}
          icon={<Heart className="h-6 w-6" />}
          variant="default"
        />
        <StatCard
          title="Health Score"
          value="Excellent"
          subtitle="Based on your logs"
          icon={<Sparkles className="h-6 w-6" />}
          variant="primary"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Baby className="h-5 w-5 text-primary" />
              Baby Development
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">{babyDevelopmentText}</p>
            <div className="rounded-xl bg-accent/50 p-4">
              <p className="text-sm font-medium text-foreground mb-2">This Week&apos;s Highlights:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {babyHighlights.map((item, idx) => (
                  <li key={idx}>- {item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                Health Reminders
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 rounded-xl"
                  onClick={() => setShowReminderActions((prev) => !prev)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button size="sm" className="gap-2 rounded-xl" onClick={openCreateReminder}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div>
              {remindersLoading ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Loading reminders...
                </div>
              ) : visibleReminders.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No active health reminders right now. Add one for yourself or wait for your doctor to set one.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {visibleReminders.map((reminder) => {
                    const reminderId = String(reminder._id || reminder.id || '');
                    const isOwnReminder = reminder.createdByRole === 'patient';
                    const activeRangeLabel = formatReminderActiveRange(reminder.startDate, reminder.endDate);
                    const notifyTimes = Array.isArray(reminder.notifyTimes) ? reminder.notifyTimes : [];
                    const completedTimes = getReminderCompletedTimes(reminder);
                    const progressLabel = getReminderProgressLabel(reminder);
                    const nextPendingTime = getReminderNextPendingTime(reminder);
                    const isMultiTimeReminder = notifyTimes.length > 1;
                    const canToggleFromCard = !isMultiTimeReminder && !!nextPendingTime;
                    return (
                      <div
                        key={reminderId}
                        role={canToggleFromCard ? 'button' : undefined}
                        tabIndex={canToggleFromCard ? 0 : undefined}
                        aria-pressed={canToggleFromCard ? reminder.isDone : undefined}
                        onClick={
                          canToggleFromCard
                            ? () => handleToggleReminder(reminder, !reminder.isDone, nextPendingTime)
                            : undefined
                        }
                        onKeyDown={
                          canToggleFromCard
                            ? (event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleToggleReminder(reminder, !reminder.isDone, nextPendingTime);
                                }
                              }
                            : undefined
                        }
                        className={`rounded-xl border bg-background p-3.5 text-left transition-colors ${
                          canToggleFromCard ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30' : ''
                        } ${
                          reminder.isDone
                            ? 'border-green-200 bg-green-50/50'
                            : (reminder.completionCount || 0) > 0
                              ? 'border-sky-200 bg-sky-50/40'
                              : 'hover:bg-accent/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium text-foreground" title={reminder.title}>
                                {reminder.title}
                              </p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  reminder.createdByRole === 'doctor'
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-accent text-accent-foreground'
                                }`}
                              >
                                {reminder.createdByRole === 'doctor' ? 'Doctor' : 'Mine'}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getReminderStatusClasses(reminder)}`}
                              >
                                {progressLabel}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{reminder.intervalLabel}</span>
                              {activeRangeLabel && <span>{activeRangeLabel}</span>}
                            </div>
                            {isMultiTimeReminder && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {notifyTimes.map((time) => {
                                  const isTimeDone = completedTimes.includes(time);
                                  return (
                                    <button
                                      key={time}
                                      type="button"
                                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                        isTimeDone
                                          ? 'border-green-200 bg-green-100 text-green-700'
                                          : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      }`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleToggleReminder(reminder, !isTimeDone, time);
                                      }}
                                    >
                                      {formatReminderTime(time)} {isTimeDone ? 'done' : 'mark'}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {isMultiTimeReminder && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Mark each reminder time separately.
                              </p>
                            )}
                            {reminder.details && (
                              <p
                                className="mt-1 truncate text-xs text-muted-foreground"
                                title={reminder.details}
                              >
                                Note: {reminder.details}
                              </p>
                            )}
                            {reminder.lastMarkedAt && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Last updated: {new Date(reminder.lastMarkedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>

                        {isOwnReminder && showReminderActions && (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2 rounded-xl"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditReminder(reminder);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2 rounded-xl text-destructive hover:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteReminder(reminder);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div ref={notificationsRef}>
        <Card className="animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search updates..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="mt-4 space-y-3 max-h-72 overflow-auto pr-1">
              {filteredNotifications.length === 0 && (
                <div className="text-sm text-muted-foreground">No updates yet.</div>
              )}
              {filteredNotifications.map((n) => (
                <div key={n._id} className="rounded-xl border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <span
                      className={`text-xs ${
                        n.severity === 'danger'
                          ? 'text-red-500'
                          : n.severity === 'warning'
                          ? 'text-orange-500'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {n.city}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                  {n.url && (
                    <a
                      className="mt-2 inline-block text-xs text-primary underline"
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read official update
                    </a>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div
        className="rounded-2xl bg-gradient-to-r from-primary/10 to-accent/20 p-6 text-center animate-fade-in"
        style={{ animationDelay: '300ms' }}
      >
        <p className="text-lg font-medium text-foreground mb-1">You&apos;re doing great, mom!</p>
        <p className="text-sm text-muted-foreground">
          Every step of this journey matters. Your baby is growing healthy and strong.
        </p>
      </div>

      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingReminderId ? 'Edit Reminder' : 'Add Reminder'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <div
                className="relative"
                onBlurCapture={(event) => {
                  const nextTarget = event.relatedTarget as Node | null;
                  if (!event.currentTarget.contains(nextTarget)) {
                    setTitleSuggestionsOpen(false);
                  }
                }}
              >
                <Input
                  value={reminderForm.title}
                  onFocus={() => setTitleSuggestionsOpen(true)}
                  onChange={(e) => {
                    setReminderForm((prev) => ({ ...prev, title: e.target.value }));
                    setTitleSuggestionsOpen(true);
                  }}
                  placeholder="Choose or type a reminder"
                  className="pr-11"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-primary"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setTitleSuggestionsOpen((prev) => !prev)}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                {titleSuggestionsOpen && reminderTitleSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-primary/20 bg-background shadow-[0_18px_45px_rgba(244,114,182,0.22)]">
                    <div className="border-b border-primary/10 bg-primary/5 px-4 py-2 text-xs font-medium text-primary">
                      Suggestions
                    </div>
                    <div className="max-h-72 overflow-y-auto p-2">
                      {reminderTitleSuggestions.map((title) => (
                        <button
                          key={title}
                          type="button"
                          className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setReminderForm((prev) => ({ ...prev, title }));
                            setTitleSuggestionsOpen(false);
                          }}
                        >
                          {title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">From date</label>
                <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between rounded-xl font-normal"
                    >
                      <span>{formatReminderDateLabel(reminderForm.startDate, 'Select start date')}</span>
                      <Calendar className="h-4 w-4 text-primary" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DateCalendar
                      mode="single"
                      selected={parseStoredDate(reminderForm.startDate)}
                      onSelect={(date) => {
                        const nextStartDate = formatDateForInput(date);
                        setReminderForm((prev) => ({
                          ...prev,
                          ...normalizeReminderDateRange(nextStartDate, prev.endDate),
                        }));
                        setStartDatePickerOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">To date</label>
                <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between rounded-xl font-normal"
                    >
                      <span>{formatReminderDateLabel(reminderForm.endDate, 'Select end date')}</span>
                      <Calendar className="h-4 w-4 text-primary" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DateCalendar
                      mode="single"
                      selected={parseStoredDate(reminderForm.endDate)}
                      onSelect={(date) => {
                        const nextEndDate = formatDateForInput(date);
                        setReminderForm((prev) => ({
                          ...prev,
                          ...normalizeReminderDateRange(prev.startDate, nextEndDate),
                        }));
                        setEndDatePickerOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reminder time</label>
              <div className="hidden gap-2 md:flex">
                <Input
                  type="text"
                  value={reminderForm.notifyTimeInput}
                  onChange={(e) =>
                    setReminderForm((prev) => ({
                      ...prev,
                      notifyTimeInput: formatDesktopTimeInputValue(e.target.value),
                      notifyHourInput: '',
                      notifyMinuteInput: '',
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNotifyTime();
                    }
                  }}
                  placeholder="10:30  PM"
                  inputMode="text"
                  maxLength={10}
                />
                <Button type="button" variant="outline" onClick={handleAddNotifyTime}>
                  Add time
                </Button>
              </div>
              <div className="space-y-2 md:hidden">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between rounded-xl"
                  onClick={() => setMobileTimePickerOpen(true)}
                >
                  <span>
                    {reminderForm.notifyHourInput && reminderForm.notifyMinuteInput
                      ? `${reminderForm.notifyHourInput}:${reminderForm.notifyMinuteInput} ${reminderForm.notifyMeridiemInput}`
                      : 'Choose reminder time'}
                  </span>
                  <Calendar className="h-4 w-4 text-primary" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddNotifyTime}
                  className="w-full"
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {reminderForm.notifyTimes.map((time) => (
                  <span
                    key={time}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                  >
                    {formatReminderTime(time)}
                    <button type="button" onClick={() => handleRemoveNotifyTime(time)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={reminderForm.details}
                onChange={(e) => setReminderForm((prev) => ({ ...prev, details: e.target.value }))}
                placeholder="Optional details"
                rows={3}
              />
            </div>

            <Button
              className="w-full rounded-xl"
              onClick={handleSaveReminder}
              disabled={reminderSaving || !reminderForm.title.trim() || reminderForm.notifyTimes.length === 0}
            >
              {reminderSaving ? 'Saving...' : editingReminderId ? 'Update Reminder' : 'Add Reminder'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmReminderAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmReminderAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmReminderAction?.type === 'delete'
                ? 'Delete reminder?'
                : confirmReminderAction?.type === 'toggle'
                  ? confirmReminderAction.isDone
                    ? `Have you completed${
                        confirmReminderAction.time ? ` the ${formatReminderTime(confirmReminderAction.time)} reminder` : ' this reminder'
                      }?`
                    : `Move${
                        confirmReminderAction.time ? ` the ${formatReminderTime(confirmReminderAction.time)} reminder` : ' this reminder'
                      } back to pending?`
                  : 'Confirm reminder update?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmReminderAction?.type === 'delete'
                ? 'This will permanently remove the reminder.'
                : confirmReminderAction?.type === 'toggle'
                  ? confirmReminderAction.isDone
                    ? 'Only mark it as done if you have actually finished that scheduled reminder.'
                    : 'That reminder time will show as pending again.'
                : 'Your reminder changes will be saved after confirmation.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmReminderAction?.type === 'delete'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
              onClick={async () => {
                const action = confirmReminderAction;
                setConfirmReminderAction(null);
                if (!action) return;
                if (action.type === 'delete') {
                  await deleteReminderRecord(action.reminder);
                  return;
                }
                if (action.type === 'toggle') {
                  await toggleReminderStatus(action.reminder, action.isDone, action.time);
                  return;
                }
                await persistReminder();
              }}
            >
              {confirmReminderAction?.type === 'delete'
                ? 'Delete'
                : confirmReminderAction?.type === 'toggle'
                  ? confirmReminderAction.isDone
                    ? 'Yes, mark done'
                    : 'Mark pending'
                  : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={mobileTimePickerOpen} onOpenChange={setMobileTimePickerOpen}>
        <DialogContent className="max-w-xs rounded-[28px] border-primary/10 bg-gradient-to-b from-background via-primary/[0.04] to-background p-0 md:hidden">
          <DialogHeader className="border-b border-primary/10 px-5 py-4">
            <DialogTitle className="text-base">Select Reminder Time</DialogTitle>
          </DialogHeader>
          <div className="px-4 py-5">
            <div className="relative grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-3 rounded-[24px] bg-primary/[0.06] px-3 py-4">
              <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-11 -translate-y-1/2 rounded-2xl border border-primary/15 bg-background/80" />
              <div
                ref={mobileHourRef}
                className="relative z-10 h-44 snap-y snap-mandatory overflow-y-auto py-[66px] text-center [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
                onScroll={() =>
                  handleMobilePickerScroll(
                    mobileHourRef,
                    mobileHourScrollTimeoutRef,
                    MOBILE_PICKER_HOURS,
                    (value) =>
                      setReminderForm((prev) => ({ ...prev, notifyHourInput: value, notifyTimeInput: '' }))
                  )
                }
                onTouchEnd={() =>
                  settleMobilePickerColumn(
                    mobileHourRef,
                    reminderForm.notifyHourInput || '06',
                    MOBILE_PICKER_HOURS
                  )
                }
                onMouseUp={() =>
                  settleMobilePickerColumn(
                    mobileHourRef,
                    reminderForm.notifyHourInput || '06',
                    MOBILE_PICKER_HOURS
                  )
                }
              >
                {MOBILE_PICKER_HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    className={`block h-11 w-full snap-center text-2xl font-semibold transition ${
                      reminderForm.notifyHourInput === hour ? 'text-primary' : 'text-muted-foreground/45'
                    }`}
                    onClick={() => {
                      setReminderForm((prev) => ({ ...prev, notifyHourInput: hour, notifyTimeInput: '' }));
                      syncMobilePickerColumn(mobileHourRef, hour, MOBILE_PICKER_HOURS);
                    }}
                  >
                    {hour}
                  </button>
                ))}
              </div>
              <div className="relative z-10 text-3xl font-semibold text-primary">:</div>
              <div
                ref={mobileMinuteRef}
                className="relative z-10 h-44 snap-y snap-mandatory overflow-y-auto py-[66px] text-center [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
                onScroll={() =>
                  handleMobilePickerScroll(
                    mobileMinuteRef,
                    mobileMinuteScrollTimeoutRef,
                    MOBILE_PICKER_MINUTES,
                    (value) =>
                      setReminderForm((prev) => ({ ...prev, notifyMinuteInput: value, notifyTimeInput: '' }))
                  )
                }
                onTouchEnd={() =>
                  settleMobilePickerColumn(
                    mobileMinuteRef,
                    reminderForm.notifyMinuteInput || '00',
                    MOBILE_PICKER_MINUTES
                  )
                }
                onMouseUp={() =>
                  settleMobilePickerColumn(
                    mobileMinuteRef,
                    reminderForm.notifyMinuteInput || '00',
                    MOBILE_PICKER_MINUTES
                  )
                }
              >
                {MOBILE_PICKER_MINUTES.map((minute) => (
                  <button
                    key={minute}
                    type="button"
                    className={`block h-11 w-full snap-center text-2xl font-semibold transition ${
                      reminderForm.notifyMinuteInput === minute ? 'text-primary' : 'text-muted-foreground/45'
                    }`}
                    onClick={() => {
                      setReminderForm((prev) => ({ ...prev, notifyMinuteInput: minute, notifyTimeInput: '' }));
                      syncMobilePickerColumn(mobileMinuteRef, minute, MOBILE_PICKER_MINUTES);
                    }}
                  >
                    {minute}
                  </button>
                ))}
              </div>
              <div
                ref={mobileMeridiemRef}
                className="relative z-10 h-44 snap-y snap-mandatory overflow-y-auto py-[66px] text-center [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
                onScroll={() =>
                  handleMobilePickerScroll(
                    mobileMeridiemRef,
                    mobileMeridiemScrollTimeoutRef,
                    MOBILE_PICKER_MERIDIEMS,
                    (value) =>
                      setReminderForm((prev) => ({
                        ...prev,
                        notifyMeridiemInput: value,
                        notifyTimeInput: '',
                      }))
                  )
                }
                onTouchEnd={() =>
                  settleMobilePickerColumn(
                    mobileMeridiemRef,
                    reminderForm.notifyMeridiemInput || 'AM',
                    MOBILE_PICKER_MERIDIEMS
                  )
                }
                onMouseUp={() =>
                  settleMobilePickerColumn(
                    mobileMeridiemRef,
                    reminderForm.notifyMeridiemInput || 'AM',
                    MOBILE_PICKER_MERIDIEMS
                  )
                }
              >
                {MOBILE_PICKER_MERIDIEMS.map((meridiem) => (
                  <button
                    key={meridiem}
                    type="button"
                    className={`block h-11 w-full snap-center text-2xl font-semibold lowercase transition ${
                      reminderForm.notifyMeridiemInput === meridiem
                        ? 'text-primary'
                        : 'text-muted-foreground/45'
                    }`}
                    onClick={() => {
                      setReminderForm((prev) => ({
                        ...prev,
                        notifyMeridiemInput: meridiem,
                        notifyTimeInput: '',
                      }));
                      syncMobilePickerColumn(mobileMeridiemRef, meridiem, MOBILE_PICKER_MERIDIEMS);
                    }}
                  >
                    {meridiem.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setMobileTimePickerOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" className="flex-1 rounded-xl" onClick={applyMobilePickerTime}>
                Set
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
