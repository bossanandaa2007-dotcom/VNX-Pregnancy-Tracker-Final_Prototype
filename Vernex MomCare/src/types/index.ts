export type UserRole = 'doctor' | 'patient'|'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  profilePhoto?: string;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  age: number;
  profilePhoto?: string;
  pregnancyStartDate: Date;
  gestationalWeek: number;
  contactPhone: string;
  husbandName?: string;
  husbandPhone?: string;
  expectedDueDate?: Date;
  medicalNotes?: string;
  riskStatus: 'normal' | 'attention' | 'high-risk';
  doctorId: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderType: 'user' | 'doctor' | 'ai';
  timestamp: Date;
  isAI?: boolean;
}

export interface HealthEntry {
  date: Date;
  weight?: number;
  mood?: 'great' | 'good' | 'okay' | 'low';
  symptoms?: string[];
  notes?: string;
}

export interface Article {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  imageUrl?: string;
  readTime: number;
  externalLink?: string;
}

export interface GuideItem {
  id?: string;
  _id?: string;
  title: string;
  category: 'diet' | 'exercise' | 'wellness' | 'dos' | 'donts';
  content: string;
  icon?: string;
  source?: 'WHO' | 'MOHFW';
  referenceLink?: string;
  weekStart?: number;
  weekEnd?: number;
  trimester?: 'first' | 'second' | 'third' | 'all';
}

export * from './library';
