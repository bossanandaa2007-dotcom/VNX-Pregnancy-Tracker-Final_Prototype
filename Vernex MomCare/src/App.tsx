import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ScrollToTop } from "@/components/layout/ScrollToTop";

/* Pages */
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import Guide from "./pages/Guide";
import Library from "./pages/Library";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";
import EditProfile from "./pages/EditProfile";
import Diary from "./pages/Diary";
import DoctorInfo from "./pages/DoctorInfo";
import HospitalInfo from "./pages/HospitalInfo";
import Appointments from "./pages/Appointments";

import DoctorAnalytics from "./pages/DoctorAnalytics";
import DoctorChat from "./pages/DoctorChat";
import DoctorChatRoom from "./pages/DoctorChatRoom";
import DoctorAppointments from "./pages/DoctorAppointments";
import DoctorProfile from "./pages/DoctorProfile";
import DoctorEditProfile from "./pages/DoctorEditProfile";

import AdminDashboard from "./pages/AdminDashboard";
import AdminDoctorDetail from "./pages/AdminDoctorDetail";
import AdminDoctorProfile from "./pages/AdminDoctorProfile";

const queryClient = new QueryClient();

function getHomeRouteForRole(role?: string | null) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "doctor") return "/doctor/dashboard";
  return "/dashboard";
}

/* ---------------- PROTECTED ROUTE ---------------- */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/* ---------------- ROUTES ---------------- */
function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const homeRoute = getHomeRouteForRole(user?.role);

  return (
    <Routes>
      {/* Auth */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={homeRoute} replace /> : <Login />}
      />

      {/* ================= PATIENT ================= */}
      <Route
        path="/patient/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/patients"
        element={
          <ProtectedRoute>
            <Patients />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile/edit"
        element={
          <ProtectedRoute>
            <EditProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/guide"
        element={
          <ProtectedRoute>
            <Guide />
          </ProtectedRoute>
        }
      />

      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <Library />
          </ProtectedRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />

      <Route
        path="/diary"
        element={
          <ProtectedRoute>
            <Diary />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctorinfo"
        element={
          <ProtectedRoute>
            <DoctorInfo />
          </ProtectedRoute>
        }
      />

      <Route
        path="/hospitalinfo"
        element={
          <ProtectedRoute>
            <HospitalInfo />
          </ProtectedRoute>
        }
      />

      <Route
        path="/appointments"
        element={
          <ProtectedRoute>
            <Appointments />
          </ProtectedRoute>
        }
      />

      {/* ================= DOCTOR ================= */}
      <Route
        path="/doctor/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/profile"
        element={
          <ProtectedRoute>
            <DoctorProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/profile/edit"
        element={
          <ProtectedRoute>
            <DoctorEditProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/appointments"
        element={
          <ProtectedRoute>
            <DoctorAppointments />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/analytics"
        element={
          <ProtectedRoute>
            <DoctorAnalytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/analytics/:patientId"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/chat"
        element={
          <ProtectedRoute>
            <DoctorChat />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/chat/:patientId"
        element={
          <ProtectedRoute>
            <DoctorChatRoom />
          </ProtectedRoute>
        }
      />

      {/* ================= ADMIN ================= */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
  path="/admin/doctors/:doctorId"
  element={
    <ProtectedRoute>
      <AdminDoctorProfile />
    </ProtectedRoute>
  }
/>

<Route
  path="/admin/doctors/:doctorId/patients"
  element={
    <ProtectedRoute>
      <AdminDoctorDetail />
    </ProtectedRoute>
  }
/>


      {/* Default */}
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? homeRoute : "/login"} replace />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/* ---------------- APP ROOT ---------------- */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
