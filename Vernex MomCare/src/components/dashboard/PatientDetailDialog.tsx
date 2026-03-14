  import { useEffect, useMemo, useRef, useState } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { Patient } from '@/types';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { Progress } from '@/components/ui/progress';
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
  import { Textarea } from '@/components/ui/textarea';
  import { Input } from '@/components/ui/input';
  import { Calendar as DateCalendar } from '@/components/ui/calendar';
  import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
  import { mockHealthData } from '@/data/mockData';
  import { useAuth } from '@/contexts/AuthContext';
  import type { HealthReminder } from '@/types/reminder';
  import {
    createReminder,
    deleteReminder,
    fetchPatientReminders,
    updateReminder,
  } from '@/lib/reminders';
  import {
    User,
    Calendar,
    ChevronDown,
    Phone,
    Mail,
    FileText,
    MessageCircle,
    TrendingUp,
    Heart,
    AlertTriangle,
    CheckCircle,
    AlertCircle,
    BarChart3,
    Bell,
    Pencil,
    Plus,
    Trash2,
    X,
  } from 'lucide-react';
  import { cn } from '@/lib/utils';
  import { useToast } from '@/hooks/use-toast';
  import { API_BASE } from '@/config/api';
  import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

  interface PatientDetailDialogProps {
    patient: Patient;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  const riskStatusConfig = {
    normal: {
      label: 'Normal',
      icon: CheckCircle,
      className: 'bg-success/10 text-success border-success/20',
    },
    attention: {
      label: 'Attention',
      icon: AlertCircle,
      className: 'bg-warning/10 text-warning border-warning/20',
    },
    'high-risk': {
      label: 'High Risk',
      icon: AlertTriangle,
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    },
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
  const getReminderCompletedTimes = (reminder: HealthReminder) =>
    Array.isArray(reminder.completedTimes) ? reminder.completedTimes : [];
  const getReminderProgressLabel = (reminder: HealthReminder) => {
    const totalCount = reminder.totalCount || Math.max(reminder.notifyTimes?.length || 0, 1);
    const completionCount = reminder.completionCount || 0;

    if (completionCount <= 0) return 'Pending';
    if (completionCount >= totalCount) return 'Done';
    return `${completionCount}/${totalCount} done`;
  };
  const getReminderStatusClassName = (reminder: HealthReminder) => {
    const totalCount = reminder.totalCount || Math.max(reminder.notifyTimes?.length || 0, 1);
    const completionCount = reminder.completionCount || 0;

    if (completionCount >= totalCount) {
      return 'border-success/20 bg-success/10 text-success';
    }
    if (completionCount > 0) {
      return 'border-sky-200 bg-sky-100 text-sky-700';
    }
    return 'border-warning/20 bg-warning/10 text-warning';
  };
  const MOBILE_PICKER_HOURS = Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, '0')
  );
  const MOBILE_PICKER_MINUTES = Array.from({ length: 60 }, (_, index) =>
    String(index).padStart(2, '0')
  );
  const MOBILE_PICKER_MERIDIEMS = ['AM', 'PM'] as const;
  type ReminderConfirmAction =
    | { type: 'update' }
    | { type: 'delete'; reminder: HealthReminder }
    | null;

  export function PatientDetailDialog({
    patient,
    open,
    onOpenChange,
  }: PatientDetailDialogProps) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const [localMedicalNotes, setLocalMedicalNotes] = useState(patient.medicalNotes || '');
    const [savingNote, setSavingNote] = useState(false);
    const [reminders, setReminders] = useState<HealthReminder[]>([]);
    const [remindersLoading, setRemindersLoading] = useState(false);
    const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
    const [reminderSaving, setReminderSaving] = useState(false);
    const [showReminderForm, setShowReminderForm] = useState(false);
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
    const reminderTitleSuggestions = useMemo(
      () => getReminderTitleSuggestions(reminders, reminderForm.title, COMMON_REMINDER_TITLES),
      [reminders, reminderForm.title]
    );
    const visibleReminders = useMemo(() => {
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
      return reminders.filter((reminder) => isReminderVisibleOnDate(reminder, todayKey));
    }, [reminders]);
    const mobileHourRef = useRef<HTMLDivElement>(null);
    const mobileMinuteRef = useRef<HTMLDivElement>(null);
    const mobileMeridiemRef = useRef<HTMLDivElement>(null);
    const mobileHourScrollTimeoutRef = useRef<number | null>(null);
    const mobileMinuteScrollTimeoutRef = useRef<number | null>(null);
    const mobileMeridiemScrollTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
      setLocalMedicalNotes(patient.medicalNotes || '');
    }, [patient.id, patient.medicalNotes]);

    useEffect(() => {
      const loadReminders = async () => {
        if (!open || !patient.id) return;
        setRemindersLoading(true);
        try {
          const rows = await fetchPatientReminders(String(patient.id), user?.role === 'doctor' ? user.id : undefined);
          setReminders(rows);
        } catch (error: any) {
          console.error('Doctor reminder fetch error:', error);
          toast({
            title: 'Failed to load reminders',
            description: error?.message || 'Unable to load reminders',
            variant: 'destructive',
          });
        } finally {
          setRemindersLoading(false);
        }
      };

      loadReminders();
    }, [open, patient.id, toast, user?.id, user?.role]);
    // ================= SAFE GUARDS =================
    const safeRiskStatus = patient.riskStatus || 'normal';
    const riskConfig = riskStatusConfig[safeRiskStatus];
    const RiskIcon = riskConfig.icon;

    const gestationalWeek = patient.gestationalWeek || 0;
    const progressPercent = Math.min((gestationalWeek / 40) * 100, 100);

    const pregnancyStartDate = patient.pregnancyStartDate
      ? new Date(patient.pregnancyStartDate)
      : null;

    const analyticsSummary = useMemo(() => {
      // Lightweight per-patient variation using a deterministic offset.
      const seed = String(patient.id || patient.email || patient.name || "0");
      let hash = 0;
      for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
      const offset = (hash % 60) / 10 - 3; // [-3, +3)

      const points = mockHealthData.map((x) => ({
        date: x.date,
        weight: Number((x.weight + offset).toFixed(1)),
        mood: x.mood,
      }));

      const currentWeight = points.at(-1)?.weight ?? 0;
      const weightDelta =
        points.length >= 2 ? Number((currentWeight - points[0].weight).toFixed(1)) : 0;
      const moodText = (() => {
        const m = points.at(-1)?.mood || 'okay';
        if (m === 'great') return 'Great';
        if (m === 'good') return 'Good';
        if (m === 'low') return 'Low';
        return 'Okay';
      })();

      return { currentWeight, weightDelta, moodText };
    }, [patient.id, patient.email, patient.name]);

    const handleSaveNote = async () => {
      const trimmed = localMedicalNotes.trim();
      setSavingNote(true);
      try {
        const res = await fetch(`${API_BASE}/api/auth/patient/${patient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ medicalNotes: trimmed }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || 'Failed to update notes');
        }
        toast({
          title: 'Note updated',
          description: 'Medical note saved successfully.',
        });
      } catch (error: any) {
        console.error('Save note error:', error);
        toast({
          title: 'Failed to save note',
          description: error?.message || 'Something went wrong',
          variant: 'destructive',
        });
      } finally {
        setSavingNote(false);
      }
    };

    const openCreateReminder = () => {
      setEditingReminderId(null);
      setShowReminderForm(true);
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
    };

    const openEditReminder = (reminder: HealthReminder) => {
      setEditingReminderId(String(reminder._id || reminder.id || ''));
      setShowReminderForm(true);
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
    };

    const persistReminder = async () => {
      if (!user?.id || !patient.id || !reminderForm.title.trim() || reminderForm.notifyTimes.length === 0) {
        return;
      }

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
          actorRole: 'doctor' as const,
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
          : await createReminder(String(patient.id), payload);

        setReminders((prev) =>
          editingReminderId
            ? prev.map((item) =>
                String(item._id || item.id) === String(reminder._id || reminder.id) ? reminder : item
              )
            : [reminder, ...prev]
        );
        setEditingReminderId(null);
        setShowReminderForm(false);
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
        toast({
          title: editingReminderId ? 'Reminder updated' : 'Reminder created',
          description: editingReminderId
            ? 'Doctor reminder updated successfully.'
            : 'Doctor reminder added for this patient.',
        });
      } catch (error: any) {
        console.error('Doctor save reminder error:', error);
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

    const handleMobilePickerScroll = (
      ref: React.RefObject<HTMLDivElement>,
      timeoutRef: React.MutableRefObject<number | null>,
      values: readonly string[],
      onValueChange: (value: string) => void
    ) => {
      if (!ref.current) return;
      const optionHeight = 44;
      const index = Math.max(
        0,
        Math.min(values.length - 1, Math.round(ref.current.scrollTop / optionHeight))
      );
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

    useEffect(() => {
      return () => {
        if (mobileHourScrollTimeoutRef.current) window.clearTimeout(mobileHourScrollTimeoutRef.current);
        if (mobileMinuteScrollTimeoutRef.current) window.clearTimeout(mobileMinuteScrollTimeoutRef.current);
        if (mobileMeridiemScrollTimeoutRef.current) window.clearTimeout(mobileMeridiemScrollTimeoutRef.current);
      };
    }, []);

    const deleteReminderRecord = async (reminder: HealthReminder) => {
      const reminderId = String(reminder._id || reminder.id || '');
      if (!reminderId || !user?.id) return;
      try {
        await deleteReminder(reminderId, { actorRole: 'doctor', actorId: user.id });
        setReminders((prev) => prev.filter((item) => String(item._id || item.id) !== reminderId));
        toast({
          title: 'Reminder deleted',
          description: 'Doctor reminder removed successfully.',
        });
      } catch (error: any) {
        console.error('Doctor delete reminder error:', error);
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

    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 rounded-xl bg-primary/10">
                <AvatarImage src={patient.profilePhoto} alt={patient.name} className="object-cover" />
                <AvatarFallback className="rounded-xl bg-primary/10">
                  <User className="h-7 w-7 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <DialogTitle className="text-xl">{patient.name}</DialogTitle>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-muted-foreground">
                    Age {patient.age || '-'} • Week {gestationalWeek}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn('gap-1', riskConfig.className)}
                  >
                    <RiskIcon className="h-3 w-3" />
                    {riskConfig.label}
                  </Badge>
                </div>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="health">Health Data</TabsTrigger>
              <TabsTrigger value="reminders">Reminders</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            {/* ================= OVERVIEW ================= */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Contact Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{patient.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {patient.contactPhone || 'Not provided'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Started:{' '}
                      {pregnancyStartDate
                        ? pregnancyStartDate.toLocaleDateString()
                        : 'Not available'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Pregnancy Progress */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pregnancy Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-primary" />
                      <span className="font-medium">
                        Week {gestationalWeek} of 40
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(progressPercent)}% complete
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>First Trimester</span>
                    <span>Second Trimester</span>
                    <span>Third Trimester</span>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div className="flex gap-3">
                <Button
                  className="flex-1 gap-2 rounded-xl"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/doctor/chat/${patient.id}`, {
                      state: { patientName: patient.name },
                    });
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Open Chat
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 rounded-xl"
                  onClick={() => navigate(`/doctor/analytics/${patient.id}`)}
                >
                  <BarChart3 className="h-4 w-4" />
                  View Analytics
                </Button>
              </div>
            </TabsContent>

            {/* ================= HEALTH ================= */}
            <TabsContent value="health" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Health Metrics
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => navigate(`/doctor/analytics/${patient.id}`)}
                    >
                      View full analytics
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-center justify-center rounded-xl bg-accent/30">
                    <p className="text-sm text-muted-foreground">
                      Patient summary shown here. Use "View full analytics" for detailed charts.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    Informational – Not Diagnostic
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-accent/30 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{analyticsSummary.currentWeight}</p>
                  <p className="text-xs text-muted-foreground">
                    Current Weight (kg)
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {analyticsSummary.weightDelta >= 0 ? '+' : ''}{analyticsSummary.weightDelta} kg (4w)
                  </p>
                </div>
                <div className="rounded-xl bg-accent/30 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">120/80</p>
                  <p className="text-xs text-muted-foreground">
                    Blood Pressure
                  </p>
                </div>
                <div className="rounded-xl bg-accent/30 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{analyticsSummary.moodText}</p>
                  <p className="text-xs text-muted-foreground">Overall Mood</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="reminders" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-3 text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      Health Reminders
                    </span>
                    <Button size="sm" className="gap-2 rounded-lg" onClick={openCreateReminder}>
                      <Plus className="h-4 w-4" />
                      Add Reminder
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {showReminderForm && (
                    <div className="grid gap-3 rounded-xl border p-4">
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
                          placeholder="Choose or type a reminder"
                          value={reminderForm.title}
                          onFocus={() => setTitleSuggestionsOpen(true)}
                          onChange={(e) => {
                            setReminderForm((prev) => ({ ...prev, title: e.target.value }));
                            setTitleSuggestionsOpen(true);
                          }}
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
                      <div className="grid grid-cols-2 gap-3">
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
                      <div className="hidden gap-2 md:flex">
                        <Input
                          type="text"
                          value={reminderForm.notifyTimeInput}
                          onChange={(e) =>
                            setReminderForm((prev) => ({
                              ...prev,
                              notifyTimeInput: formatDesktopTimeInputValue(e.target.value),
                              notifyNativeTimeInput: '',
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
                        <Button type="button" variant="outline" onClick={handleAddNotifyTime} className="w-full">
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
                      <Textarea
                        placeholder="Extra instructions (optional)"
                        value={reminderForm.details}
                        onChange={(e) => setReminderForm((prev) => ({ ...prev, details: e.target.value }))}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button
                          className="rounded-xl"
                          onClick={handleSaveReminder}
                          disabled={reminderSaving || !reminderForm.title.trim() || reminderForm.notifyTimes.length === 0}
                        >
                          {reminderSaving ? 'Saving...' : editingReminderId ? 'Update Reminder' : 'Add Reminder'}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            setEditingReminderId(null);
                            setShowReminderForm(false);
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
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {remindersLoading ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Loading reminders...
                    </div>
                  ) : visibleReminders.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      No active reminders for this patient right now.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleReminders.map((reminder) => {
                        const reminderId = String(reminder._id || reminder.id || '');
                        const doctorOwned = reminder.createdByRole === 'doctor';
                        const activeRangeLabel = formatReminderActiveRange(reminder.startDate, reminder.endDate);
                        const completedTimes = getReminderCompletedTimes(reminder);
                        return (
                          <div key={reminderId} className="rounded-xl border p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium" title={reminder.title}>{reminder.title}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                  <span>{reminder.intervalLabel}</span>
                                  {activeRangeLabel && <span>{activeRangeLabel}</span>}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">
                                  {doctorOwned ? 'Doctor' : 'Patient'}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={cn(getReminderStatusClassName(reminder))}
                                >
                                  {getReminderProgressLabel(reminder)}
                                </Badge>
                              </div>
                            </div>
                            {Array.isArray(reminder.notifyTimes) && reminder.notifyTimes.length > 1 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {reminder.notifyTimes.map((time) => (
                                  <span
                                    key={time}
                                    className={cn(
                                      'rounded-lg border px-2.5 py-1 text-[11px] font-medium',
                                      completedTimes.includes(time)
                                        ? 'border-green-200 bg-green-100 text-green-700'
                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                    )}
                                  >
                                    {formatReminderTime(time)} {completedTimes.includes(time) ? 'done' : 'pending'}
                                  </span>
                                ))}
                              </div>
                            )}
                            {reminder.details && (
                              <p className="mt-1 truncate text-sm text-muted-foreground" title={reminder.details}>
                                Note: {reminder.details}
                              </p>
                            )}
                            {reminder.lastMarkedAt && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Patient updated: {new Date(reminder.lastMarkedAt).toLocaleString()}
                              </p>
                            )}

                            {doctorOwned && (
                              <div className="mt-2.5 flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 rounded-xl"
                                  onClick={() => openEditReminder(reminder)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 rounded-xl text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteReminder(reminder)}
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
                </CardContent>
              </Card>
            </TabsContent>

            {/* ================= NOTES ================= */}
            <TabsContent value="notes" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Medical Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    className="min-h-32 rounded-xl"
                    placeholder="Type medical notes here..."
                    value={localMedicalNotes}
                    onChange={(e) => setLocalMedicalNotes(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="w-full mt-4 rounded-xl"
                    onClick={handleSaveNote}
                    disabled={savingNote}
                  >
                    {savingNote ? 'Saving...' : 'Save Note'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </DialogContent>
        </Dialog>
        <AlertDialog
          open={confirmReminderAction !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setConfirmReminderAction(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmReminderAction?.type === 'delete' ? 'Delete reminder?' : 'Confirm reminder update?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmReminderAction?.type === 'delete'
                  ? 'This will permanently remove the doctor-set reminder for this patient.'
                  : 'The reminder changes will be saved after confirmation.'}
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
                  await persistReminder();
                }}
              >
                {confirmReminderAction?.type === 'delete' ? 'Delete' : 'Confirm'}
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
      </>
    );
  }
