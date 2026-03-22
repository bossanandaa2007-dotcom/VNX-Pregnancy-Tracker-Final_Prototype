import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  User,
  LogOut,
  Heart,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { fetchUnreadCount } from '@/lib/doctorChat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { API_BASE } from '@/config/api';
import { doctorNavItems } from '@/components/layout/doctor/doctorNavConfig';

type AppointmentApiShape = {
  status?: string;
  date?: string;
  time?: string;
  doctorNotes?: string;
};

const parseAppointmentDateTime = (appointment: Pick<AppointmentApiShape, 'date' | 'time'>) => {
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

const isAwaitingDoctorNotes = (appointment: AppointmentApiShape, now: Date) => {
  if (appointment.status !== 'approved' || appointment.doctorNotes) return false;
  const appointmentDateTime = parseAppointmentDateTime(appointment);
  return appointmentDateTime ? appointmentDateTime.getTime() <= now.getTime() : false;
};

export function DoctorSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [appointmentBadgeCount, setAppointmentBadgeCount] = useState(0);
  const [resolvedPhoto, setResolvedPhoto] = useState(user?.profilePhoto || '');

  useEffect(() => {
    setResolvedPhoto(user?.profilePhoto || '');
  }, [user?.profilePhoto]);

  useEffect(() => {
    const loadUnread = async () => {
      if (!user?.id) return;
      try {
        const count = await fetchUnreadCount(user.id);
        setUnreadChatCount(count);
      } catch (err) {
        console.error('Unread count error:', err);
      }
    };

    loadUnread();
    const id = setInterval(loadUnread, 4000);
    return () => clearInterval(id);
  }, [user?.id]);

  useEffect(() => {
    const loadPendingAppointments = async () => {
      if (!user?.id || user.role !== 'doctor') return;
      try {
        const res = await fetch(`${API_BASE}/api/appointments/doctor/${user.id}`);
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || 'Failed to fetch appointments');
        }

        const now = new Date();
        const pendingCount = (data.appointments || []).filter(
          (appointment: AppointmentApiShape) => appointment.status === 'pending'
        ).length;
        const awaitingNotesCount = (data.appointments || []).filter((appointment: AppointmentApiShape) =>
          isAwaitingDoctorNotes(appointment, now)
        ).length;
        setAppointmentBadgeCount(pendingCount + awaitingNotesCount);
      } catch (err) {
        console.error('Pending appointment count error:', err);
      }
    };

    loadPendingAppointments();
    const id = setInterval(loadPendingAppointments, 4000);
    return () => clearInterval(id);
  }, [user?.id, user?.role]);

  useEffect(() => {
    const loadProfilePhoto = async () => {
      if (!user?.id || user?.profilePhoto) return;

      try {
        const res = await fetch(`${API_BASE}/api/auth/doctor/${user.id}`);
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success && data?.doctor?.profilePhoto) {
          setResolvedPhoto(data.doctor.profilePhoto);
        }
      } catch (error) {
        console.error('Doctor sidebar photo fetch error:', error);
      }
    };

    void loadProfilePhoto();
  }, [user?.id, user?.profilePhoto]);

  return (
    <aside className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-border bg-sidebar">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Heart className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">VNX</h1>
              <p className="text-xs text-muted-foreground">Pregnancy Tracker</p>
            </div>
          </div>
        </div>

        <div className="border-b p-4">
          <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 p-3">
            <Avatar className="h-10 w-10 rounded-full bg-primary/10">
              <AvatarImage src={resolvedPhoto} alt={user?.name || 'Profile'} className="object-cover" />
              <AvatarFallback className="bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs capitalize text-muted-foreground">{user?.role}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {doctorNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-sidebar-accent'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  {item.label}
                </div>

                {item.badgeType === 'chat' && unreadChatCount > 0 && (
                  <span
                    className="
                    flex h-5 min-w-[20px] items-center justify-center
                    rounded-full bg-primary px-1.5
                    text-[11px] font-medium text-primary-foreground
                  "
                  >
                    {unreadChatCount}
                  </span>
                )}

                {item.badgeType === 'appointments' && appointmentBadgeCount > 0 && (
                  <span
                    className="
                    flex h-5 min-w-[20px] items-center justify-center
                    rounded-full bg-primary px-1.5
                    text-[11px] font-medium text-primary-foreground
                  "
                  >
                    {appointmentBadgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
