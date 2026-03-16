import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  User,
  ArrowLeft,
  LogOut,
  Calendar,
  Phone,
  Mail,
  MessageCircle,
  BarChart3,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API_BASE } from '@/config/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PatientItem {
  _id: string;
  name: string;
  email?: string;
  age?: number;
  profilePhoto?: string;
  pregnancyStartDate?: string;
  gestationalWeek: number;
  riskStatus: 'normal' | 'attention' | 'high-risk';
  contactPhone?: string;
  medicalNotes?: string;
}

interface ThreadMessage {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
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

export default function AdminDoctorDetail() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toast } = useToast();

  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState<PatientItem | null>(null);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const progressPercent = useMemo(
    () => Math.min(((selectedPatient?.gestationalWeek || 0) / 40) * 100, 100),
    [selectedPatient?.gestationalWeek]
  );

  useEffect(() => {
    if (!doctorId) return;

    const fetchPatients = async () => {
      try {
        setLoading(true);

        const res = await fetch(`${API_BASE}/api/auth/doctor/patients/${doctorId}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load patients');
        }

        setPatients(data.patients || []);
      } catch (error: any) {
        console.error(error);
        toast({
          title: 'Error',
          description: error?.message || 'Failed to load patients',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [doctorId, toast]);

  const openPatientDialog = async (patient: PatientItem) => {
    if (!doctorId) return;
    setSelectedPatient(patient);
    setPatientDialogOpen(true);
    setThreadLoading(true);

    try {
      const [patientRes, threadRes] = await Promise.all([
        fetch(`${API_BASE}/api/auth/patient/${patient._id}`),
        fetch(`${API_BASE}/api/messages/thread?userId=${doctorId}&peerId=${patient._id}&readonly=true`),
      ]);

      const [patientData, threadData] = await Promise.all([patientRes.json(), threadRes.json()]);

      if (patientRes.ok && patientData?.success && patientData?.patient) {
        setSelectedPatient(patientData.patient);
      }

      if (threadRes.ok && threadData?.success) {
        setThread(Array.isArray(threadData.messages) ? threadData.messages : []);
      } else {
        setThread([]);
      }
    } catch (err) {
      console.error(err);
      setThread([]);
    } finally {
      setThreadLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 rounded-2xl bg-primary/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary">Doctor Patients</h1>
              <p className="text-muted-foreground">Patients handled by selected doctor</p>
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

          <Button
            variant="ghost"
            className="w-fit gap-2"
            onClick={() => navigate(`/admin/doctors/${doctorId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Doctor Profile
          </Button>
        </div>

        <div className="space-y-4">
          {loading && <p className="text-muted-foreground">Loading patients...</p>}

          {!loading && patients.length === 0 && (
            <p className="text-muted-foreground text-center">No patients assigned to this doctor yet</p>
          )}

          {patients.map((p) => (
            <Card key={p._id} className="hover:shadow-sm transition cursor-pointer" onClick={() => openPatientDialog(p)}>
              <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="h-10 w-10 rounded-full bg-primary/10">
                  <AvatarImage src={p.profilePhoto} alt={p.name} className="object-cover" />
                  <AvatarFallback className="bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">Week {p.gestationalWeek}</p>
                </div>

                <span
                  className={`text-xs font-medium rounded-full px-3 py-1 ${
                    p.riskStatus === 'high-risk'
                      ? 'bg-destructive/10 text-destructive'
                      : p.riskStatus === 'attention'
                      ? 'bg-warning/10 text-warning'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {p.riskStatus === 'high-risk' ? 'High Risk' : p.riskStatus === 'attention' ? 'Attention' : 'Normal'}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedPatient && (
          <Dialog open={patientDialogOpen} onOpenChange={setPatientDialogOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14 rounded-xl bg-primary/10">
                    <AvatarImage src={selectedPatient.profilePhoto} alt={selectedPatient.name} className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-primary/10">
                      <User className="h-7 w-7 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <DialogTitle className="text-xl">{selectedPatient.name}</DialogTitle>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-muted-foreground">
                        Age {selectedPatient.age || '-'} • Week {selectedPatient.gestationalWeek || 0}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn('gap-1', riskStatusConfig[selectedPatient.riskStatus || 'normal'].className)}
                      >
                        {(() => {
                          const RiskIcon = riskStatusConfig[selectedPatient.riskStatus || 'normal'].icon;
                          return <RiskIcon className="h-3 w-3" />;
                        })()}
                        {riskStatusConfig[selectedPatient.riskStatus || 'normal'].label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="chat">Chat History</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <p className="font-medium text-sm text-muted-foreground">Contact Information</p>
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedPatient.email || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedPatient.contactPhone || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Started:{' '}
                          {selectedPatient.pregnancyStartDate
                            ? new Date(selectedPatient.pregnancyStartDate).toLocaleDateString()
                            : 'Not available'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <p className="font-medium">Week {selectedPatient.gestationalWeek || 0} of 40</p>
                      <div className="h-2 w-full rounded-full bg-accent overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">{Math.round(progressPercent)}% complete</p>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => navigate(`/doctor/analytics/${selectedPatient._id}`)}
                    >
                      <BarChart3 className="h-4 w-4" />
                      View Analytics
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="font-medium text-sm text-muted-foreground mb-2">Medical Notes</p>
                      <div className="rounded-xl bg-accent/30 p-4 min-h-24 text-sm">
                        {selectedPatient.medicalNotes || 'No medical notes recorded yet.'}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="chat" className="mt-4">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-primary" />
                        <p className="font-medium">Doctor - Patient Chat History</p>
                      </div>

                      {threadLoading ? (
                        <p className="text-sm text-muted-foreground">Loading chat...</p>
                      ) : thread.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No messages found for this patient.</p>
                      ) : (
                        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                          {thread.map((m) => {
                            const fromDoctor = String(m.senderId) === String(doctorId);
                            return (
                              <div
                                key={m._id}
                                className={cn(
                                  'rounded-xl p-3 text-sm',
                                  fromDoctor ? 'bg-primary/10 ml-8' : 'bg-accent mr-8'
                                )}
                              >
                                <p className="text-xs text-muted-foreground mb-1">
                                  {fromDoctor ? 'Doctor' : selectedPatient.name} •{' '}
                                  {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                                </p>
                                <p>{m.content}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
