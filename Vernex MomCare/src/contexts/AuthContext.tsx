import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import { API_BASE } from "@/config/api";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<User>;
  logout: () => void;
  updateUser: (patch: Partial<User> & Record<string, any>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('vnx_user');
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });

  const login = async (email: string, password: string, role: UserRole) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed');
      }

      /* ================= ADMIN ================= */
      if (data.role === 'admin') {
        const nextUser: User = {
          id: 'admin',
          name: 'Admin',
          email: email,
          role: 'admin',
        };
        setUser(nextUser);
        localStorage.setItem('vnx_user', JSON.stringify(nextUser));
        return nextUser;
      }

      /* ================= DOCTOR / PATIENT ================= */
      if (!data.user) {
        throw new Error('User object missing in login response');
      }

      const realId = data.user._id || data.user.id;

      if (!realId) {
        console.error('USER OBJECT =>', data.user);
        throw new Error('User ID missing in login response');
      }

      const nextUser: User & Record<string, any> = {
        id: realId, // works for both _id and id
        name: data.user.name,
        email: data.user.email,
        role: data.role,
        specialty: data.user.specialty,
        phone: data.user.phone,
        qualification: data.user.qualification,
        experience: data.user.experience,
        hospital: data.user.hospital,
        location: data.user.location,
        age: data.user.age,
        pregnancyStartDate: data.user.pregnancyStartDate,
        gestationalWeek: data.user.gestationalWeek,
        contactPhone: data.user.contactPhone,
        riskStatus: data.user.riskStatus,
        doctorId: data.user.doctorId,
        husbandPhone: data.user.husbandPhone,
        profilePhoto: data.user.profilePhoto,
      };

      setUser(nextUser);
      localStorage.setItem('vnx_user', JSON.stringify(nextUser));
      return nextUser;
    } catch (error: any) {
      console.error('Login error:', error);
      if (error instanceof TypeError) {
        throw new Error(`Cannot reach the backend server at ${API_BASE}. Make sure the backend is running and reachable from this device.`);
      }
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('vnx_user');
  };

  const updateUser = (patch: Partial<User> & Record<string, any>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const nextUser = { ...prev, ...patch };
      localStorage.setItem('vnx_user', JSON.stringify(nextUser));
      return nextUser as User;
    });
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
