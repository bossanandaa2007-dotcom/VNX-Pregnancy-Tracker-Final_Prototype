import { API_BASE } from '@/config/api';
import type { HealthReminder } from '@/types/reminder';

const pad2 = (value: number) => String(value).padStart(2, '0');

export const getLocalDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const normalizeReminder = (reminder: HealthReminder): HealthReminder => {
  const todayKey = getLocalDateKey();
  const notifyTimes = Array.isArray(reminder.notifyTimes)
    ? reminder.notifyTimes.map((value) => String(value).trim()).filter(Boolean).sort()
    : [];
  const fallbackDateKey =
    reminder.lastMarkedAt && !Number.isNaN(new Date(reminder.lastMarkedAt).getTime())
      ? getLocalDateKey(new Date(reminder.lastMarkedAt))
      : null;
  const completedDate = typeof reminder.completedDate === 'string' ? reminder.completedDate : fallbackDateKey;
  const rawCompletedTimes = Array.isArray(reminder.completedTimes)
    ? reminder.completedTimes.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const fallbackCompletedTimes =
    rawCompletedTimes.length === 0 && reminder.isDone && completedDate === todayKey
      ? notifyTimes.length > 0
        ? [...notifyTimes]
        : ['default']
      : rawCompletedTimes;
  const completedTimes =
    completedDate === todayKey
      ? fallbackCompletedTimes.filter((value) => notifyTimes.length === 0 || notifyTimes.includes(value))
      : [];
  const totalCount = notifyTimes.length || 1;
  const completionCount = Math.min(completedTimes.length, totalCount);

  return {
    ...reminder,
    notifyTimes,
    completedDate,
    completedTimes,
    completionCount,
    totalCount,
    isDone: completionCount >= totalCount,
    lastMarkedAt: completionCount > 0 ? reminder.lastMarkedAt ?? null : null,
  };
};

const parseResponse = async (res: Response) => {
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || 'Reminder request failed');
  }
  return data;
};

export const fetchPatientReminders = async (patientId: string, doctorId?: string) => {
  const qs = doctorId ? `?doctorId=${encodeURIComponent(doctorId)}` : '';
  const data = await parseResponse(await fetch(`${API_BASE}/api/reminders/patient/${patientId}${qs}`));
  return ((data.reminders || []) as HealthReminder[]).map(normalizeReminder);
};

export const createReminder = async (
  patientId: string,
  payload: {
    actorRole: 'patient' | 'doctor';
    actorId: string;
    title: string;
    details?: string;
    intervalLabel: string;
    startDate?: string | null;
    endDate?: string | null;
    notifyTimes?: string[];
  }
) => {
  const data = await parseResponse(
    await fetch(`${API_BASE}/api/reminders/patient/${patientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  );
  return normalizeReminder(data.reminder as HealthReminder);
};

export const updateReminder = async (
  reminderId: string,
  payload: {
    actorRole: 'patient' | 'doctor';
    actorId: string;
    title: string;
    details?: string;
    intervalLabel: string;
    startDate?: string | null;
    endDate?: string | null;
    notifyTimes?: string[];
  }
) => {
  const data = await parseResponse(
    await fetch(`${API_BASE}/api/reminders/${reminderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  );
  return normalizeReminder(data.reminder as HealthReminder);
};

export const deleteReminder = async (
  reminderId: string,
  payload: { actorRole: 'patient' | 'doctor'; actorId: string }
) => {
  await parseResponse(
    await fetch(`${API_BASE}/api/reminders/${reminderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  );
};

export const updateReminderStatus = async (
  reminderId: string,
  payload: { patientId: string; isDone: boolean; time?: string; dateKey?: string }
) => {
  const data = await parseResponse(
    await fetch(`${API_BASE}/api/reminders/${reminderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  );
  return normalizeReminder(data.reminder as HealthReminder);
};

export { normalizeReminder };
