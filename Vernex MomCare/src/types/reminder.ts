export interface HealthReminder {
  _id?: string;
  id?: string;
  patientId?: string;
  patientName?: string;
  doctorId?: string;
  doctorName?: string;
  createdByRole: 'patient' | 'doctor';
  createdById?: string;
  title: string;
  details?: string;
  intervalLabel: string;
  startDate?: string | null;
  endDate?: string | null;
  notifyTimes?: string[];
  completedDate?: string | null;
  completedTimes?: string[];
  completionCount?: number;
  totalCount?: number;
  isDone: boolean;
  lastMarkedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
