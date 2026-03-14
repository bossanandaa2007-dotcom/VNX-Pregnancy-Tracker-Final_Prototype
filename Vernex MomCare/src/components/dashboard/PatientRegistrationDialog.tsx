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
import { Patient } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/config/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatientRegistered: (patient: Patient) => void;
  onRequestSubmitted?: () => void;
}

export function PatientRegistrationDialog({
  open,
  onOpenChange,
  onPatientRegistered: _onPatientRegistered,
  onRequestSubmitted,
}: Props) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: '',
    age: '',
    email: '',
    password: '',
    pregnancyStartDate: '',
    phone: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  const handleChange = (key: keyof typeof form, value: string) => {
    if (key === 'phone') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      setForm((prev) => ({ ...prev, [key]: digitsOnly }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.password || !form.pregnancyStartDate) {
      toast({
        title: 'Missing required fields',
        description: 'Name, Email, Password and Pregnancy Start Date are required.',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: 'Authentication error',
        description: 'Doctor not logged in properly. Please login again.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/doctor/create-patient`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doctorId: user.id,
          name: form.name,
          email: form.email,
          password: form.password,
          age: Number(form.age),
          pregnancyStartDate: form.pregnancyStartDate,
          phone: form.phone,
          notes: form.notes,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to register patient');
      }

      toast({
        title: 'Request sent',
        description: data.message || 'Patient registration request sent to admin for approval.',
      });

      setShowCredentials(true);
      onRequestSubmitted?.();
    } catch (err: any) {
      console.error('Create patient error:', err);
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
      name: '',
      age: '',
      email: '',
      password: '',
      pregnancyStartDate: '',
      phone: '',
      notes: '',
    });
    setShowCredentials(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Register New Patient</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Request patient account creation (requires admin approval)
          </p>
        </DialogHeader>

        {!showCredentials && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Patient Name *</Label>
                <Input
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
              </div>

              <div>
                <Label>Age *</Label>
                <Input
                  placeholder="Years"
                  value={form.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="patient@email.com"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>

            <div>
              <Label>Password *</Label>
              <Input
                type="password"
                placeholder="Set password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pregnancy Start Date *</Label>
                <Input
                  type="date"
                  value={form.pregnancyStartDate}
                  onChange={(e) => handleChange('pregnancyStartDate', e.target.value)}
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

            <div>
              <Label>Medical Notes (Optional)</Label>
              <Input
                placeholder="Any relevant medical history or notes..."
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
              />
            </div>
          </div>
        )}

        {showCredentials && (
          <div className="mt-4 rounded-xl border bg-accent/30 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-primary">
              Patient Login Credentials
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
              Save these credentials now. They will not be shown again.
            </p>

            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigator.clipboard.writeText(
                  `Patient Login\nEmail: ${form.email}\nPassword: ${form.password}`
                )
              }
            >
              Copy Credentials
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            {showCredentials ? 'Close' : 'Cancel'}
          </Button>
          {!showCredentials && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Sending...' : 'Send For Approval'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
