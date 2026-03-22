import {
  BarChart3,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  Library,
  MessageCircle,
  User,
  Users,
} from 'lucide-react';

export type DoctorNavBadgeType = 'chat' | 'appointments';

export interface DoctorNavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badgeType?: DoctorNavBadgeType;
}

export const doctorNavItems: DoctorNavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Patient Management', path: '/patients' },
  { icon: BarChart3, label: 'Analytics', path: '/doctor/analytics' },
  { icon: MessageCircle, label: 'Chat', path: '/doctor/chat', badgeType: 'chat' },
  { icon: CalendarDays, label: 'Appointments', path: '/doctor/appointments', badgeType: 'appointments' },
  { icon: BookOpen, label: 'Guide', path: '/guide' },
  { icon: Library, label: 'Library', path: '/library' },
  { icon: User, label: 'Profile', path: '/doctor/profile' },
];

export const doctorMobilePrimaryNavItems: DoctorNavItem[] = [
  doctorNavItems[0],
  doctorNavItems[1],
  doctorNavItems[6],
  doctorNavItems[7],
];

export const doctorMobileMoreNavItems: DoctorNavItem[] = [
  doctorNavItems[2],
  doctorNavItems[3],
  doctorNavItems[4],
  doctorNavItems[5],
];
