import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageCircle, CalendarDays, User, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUnreadCount } from '@/lib/doctorChat';
import { API_BASE } from '@/config/api';

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

export function DoctorBottomNav() {
  const { user } = useAuth();
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [appointmentBadgeCount, setAppointmentBadgeCount] = useState(0);

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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background lg:hidden">
      <div className="flex justify-around py-3">
        <BottomItem to="/dashboard" icon={LayoutDashboard} />

        <div className="relative">
          <BottomItem to="/doctor/chat" icon={MessageCircle} />
          {unreadChatCount > 0 && (
            <span
              className="
              absolute bottom-0 right-1
              flex h-4 min-w-[16px] items-center justify-center
              rounded-full bg-primary
              text-[10px] font-medium text-primary-foreground
            "
            >
              {unreadChatCount}
            </span>
          )}
        </div>

        <div className="relative">
          <BottomItem to="/doctor/appointments" icon={CalendarDays} />
          {appointmentBadgeCount > 0 && (
            <span
              className="
              absolute bottom-0 right-1
              flex h-4 min-w-[16px] items-center justify-center
              rounded-full bg-primary
              text-[10px] font-medium text-primary-foreground
            "
            >
              {appointmentBadgeCount}
            </span>
          )}
        </div>
        <BottomItem to="/guide" icon={BookOpen} />
        <BottomItem to="/doctor/profile" icon={User} />
      </div>
    </nav>
  );
}

function BottomItem({ to, icon: Icon }: { to: string; icon: any }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-1 px-3 py-1 text-xs transition
        ${isActive ? 'text-primary' : 'text-muted-foreground'}`
      }
    >
      <Icon className="h-6 w-6" />
    </NavLink>
  );
}
