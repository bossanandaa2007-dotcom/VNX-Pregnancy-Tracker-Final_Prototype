import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { API_BASE } from "@/config/api";

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialty: string;
  phone?: string;
  profilePhoto?: string;
  patientCount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDoctorRegistered: (doctor: Doctor) => void;
}

export function RegisterDoctorDialog({
  open,
  onOpenChange,
  onDoctorRegistered,
}: Props) {
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: 'Dr. ',
    email: '',
    password: '',
    specialty: '',
    phone: '',
  });

  const [showCredentials, setShowCredentials] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (key: keyof typeof form, value: string) => {
    if (key === 'phone') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      setForm((prev) => ({ ...prev, [key]: digitsOnly }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.password || !form.specialty) {
      toast({
        title: 'Missing required fields',
        description: 'Name, Email, Password and Specialty are required.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/create-doctor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminEmail: 'admin@vnx.com',
          adminPassword: 'admin123',
          name: form.name,
          email: form.email,
          password: form.password,
          specialty: form.specialty,
          phone: form.phone,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to create doctor');
      }

      const newDoctor: Doctor = {
        id: data.doctor._id,
        name: data.doctor.name,
        email: data.doctor.email,
        specialty: data.doctor.specialty,
        phone: data.doctor.phone,
        profilePhoto: data.doctor.profilePhoto,
        patientCount: 0,
      };

      onDoctorRegistered(newDoctor);
      setShowCredentials(true);

      toast({
        title: 'Doctor registered successfully',
        description: 'Login credentials created for the doctor.',
      });
    } catch (err: any) {
      toast({
        title: 'Registration failed',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm({
      name: 'Dr. ',
      email: '',
      password: '',
      specialty: '',
      phone: '',
    });
    setShowCredentials(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Register New Doctor</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Create a doctor account with login credentials
          </p>
        </DialogHeader>

        {/* FORM */}
        {!showCredentials && (
          <div className="space-y-4">
            <div>
              <Label>Doctor Name *</Label>
              <Input
                placeholder="Full Name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>

            <div>
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="doctor@email.com"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>

            <div>
              <Label>Password *</Label>
              <Input
                type="password"
                placeholder="Set temporary password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Doctor can change this after first login
              </p>
            </div>

            <div>
              <Label>Specialty *</Label>
              <Input
                placeholder="Obstetrics & Gynecology"
                value={form.specialty}
                onChange={(e) => handleChange('specialty', e.target.value)}
              />
            </div>

            <div>
              <Label>Contact Phone</Label>
              <Input
                placeholder="10-digit phone number"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* CREDENTIALS VIEW */}
        {showCredentials && (
          <div className="mt-4 rounded-xl border bg-accent/30 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-primary">
              Doctor Login Credentials
            </h3>

            <p className="text-sm">
              <span className="text-muted-foreground">Email:</span>{' '}
              <span className="font-medium">{form.email}</span>
            </p>

            <p className="text-sm">
              <span className="text-muted-foreground">Password:</span>{' '}
              <span className="font-medium">{form.password}</span>
            </p>

            <p className="text-xs text-muted-foreground">
              ⚠️ Save these credentials now. They will not be shown again.
            </p>

            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigator.clipboard.writeText(
                  `Doctor Login\nEmail: ${form.email}\nPassword: ${form.password}`
                )
              }
            >
              Copy Credentials
            </Button>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            {showCredentials ? 'Close' : 'Cancel'}
          </Button>
          {!showCredentials && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Registering...' : 'Register Doctor'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
