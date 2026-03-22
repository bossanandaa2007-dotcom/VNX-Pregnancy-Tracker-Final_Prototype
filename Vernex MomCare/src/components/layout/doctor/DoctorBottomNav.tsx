import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Ellipsis } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUnreadCount } from '@/lib/doctorChat';
import { API_BASE } from '@/config/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  doctorMobileMoreNavItems,
  doctorMobilePrimaryNavItems,
  type DoctorNavItem,
} from '@/components/layout/doctor/doctorNavConfig';

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
  const navigate = useNavigate();
  const location = useLocation();
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

  const moreBadgeCount = useMemo(
    () => unreadChatCount + appointmentBadgeCount,
    [appointmentBadgeCount, unreadChatCount]
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {doctorMobilePrimaryNavItems.map((item) => (
          <BottomItem key={item.path} item={item} />
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] transition ${
                isMoreActive(location.pathname) ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Ellipsis className="h-5 w-5" />
              <span>More</span>
              {moreBadgeCount > 0 ? (
                <span className="absolute right-2 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {moreBadgeCount}
                </span>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-2 w-56 rounded-2xl">
            {doctorMobileMoreNavItems.map((item) => {
              const Icon = item.icon;
              const badgeCount =
                item.badgeType === 'chat'
                  ? unreadChatCount
                  : item.badgeType === 'appointments'
                  ? appointmentBadgeCount
                  : 0;

              return (
                <DropdownMenuItem
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center justify-between rounded-xl px-3 py-3"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  {badgeCount > 0 ? (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                      {badgeCount}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}

function BottomItem({ item }: { item: DoctorNavItem }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] transition ${
          isActive ? 'text-primary' : 'text-muted-foreground'
        }`
      }
    >
      <Icon className="h-5 w-5" />
      <span className="truncate">{getMobileLabel(item.label)}</span>
    </NavLink>
  );
}

function getMobileLabel(label: string) {
  if (label === 'Patient Management') return 'Patients';
  return label;
}

function isMoreActive(pathname: string) {
  return doctorMobileMoreNavItems.some((item) => pathname.startsWith(item.path));
}
