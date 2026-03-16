import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Users, LogOut, Stethoscope, CalendarClock, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API_BASE } from '@/config/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Doctor {
  _id: string;
  name: string;
  email: string;
  specialty?: string;
  profilePhoto?: string;
}

interface AppointmentHistory {
  id?: string;
  _id?: string;
  patientName?: string;
  date?: string;
  time?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'completed';
  notes?: string;
}

interface ApprovalHistory {
  _id: string;
  requestType: 'patient_create' | 'guide_create' | 'guide_update' | 'guide_delete';
  status: 'pending' | 'approved' | 'rejected';
  requestNote?: string;
  adminNote?: string;
  decisionAt?: string;
  createdAt?: string;
  payload?: any;
}

const getMonthKey = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getYearKey = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return String(date.getFullYear());
};

const approvalTypeLabel: Record<ApprovalHistory['requestType'], string> = {
  patient_create: 'Patient Create',
  guide_create: 'Guide Create',
  guide_update: 'Guide Edit',
  guide_delete: 'Guide Delete',
};

export default function AdminDoctorProfile() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toast } = useToast();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [patientCount, setPatientCount] = useState(0);
  const [appointments, setAppointments] = useState<AppointmentHistory[]>([]);
  const [approvals, setApprovals] = useState<ApprovalHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'appointments' | 'approvals' | null>(null);
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'completed'>('all');
  const [appointmentMonthFilter, setAppointmentMonthFilter] = useState<'all' | string>('all');
  const [appointmentYearFilter, setAppointmentYearFilter] = useState<'all' | string>('all');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [approvalTypeFilter, setApprovalTypeFilter] = useState<'all' | ApprovalHistory['requestType']>('all');
  const [approvalMonthFilter, setApprovalMonthFilter] = useState<'all' | string>('all');
  const [approvalYearFilter, setApprovalYearFilter] = useState<'all' | string>('all');

  const parseErrorMessage = (data: any, fallback: string) =>
    data?.message || data?.error || fallback;

  const fetchDoctorApprovals = async (id: string) => {
    const compat = await fetch(`${API_BASE}/api/auth/doctor/${id}/approval-history`);
    const compatData = await compat.json().catch(() => null);
    if (compat.ok && compatData?.success) {
      return compatData.requests || [];
    }

    const primary = await fetch(`${API_BASE}/api/approvals/doctor/${id}`);
    const primaryData = await primary.json().catch(() => null);
    if (primary.ok && primaryData?.success) {
      return primaryData.requests || [];
    }

    const fallback = await fetch(`${API_BASE}/api/auth/approvals/doctor/${id}`);
    const fallbackData = await fallback.json().catch(() => null);
    if (fallback.ok && fallbackData?.success) {
      return fallbackData.requests || [];
    }

    throw new Error(
      parseErrorMessage(
        fallbackData || primaryData || compatData,
        `Failed to fetch approval history (${fallback.status || primary.status || compat.status})`
      )
    );
  };

  const statusClass = (status?: string) => {
    if (status === 'approved' || status === 'completed') return 'bg-green-100 text-green-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  };

  const sortedAppointments = useMemo(
    () => [...appointments].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [appointments]
  );

  const appointmentCount = appointments.length;
  const approvalCount = approvals.length;
  const appointmentMonthOptions = useMemo(() => {
    const uniqueMonths = Array.from(new Set(appointments.map((item) => getMonthKey(item.date)).filter(Boolean)));
    return uniqueMonths.sort((a, b) => b.localeCompare(a));
  }, [appointments]);
  const appointmentYearOptions = useMemo(() => {
    const uniqueYears = Array.from(new Set(appointments.map((item) => getYearKey(item.date)).filter(Boolean)));
    return uniqueYears.sort((a, b) => b.localeCompare(a));
  }, [appointments]);
  const approvalMonthOptions = useMemo(() => {
    const uniqueMonths = Array.from(new Set(approvals.map((item) => getMonthKey(item.createdAt)).filter(Boolean)));
    return uniqueMonths.sort((a, b) => b.localeCompare(a));
  }, [approvals]);
  const approvalYearOptions = useMemo(() => {
    const uniqueYears = Array.from(new Set(approvals.map((item) => getYearKey(item.createdAt)).filter(Boolean)));
    return uniqueYears.sort((a, b) => b.localeCompare(a));
  }, [approvals]);

  const filteredAppointments = useMemo(() => {
    const rows = sortedAppointments.filter(
      (item) => appointmentStatusFilter === 'all' || item.status === appointmentStatusFilter
    ).filter((item) => appointmentMonthFilter === 'all' || getMonthKey(item.date) === appointmentMonthFilter)
     .filter((item) => appointmentYearFilter === 'all' || getYearKey(item.date) === appointmentYearFilter);

    return [...rows].sort((a, b) => {
      const aTime = new Date(`${a.date || ''} ${a.time || ''}`).getTime();
      const bTime = new Date(`${b.date || ''} ${b.time || ''}`).getTime();
      return bTime - aTime;
    });
  }, [sortedAppointments, appointmentMonthFilter, appointmentStatusFilter, appointmentYearFilter]);

  const filteredApprovals = useMemo(() => {
    const rows = approvals
      .filter((item) => approvalStatusFilter === 'all' || item.status === approvalStatusFilter)
      .filter((item) => approvalTypeFilter === 'all' || item.requestType === approvalTypeFilter)
      .filter((item) => approvalMonthFilter === 'all' || getMonthKey(item.createdAt) === approvalMonthFilter)
      .filter((item) => approvalYearFilter === 'all' || getYearKey(item.createdAt) === approvalYearFilter);

    return [...rows].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [approvals, approvalMonthFilter, approvalStatusFilter, approvalTypeFilter, approvalYearFilter]);

  useEffect(() => {
    if (!doctorId) return;

    const fetchDoctorData = async () => {
      try {
        setLoading(true);

        const [doctorRes, patientRes, appointmentRes] = await Promise.all([
          fetch(`${API_BASE}/api/auth/admin/doctors`),
          fetch(`${API_BASE}/api/auth/doctor/patients/${doctorId}`),
          fetch(`${API_BASE}/api/appointments/doctor/${doctorId}`),
        ]);

        const [doctorData, patientData, appointmentData] = await Promise.all([
          doctorRes.json(),
          patientRes.json(),
          appointmentRes.json(),
        ]);

        if (!doctorRes.ok || !doctorData.success) {
          throw new Error(doctorData.message || 'Failed to fetch doctors');
        }

        const foundDoctor = doctorData.doctors.find((d: Doctor) => d._id === doctorId);
        if (!foundDoctor) throw new Error('Doctor not found');
        setDoctor(foundDoctor);

        if (!patientRes.ok || !patientData.success) {
          throw new Error(patientData.message || 'Failed to fetch patients');
        }
        setPatientCount((patientData.patients || []).length);

        if (appointmentRes.ok && appointmentData.success) {
          setAppointments(appointmentData.appointments || []);
        } else {
          setAppointments([]);
        }

        const approvalRows = await fetchDoctorApprovals(doctorId);
        setApprovals(approvalRows);
      } catch (error: any) {
        console.error(error);
        toast({
          title: 'Error',
          description: error?.message || 'Failed to load doctor profile',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDoctorData();
  }, [doctorId, toast]);

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading doctor profile...</div>;
  }

  if (!doctor) {
    return <div className="p-6 text-center text-muted-foreground">Doctor not found</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 rounded-2xl bg-primary/10 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Doctor Profile</h1>
            <p className="text-muted-foreground">View doctor details, appointments, and approvals</p>
          </div>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 rounded-xl bg-primary/10">
                <AvatarImage src={doctor.profilePhoto} alt={doctor.name} className="object-cover" />
                <AvatarFallback className="rounded-xl bg-primary/10">
                  <Stethoscope className="h-7 w-7 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">{doctor.name}</h2>
                <p className="text-sm text-muted-foreground">{doctor.specialty || '-'}</p>
                <p className="text-sm text-muted-foreground">{doctor.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span>{patientCount} patients assigned</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2" onClick={() => navigate('/admin/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>

              <Button className="gap-2" onClick={() => navigate(`/admin/doctors/${doctor._id}/patients`)}>
                <Users className="h-4 w-4" />
                View Patients
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              setActiveSection((current) => (current === 'appointments' ? null : 'appointments'))
            }
            className={`rounded-3xl border p-6 text-left transition-colors ${
              activeSection === 'appointments'
                ? 'border-primary/30 bg-primary/10'
                : 'border-border bg-card hover:bg-accent/30'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-foreground">No of appointments</p>
                <p className="mt-2 text-4xl font-bold text-foreground">{appointmentCount}</p>
                <p className="mt-3 text-sm text-muted-foreground">Click to review appointment history</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3">
                <CalendarClock className="h-6 w-6 text-primary" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveSection((current) => (current === 'approvals' ? null : 'approvals'))
            }
            className={`rounded-3xl border p-6 text-left transition-colors ${
              activeSection === 'approvals'
                ? 'border-primary/30 bg-primary/10'
                : 'border-border bg-card hover:bg-accent/30'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-foreground">No of approvals</p>
                <p className="mt-2 text-4xl font-bold text-foreground">{approvalCount}</p>
                <p className="mt-3 text-sm text-muted-foreground">Click to review approval history</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
            </div>
          </button>
        </div>

        {activeSection && (
          <Card className="rounded-2xl">
            <CardContent className="space-y-5 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  {activeSection === 'appointments' ? (
                    <CalendarClock className="h-5 w-5 text-primary" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  )}
                  <h3 className="text-lg font-semibold">
                    {activeSection === 'appointments' ? 'Appointment History' : 'Approval History'}
                  </h3>
                </div>

                {activeSection === 'appointments' ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Select
                      value={appointmentStatusFilter}
                      onValueChange={(value) => setAppointmentStatusFilter(value as typeof appointmentStatusFilter)}
                    >
                      <SelectTrigger className="w-full rounded-xl sm:w-44">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={appointmentMonthFilter}
                      onValueChange={(value) => setAppointmentMonthFilter(value)}
                    >
                      <SelectTrigger className="w-full rounded-xl sm:w-44">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All months</SelectItem>
                        {appointmentMonthOptions.map((month) => (
                          <SelectItem key={month} value={month}>
                            {new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
                              month: 'long',
                              year: 'numeric',
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={appointmentYearFilter}
                      onValueChange={(value) => setAppointmentYearFilter(value)}
                    >
                      <SelectTrigger className="w-full rounded-xl sm:w-36">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All years</SelectItem>
                        {appointmentYearOptions.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Select
                      value={approvalStatusFilter}
                      onValueChange={(value) => setApprovalStatusFilter(value as typeof approvalStatusFilter)}
                    >
                      <SelectTrigger className="w-full rounded-xl sm:w-44">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={approvalTypeFilter}
                      onValueChange={(value) => setApprovalTypeFilter(value as typeof approvalTypeFilter)}
                    >
                      <SelectTrigger className="w-full rounded-xl sm:w-44">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="patient_create">Patient Create</SelectItem>
                        <SelectItem value="guide_create">Guide Create</SelectItem>
                        <SelectItem value="guide_update">Guide Edit</SelectItem>
                        <SelectItem value="guide_delete">Guide Delete</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={approvalMonthFilter}
                      onValueChange={(value) => setApprovalMonthFilter(value)}
                    >
                      <SelectTrigger className="w-full rounded-xl sm:w-44">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All months</SelectItem>
                        {approvalMonthOptions.map((month) => (
                          <SelectItem key={month} value={month}>
                            {new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
                              month: 'long',
                              year: 'numeric',
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={approvalYearFilter}
                      onValueChange={(value) => setApprovalYearFilter(value)}
                    >
                      <SelectTrigger className="w-full rounded-xl sm:w-36">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All years</SelectItem>
                        {approvalYearOptions.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                  </div>
                )}
              </div>

              {activeSection === 'appointments' ? (
                filteredAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No appointment history matches the selected filters.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredAppointments.map((item) => (
                      <div key={item._id || item.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{item.patientName || 'Unknown patient'}</p>
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                            {String(item.status || 'pending')}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.date || '-'} {item.time ? `at ${item.time}` : ''}
                        </p>
                        {!!item.notes && <p className="mt-2 text-sm">Notes: {item.notes}</p>}
                      </div>
                    ))}
                  </div>
                )
              ) : filteredApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approval history matches the selected filters.</p>
              ) : (
                <div className="space-y-3">
                  {filteredApprovals.map((item) => (
                    <div key={item._id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{approvalTypeLabel[item.requestType]}</p>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Requested: {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                      </p>
                      {item.decisionAt && (
                        <p className="text-sm text-muted-foreground">
                          Decided: {new Date(item.decisionAt).toLocaleString()}
                        </p>
                      )}
                      {item.requestNote && <p className="mt-2 text-sm">Doctor note: {item.requestNote}</p>}
                      {item.adminNote && <p className="text-sm">Admin note: {item.adminNote}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
