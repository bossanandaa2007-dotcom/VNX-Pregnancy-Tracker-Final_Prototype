import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CalendarDays,
  Clock,
  User,
  Plus,
  List,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
} from 'lucide-react';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { API_BASE } from '@/config/api';

type AppointmentApiShape = {
  _id?: string;
  id?: string;
  patientName?: string;
  patientId?: string;
  doctorName?: string;
  doctorId?: string;
  date?: string;
  time?: string;
  notes?: string;
  patientNotes?: string;
  doctorNotes?: string;
  status?: AppointmentStatus;
  completedAt?: string | null;
};

const parseAppointmentDateTime = (appointment: Pick<Appointment, 'date' | 'time'>) => {
  if (!appointment.date || !appointment.time) return null;

  const [timePart, meridiem] = appointment.time.trim().split(' ');
  if (!timePart || !meridiem) return null;

  const [hoursText, minutesText] = timePart.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  let normalizedHours = hours % 12;
  if (meridiem.toUpperCase() === 'PM') normalizedHours += 12;

  const value = new Date(`${appointment.date}T00:00:00`);
  value.setHours(normalizedHours, minutes, 0, 0);
  return value;
};

const isAwaitingDoctorNotes = (appointment: Appointment, now: Date) =>
  appointment.status === 'approved' && !appointment.doctorNotes && !!parseAppointmentDateTime(appointment) && parseAppointmentDateTime(appointment)!.getTime() <= now.getTime();

type PatientApiShape = {
  _id?: string;
  id?: string;
  doctorId?: string | { _id?: string; name?: string };
};

const availableTimes = ['10:00 AM', '10:30 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM'];

const toLocalDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const mapAppointment = (appt: AppointmentApiShape): Appointment => ({
  id: appt._id || appt.id || `${Date.now()}`,
  patientName: appt.patientName || '',
  doctorName: appt.doctorName || 'Assigned Doctor',
  patientId: appt.patientId,
  doctorId: appt.doctorId,
  date: appt.date || '',
  time: appt.time || '',
  notes: appt.patientNotes || appt.notes || '',
  patientNotes: appt.patientNotes || appt.notes || '',
  doctorNotes: appt.doctorNotes || '',
  status: appt.status || 'pending',
  completedAt: appt.completedAt || null,
});

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const statusClass = (status: AppointmentStatus | 'awaiting_notes') => {
  if (status === 'approved') return 'text-success';
  if (status === 'pending') return 'text-warning';
  if (status === 'completed') return 'text-primary';
  if (status === 'awaiting_notes') return 'text-warning';
  return 'text-destructive';
};

const getStatusLabel = (appointment: Appointment, now: Date) => {
  if (isAwaitingDoctorNotes(appointment, now)) return 'Awaiting doctor notes';
  if (appointment.status === 'completed') return 'Completed';
  if (appointment.status === 'approved') return 'Approved';
  if (appointment.status === 'pending') return 'Pending';
  return 'Rejected';
};

function EmptyCard({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-5 text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

function AppointmentSummary({ appointment }: { appointment: Appointment }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 font-medium">
        <User className="h-4 w-4 text-primary" />
        {appointment.doctorName}
      </p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        {appointment.date}
      </p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        {appointment.time}
      </p>
      {appointment.patientNotes && (
        <p className="text-xs text-muted-foreground">Your note: {appointment.patientNotes}</p>
      )}
      {appointment.doctorNotes && (
        <p className="text-xs text-muted-foreground">Doctor note: {appointment.doctorNotes}</p>
      )}
    </div>
  );
}

export default function Appointments() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'completed' | 'rejected'>('all');
  const [historyMonthFilter, setHistoryMonthFilter] = useState<'all' | string>('all');
  const [historySort, setHistorySort] = useState<'newest' | 'oldest'>('newest');
  const currentDateTime = new Date();

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  const [doctorId, setDoctorId] = useState('');
  const [form, setForm] = useState({
    doctor: 'Assigned Doctor',
    date: toLocalDateString(new Date()),
    time: '',
    notes: '',
  });

  useEffect(() => {
    const loadAppointments = async () => {
      if (!user?.id || user.role !== 'patient') return;
      setLoading(true);
      try {
        const [apptRes, patientRes] = await Promise.all([
          fetch(`${API_BASE}/api/appointments/patient/${user.id}`),
          fetch(`${API_BASE}/api/auth/patient/${user.id}`),
        ]);

        const apptData = await apptRes.json();
        if (!apptRes.ok || !apptData?.success) {
          throw new Error(apptData?.message || 'Unable to load appointments');
        }
        setAppointments((apptData.appointments || []).map(mapAppointment));

        if (patientRes.ok) {
          const patientData = await patientRes.json();
          const patient = (patientData?.success ? patientData.patient : null) as PatientApiShape | null;
          if (patient?.doctorId && typeof patient.doctorId === 'object') {
            setDoctorId(patient.doctorId._id || '');
            setForm((prev) => ({ ...prev, doctor: patient.doctorId?.name || prev.doctor }));
          } else if (typeof patient?.doctorId === 'string') {
            setDoctorId(patient.doctorId);
            const docRes = await fetch(`${API_BASE}/api/auth/doctor/${patient.doctorId}`);
            if (docRes.ok) {
              const docData = await docRes.json();
              if (docData?.success) {
                setForm((prev) => ({ ...prev, doctor: docData.doctor?.name || prev.doctor }));
              }
            }
          }
        }
      } catch (error: unknown) {
        console.error('Appointments fetch error:', error);
        toast({
          title: 'Error',
          description: getErrorMessage(error, 'Unable to load appointments'),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadAppointments();
  }, [toast, user?.id, user?.role]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthName = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const goPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };

  const goNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  const appointmentsByDate = useMemo(
    () => appointments.filter((a) => a.date === selectedDate),
    [appointments, selectedDate]
  );

  const pendingAppointments = useMemo(
    () => appointments.filter((appt) => appt.status === 'pending'),
    [appointments]
  );

  const activeAppointments = useMemo(
    () => {
      const evaluationTime = new Date();
      return (
      appointments.filter(
        (appt) =>
          appt.status !== 'pending' &&
          appt.status !== 'completed' &&
          appt.status !== 'rejected' &&
          !isAwaitingDoctorNotes(appt, evaluationTime)
      )
      );
    },
    [appointments]
  );

  const awaitingDoctorNotesAppointments = useMemo(
    () => {
      const evaluationTime = new Date();
      return appointments.filter((appt) => isAwaitingDoctorNotes(appt, evaluationTime));
    },
    [appointments]
  );

  const historyAppointments = useMemo(
    () =>
      appointments
        .filter((appt) => appt.status === 'completed' || appt.status === 'rejected')
        .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    [appointments]
  );
  const historyMonthOptions = useMemo(() => {
    const uniqueMonths = Array.from(new Set(historyAppointments.map((appt) => appt.date.slice(0, 7)).filter(Boolean)));
    return uniqueMonths.sort((a, b) => b.localeCompare(a));
  }, [historyAppointments]);
  const filteredHistoryAppointments = useMemo(() => {
    const filtered = historyAppointments.filter((appt) => {
      if (historyStatusFilter !== 'all' && appt.status !== historyStatusFilter) return false;
      if (historyMonthFilter !== 'all' && appt.date.slice(0, 7) !== historyMonthFilter) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const comparison = `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
      return historySort === 'newest' ? comparison : -comparison;
    });

    return sorted;
  }, [historyAppointments, historyMonthFilter, historySort, historyStatusFilter]);

  const handleBookAppointment = async () => {
    if (!user?.id || !form.date || !form.time) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: user.id,
          doctorId: doctorId || undefined,
          date: form.date,
          time: form.time,
          notes: form.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to book appointment');
      }

      setAppointments((prev) => [...prev, mapAppointment(data.appointment)]);
      setForm((prev) => ({
        ...prev,
        date: toLocalDateString(new Date()),
        time: '',
        notes: '',
      }));
      setOpen(false);

      toast({
        title: 'Request sent',
        description: 'Appointment request sent to your doctor',
      });
    } catch (error: unknown) {
      console.error('Book appointment error:', error);
      toast({
        title: 'Booking failed',
        description: getErrorMessage(error, 'Unable to book appointment'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-accent/40">
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div>
              <h1 className="text-2xl font-bold">Appointments</h1>
              <p className="text-muted-foreground">View and manage your doctor appointments</p>
              {loading && <p className="mt-1 text-xs text-muted-foreground">Loading appointments...</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={view === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('list')}
                className="gap-2"
              >
                <List className="h-4 w-4" />
                List
              </Button>
              <Button
                variant={view === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('calendar')}
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                Calendar
              </Button>
              <Button onClick={() => setOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Book
              </Button>
              <Button
                variant={historyDialogOpen ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHistoryDialogOpen(true)}
                className="gap-2"
              >
                <History className="h-4 w-4" />
                History
              </Button>
            </div>
          </div>
        </div>

        {view === 'list' && (
          <div className="space-y-8">
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Pending Request Appointments</h2>

              {pendingAppointments.length === 0 ? (
                <EmptyCard text="Pending appointment requests will appear here." />
              ) : (
                pendingAppointments.map((appt) => (
                  <Card key={String(appt.id)}>
                    <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <AppointmentSummary appointment={appt} />
                      <span className="text-xs font-medium text-warning">Pending</span>
                    </CardContent>
                  </Card>
                ))
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Upcoming Appointments</h2>

              {activeAppointments.length === 0 ? (
                <EmptyCard text="No approved upcoming appointments found." />
              ) : (
                activeAppointments.map((appt) => (
                  <Card key={String(appt.id)}>
                    <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <AppointmentSummary appointment={appt} />
                      <span
                        className={`text-xs font-medium ${statusClass(
                          isAwaitingDoctorNotes(appt, currentDateTime) ? 'awaiting_notes' : appt.status
                        )}`}
                      >
                        {getStatusLabel(appt, currentDateTime)}
                      </span>
                    </CardContent>
                  </Card>
                ))
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Awaiting Doctor Notes</h2>

              {awaitingDoctorNotesAppointments.length === 0 ? (
                <EmptyCard text="Completed appointments waiting for doctor notes will appear here." />
              ) : (
                awaitingDoctorNotesAppointments.map((appt) => (
                  <Card key={String(appt.id)}>
                    <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <AppointmentSummary appointment={appt} />
                      <span className="text-xs font-medium text-warning">Awaiting doctor notes</span>
                    </CardContent>
                  </Card>
                ))
              )}
            </section>

          </div>
        )}

        {view === 'calendar' && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={goPrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <p className="font-medium">{monthName}</p>

                <Button variant="outline" size="sm" onClick={goNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-sm">
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day
                    .toString()
                    .padStart(2, '0')}`;

                  const hasAppointment = appointments.some((a) => a.date === dateStr);

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`rounded-lg border p-2 ${
                        hasAppointment ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                      } ${selectedDate === dateStr ? 'ring-2 ring-primary' : ''}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Appointments on {selectedDate}</p>

                  {appointmentsByDate.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No appointments on this day.</p>
                  ) : (
                    appointmentsByDate.map((appt) => (
                      <div key={String(appt.id)} className="space-y-2 rounded-lg bg-accent/40 p-3 text-sm">
                        <div className="flex justify-between gap-3">
                          <span>
                            {appt.time} · {appt.doctorName}
                          </span>
                          <span
                            className={`text-xs ${statusClass(
                              isAwaitingDoctorNotes(appt, currentDateTime) ? 'awaiting_notes' : appt.status
                            )}`}
                          >
                            {getStatusLabel(appt, currentDateTime)}
                          </span>
                        </div>
                        {appt.patientNotes && (
                          <p className="text-xs text-muted-foreground">Your note: {appt.patientNotes}</p>
                        )}
                        {appt.doctorNotes && (
                          <p className="text-xs text-muted-foreground">Doctor note: {appt.doctorNotes}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Book New Appointment</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Doctor</Label>
                <Input value={form.doctor} readOnly />
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Available Time</Label>
                <div className="grid grid-cols-3 gap-2">
                  {availableTimes.map((time) => (
                    <Button
                      key={time}
                      type="button"
                      size="sm"
                      variant={form.time === time ? 'default' : 'outline'}
                      onClick={() => setForm((prev) => ({ ...prev, time }))}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  placeholder="Any symptoms or notes"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <Button className="w-full" onClick={handleBookAppointment} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Confirm Appointment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Appointment History</DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value as typeof historyStatusFilter)}
                className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="all">All status</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={historyMonthFilter}
                onChange={(e) => setHistoryMonthFilter(e.target.value)}
                className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="all">All months</option>
                {historyMonthOptions.map((month) => (
                  <option key={month} value={month}>
                    {new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </option>
                ))}
              </select>
              <select
                value={historySort}
                onChange={(e) => setHistorySort(e.target.value as typeof historySort)}
                className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            <div className="max-h-[58vh] overflow-y-auto pr-2">
              <div className="space-y-4">
                {filteredHistoryAppointments.length === 0 ? (
                  <EmptyCard text="No history matches the selected filters." />
                ) : (
                  filteredHistoryAppointments.map((appt) => (
                    <Card key={String(appt.id)}>
                      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                        <AppointmentSummary appointment={appt} />
                        <div className="flex items-center gap-2 text-xs font-medium text-primary">
                          <FileText className="h-4 w-4" />
                          History
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
