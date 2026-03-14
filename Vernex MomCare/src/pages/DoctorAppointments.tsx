import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Appointment } from '@/types/appointment';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API_BASE } from '@/config/api';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  History,
} from 'lucide-react';

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
  status?: Appointment['status'];
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

const hasAppointmentEnded = (appointment: Appointment, now: Date) => {
  const appointmentDateTime = parseAppointmentDateTime(appointment);
  return appointmentDateTime ? appointmentDateTime.getTime() <= now.getTime() : appointment.date < now.toISOString().slice(0, 10);
};

const formatMonth = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const mapAppointment = (appt: AppointmentApiShape): Appointment => ({
  id: appt._id || appt.id || `${Date.now()}`,
  patientName: appt.patientName || 'Patient',
  doctorName: appt.doctorName || '',
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

const getPatientNote = (appointment: Pick<Appointment, 'patientNotes' | 'notes'>) =>
  appointment.patientNotes || appointment.notes || '';

function EmptyPlaceholder({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function AppointmentMeta({ appointment }: { appointment: Appointment }) {
  const patientNote = getPatientNote(appointment);

  return (
    <div className="space-y-1">
      <p className="font-medium">{appointment.patientName}</p>
      <p className="text-sm text-muted-foreground">
        {appointment.date} · {appointment.time}
      </p>
      {patientNote && (
        <p className="text-xs text-muted-foreground">Patient note: {patientNote}</p>
      )}
      {appointment.doctorNotes && (
        <p className="text-xs text-muted-foreground">Doctor note: {appointment.doctorNotes}</p>
      )}
    </div>
  );
}

export default function DoctorAppointments() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyPatientFilter, setHistoryPatientFilter] = useState<'all' | string>('all');
  const [historyMonthFilter, setHistoryMonthFilter] = useState<'all' | string>('all');
  const [historyYearFilter, setHistoryYearFilter] = useState<'all' | string>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [doctorNotesDraft, setDoctorNotesDraft] = useState('');
  const [rejectionNoteDraft, setRejectionNoteDraft] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const loadAppointments = async () => {
      if (!user?.id || user.role !== 'doctor') return;
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/appointments/doctor/${user.id}`);
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || 'Unable to load appointments');
        }
        setAppointments((data.appointments || []).map(mapAppointment));
      } catch (error: unknown) {
        console.error('Doctor appointments fetch error:', error);
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

  const updateStatus = async (id: string | number, status: 'approved' | 'rejected', doctorNotes = '') => {
    try {
      const res = await fetch(`${API_BASE}/api/appointments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, doctorNotes }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Unable to update status');
      }

      const updated = mapAppointment(data.appointment);
      setAppointments((prev) => prev.map((a) => (String(a.id) === String(id) ? updated : a)));

      toast({
        title: 'Updated',
        description: `Appointment marked as ${status}`,
      });
    } catch (error: unknown) {
      console.error('Appointment status update error:', error);
      toast({
        title: 'Update failed',
        description: getErrorMessage(error, 'Unable to update appointment status'),
        variant: 'destructive',
      });
    }
  };

  const openRejectModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setRejectionNoteDraft('');
    setRejectModalOpen(true);
  };

  const confirmRejectAppointment = async () => {
    if (!selectedAppointment) return;
    await updateStatus(selectedAppointment.id, 'rejected', rejectionNoteDraft.trim());
    setRejectModalOpen(false);
    setSelectedAppointment(null);
    setRejectionNoteDraft('');
  };

  const openNotesModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setDoctorNotesDraft(appointment.doctorNotes || '');
    setNotesModalOpen(true);
  };

  const saveDoctorNotes = async () => {
    if (!selectedAppointment) return;
    const trimmedNotes = doctorNotesDraft.trim();
    if (!trimmedNotes) {
      toast({
        title: 'Notes required',
        description: 'Add visit notes before moving the appointment to history.',
        variant: 'destructive',
      });
      return;
    }

    setSavingNotes(true);
    try {
      const res = await fetch(`${API_BASE}/api/appointments/${selectedAppointment.id}/doctor-notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorNotes: trimmedNotes }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Unable to save doctor notes');
      }

      const updated = mapAppointment(data.appointment);
      setAppointments((prev) =>
        prev.map((a) => (String(a.id) === String(selectedAppointment.id) ? updated : a))
      );
      setNotesModalOpen(false);
      setSelectedAppointment(null);
      setDoctorNotesDraft('');

      toast({
        title: 'Notes saved',
        description: 'Appointment moved to history.',
      });
    } catch (error: unknown) {
      console.error('Doctor notes save error:', error);
      toast({
        title: 'Save failed',
        description: getErrorMessage(error, 'Unable to save doctor notes'),
        variant: 'destructive',
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const pending = useMemo(() => appointments.filter((a) => a.status === 'pending'), [appointments]);
  const todayAppointments = useMemo(
    () => {
      const evaluationTime = new Date();
      return appointments.filter(
        (a) => a.status === 'approved' && a.date === today && !hasAppointmentEnded(a, evaluationTime)
      );
    },
    [appointments, today]
  );
  const upcoming = useMemo(
    () => {
      const evaluationTime = new Date();
      return appointments.filter(
        (a) =>
          a.status === 'approved' &&
          (parseAppointmentDateTime(a)?.getTime() ?? Number.NEGATIVE_INFINITY) > evaluationTime.getTime() &&
          a.date !== today
      );
    },
    [appointments, today]
  );
  const awaitingNotes = useMemo(
    () => {
      const evaluationTime = new Date();
      return appointments.filter((a) => a.status === 'approved' && hasAppointmentEnded(a, evaluationTime));
    },
    [appointments]
  );
  const history = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'completed' && a.doctorNotes)
        .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    [appointments]
  );
  const historyPatientOptions = useMemo(() => {
    const uniqueNames = Array.from(new Set(history.map((appt) => appt.patientName).filter(Boolean)));
    return uniqueNames.sort((a, b) => a.localeCompare(b));
  }, [history]);
  const historyMonthOptions = useMemo(() => {
    const uniqueMonths = Array.from(
      new Set(
        history
          .map((appt) => appt.date.slice(5, 7))
          .filter((value) => value.length === 2)
      )
    );
    return uniqueMonths.sort((a, b) => a.localeCompare(b));
  }, [history]);
  const historyYearOptions = useMemo(() => {
    const uniqueYears = Array.from(
      new Set(
        history
          .map((appt) => appt.date.slice(0, 4))
          .filter((value) => value.length === 4)
      )
    );
    return uniqueYears.sort((a, b) => b.localeCompare(a));
  }, [history]);
  const filteredHistory = useMemo(() => {
    return history.filter((appt) => {
      if (historyPatientFilter !== 'all' && appt.patientName !== historyPatientFilter) return false;
      if (historyMonthFilter !== 'all' && appt.date.slice(5, 7) !== historyMonthFilter) return false;
      if (historyYearFilter !== 'all' && appt.date.slice(0, 4) !== historyYearFilter) return false;
      return true;
    });
  }, [history, historyMonthFilter, historyPatientFilter, historyYearFilter]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const appointmentsByDate = useMemo(
    () =>
      appointments.reduce<Record<string, Appointment[]>>((acc, appt) => {
        acc[appt.date] = acc[appt.date] || [];
        acc[appt.date].push(appt);
        return acc;
      }, {}),
    [appointments]
  );

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-8">
        <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-accent/40">
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div>
              <h1 className="text-2xl font-bold">Appointments</h1>
              <p className="text-muted-foreground">Manage patient appointment requests and schedules</p>
              {loading && <p className="mt-1 text-xs text-muted-foreground">Loading appointments...</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={view === 'list' ? 'default' : 'outline'} onClick={() => setView('list')}>
                List
              </Button>
              <Button
                size="sm"
                variant={view === 'calendar' ? 'default' : 'outline'}
                onClick={() => setView('calendar')}
                className="gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                Calendar
              </Button>
              <Button
                size="sm"
                variant={historyDialogOpen ? 'default' : 'outline'}
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
          <div className="space-y-10">
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Pending Requests</h2>

              {pending.length > 0 ? (
                pending.map((appt) => (
                  <Card key={String(appt.id)} className="border-l-4 border-primary">
                    <CardContent className="flex items-center justify-between gap-4 p-5">
                      <AppointmentMeta appointment={appt} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateStatus(appt.id, 'approved')}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => openRejectModal(appt)}>
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <EmptyPlaceholder text="No pending appointment requests." />
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Today</h2>

              {todayAppointments.length > 0 ? (
                todayAppointments.map((appt) => (
                  <Card key={String(appt.id)}>
                    <CardContent className="flex items-center justify-between gap-4 p-5">
                      <AppointmentMeta appointment={appt} />
                      <span className="text-xs text-muted-foreground">Add notes after the appointment is completed</span>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <EmptyPlaceholder text="No appointments scheduled for today." />
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Upcoming</h2>

              {upcoming.length > 0 ? (
                upcoming.map((appt) => (
                  <Card key={String(appt.id)}>
                    <CardContent className="flex items-center gap-3 p-5">
                      <Clock className="h-5 w-5 text-primary" />
                      <AppointmentMeta appointment={appt} />
                    </CardContent>
                  </Card>
                ))
              ) : (
                <EmptyPlaceholder text="No upcoming appointments." />
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Awaiting Notes</h2>

              {awaitingNotes.length > 0 ? (
                awaitingNotes.map((appt) => (
                  <Card key={String(appt.id)}>
                    <CardContent className="flex items-center justify-between gap-4 p-5">
                      <AppointmentMeta appointment={appt} />
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => openNotesModal(appt)}>
                        <FileText className="h-4 w-4" />
                        Add Notes
                      </Button>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <EmptyPlaceholder text="No completed visits are waiting for notes." />
              )}
            </section>

          </div>
        )}

        {view === 'calendar' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>
                <ChevronLeft />
              </Button>

              <h2 className="text-lg font-semibold">{formatMonth(currentMonth)}</h2>

              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>
                <ChevronRight />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasAppt = !!appointmentsByDate[dateStr];

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`rounded-xl border p-3 text-sm transition ${
                      hasAppt ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent'
                    } ${selectedDate === dateStr ? 'ring-2 ring-primary' : ''}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {selectedDate && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Appointments on {selectedDate}</p>

                {(appointmentsByDate[selectedDate] || []).length > 0 ? (
                  (appointmentsByDate[selectedDate] || []).map((appt) => {
                    const patientNote = getPatientNote(appt);

                    return (
                    <div key={String(appt.id)} className="space-y-2 rounded-lg bg-accent/40 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span>
                          {appt.time} · {appt.patientName}
                        </span>
                        <span className="text-xs capitalize">{appt.status}</span>
                      </div>
                      {patientNote && (
                        <p className="text-xs text-muted-foreground">Patient note: {patientNote}</p>
                      )}
                      {appt.doctorNotes && (
                        <p className="text-xs text-muted-foreground">Doctor note: {appt.doctorNotes}</p>
                      )}
                      {appt.status === 'approved' && hasAppointmentEnded(appt, new Date()) && (
                        <div>
                          <Button size="sm" variant="outline" onClick={() => openNotesModal(appt)}>
                            Add Notes
                          </Button>
                        </div>
                      )}
                    </div>
                    );
                  })
                ) : (
                  <EmptyPlaceholder text="No appointments on this date." />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Visit Notes</DialogTitle>
            <DialogDescription>
              Save the doctor notes after the consultation. The appointment moves to history only after this step.
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4">
              <div className="rounded-lg bg-accent/40 p-3 text-sm">
                <p className="font-medium">{selectedAppointment.patientName}</p>
                <p className="text-muted-foreground">
                  {selectedAppointment.date} · {selectedAppointment.time}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doctor-notes">Doctor notes</Label>
                <Textarea
                  id="doctor-notes"
                  placeholder="Add consultation notes, next steps, or follow-up advice"
                  value={doctorNotesDraft}
                  onChange={(e) => setDoctorNotesDraft(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesModalOpen(false)} disabled={savingNotes}>
              Cancel
            </Button>
            <Button onClick={saveDoctorNotes} disabled={savingNotes}>
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectModalOpen}
        onOpenChange={(open) => {
          setRejectModalOpen(open);
          if (!open) {
            setSelectedAppointment(null);
            setRejectionNoteDraft('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject Appointment</DialogTitle>
            <DialogDescription>
              Add an optional note so the patient understands why this appointment was rejected.
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4">
              <div className="rounded-lg bg-accent/40 p-3 text-sm">
                <p className="font-medium">{selectedAppointment.patientName}</p>
                <p className="text-muted-foreground">
                  {selectedAppointment.date} · {selectedAppointment.time}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejection-note">Rejection note</Label>
                <Textarea
                  id="rejection-note"
                  placeholder="Optional reason, reschedule suggestion, or next step"
                  value={rejectionNoteDraft}
                  onChange={(e) => setRejectionNoteDraft(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRejectAppointment}>
              Reject Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Appointment History</DialogTitle>
            <DialogDescription>
              Review completed appointments using patient and month/year filters.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-3">
            <select
              value={historyPatientFilter}
              onChange={(e) => setHistoryPatientFilter(e.target.value)}
              className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="all">All patients</option>
              {historyPatientOptions.map((patientName) => (
                <option key={patientName} value={patientName}>
                  {patientName}
                </option>
              ))}
            </select>
            <select
              value={historyMonthFilter}
              onChange={(e) => setHistoryMonthFilter(e.target.value)}
              className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="all">All months</option>
              {historyMonthOptions.map((month) => (
                <option key={month} value={month}>
                  {new Date(`2000-${month}-01T00:00:00`).toLocaleDateString('en-US', {
                    month: 'long',
                  })}
                </option>
              ))}
            </select>
            <select
              value={historyYearFilter}
              onChange={(e) => setHistoryYearFilter(e.target.value)}
              className="rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="all">All years</option>
              {historyYearOptions.map((yearValue) => (
                <option key={yearValue} value={yearValue}>
                  {yearValue}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-[58vh] overflow-y-auto pr-2">
            <div className="space-y-4">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((appt) => (
                  <Card key={String(appt.id)}>
                    <CardContent className="p-5">
                      <AppointmentMeta appointment={appt} />
                    </CardContent>
                  </Card>
                ))
              ) : (
                <EmptyPlaceholder text="No history matches the selected filters." />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
