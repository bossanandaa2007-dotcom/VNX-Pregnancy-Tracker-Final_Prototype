import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Mail, Lock, ArrowRight, User, Stethoscope, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [phase, setPhase] = useState<'intro' | 'split' | 'login'>('intro');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('patient');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  /* ---------------- INTRO ANIMATION CONTROL ---------------- */
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;

    if (isMobile) {
      setTimeout(() => setPhase('login'), 3500);
    } else {
      setTimeout(() => setPhase('split'), 3000);
    }
  }, []);

  /* ---------------- LOGIN HANDLER ---------------- */
  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!email || !password) {
    toast({
      title: 'Missing credentials',
      description: 'Please enter your email and password.',
      variant: 'destructive',
    });
    return;
  }

  setIsLoading(true);

  try {
    const user = await login(email, password, selectedRole);

    // ================= ADMIN =================
    if (user.role === 'admin') {
      toast({
        title: 'Welcome Admin',
        description: 'Logged in as System Administrator',
      });

      navigate('/admin/dashboard');
      return;
    }

    if (user.role === 'doctor') {
      toast({
        title: 'Welcome Doctor',
        description: 'Logged in successfully',
      });

      navigate('/doctor/dashboard');
      return;
    }

    // ================= DOCTOR & PATIENT =================
    toast({
      title: 'Welcome',
      description: 'Logged in successfully',
    });

    navigate('/dashboard');
  } catch (error: any) {
    toast({
      title: 'Login failed',
      description: error.message || 'Please check your credentials and try again.',
      variant: 'destructive',
    });
  } finally {
    setIsLoading(false);
  }
};


  return (
    <>
      {/* ================= FULLSCREEN INTRO ================= */}
      {phase === 'intro' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-primary/80">
          <div className="text-center text-white animate-fade-in">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/20 backdrop-blur">
              <Heart className="h-12 w-12 text-white" />
            </div>

            <h1 className="text-4xl font-bold mb-3">VNX Pregnancy Tracker</h1>
            <p className="text-lg text-white/90 mb-6">Unified Care Platform</p>

            <div className="space-y-2 text-white/80 text-sm">
              <p>Doctor-led patient onboarding</p>
              <p>Real-time health tracking</p>
              <p>AI-powered pregnancy support</p>
              <p>Secure doctor-patient communication</p>
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN LAYOUT ================= */}
      {phase !== 'intro' && (
        <div className="min-h-screen flex overflow-hidden">
          {/* -------- LEFT PANEL (DESKTOP ONLY) -------- */}
          <div
            className={cn(
              'hidden lg:flex relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80 transition-all duration-700',
              phase === 'split' ? 'lg:w-1/2 opacity-100' : 'lg:w-full opacity-0'
            )}
          >
            <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm mb-8">
                <Heart className="h-10 w-10 text-white" />
              </div>

              <h1 className="text-4xl font-bold text-white mb-4">
                VNX Pregnancy Tracker
              </h1>
              <p className="text-xl text-white/90 mb-2">Unified Care Platform</p>
              <p className="text-white/70 max-w-md">
                Comprehensive maternal healthcare management connecting doctors and patients for better pregnancy outcomes.
              </p>

              <div className="mt-12 grid gap-4 text-left max-w-sm">
                {[
                  'Doctor-led patient onboarding',
                  'Real-time health tracking',
                  'AI-powered pregnancy support',
                  'Secure doctor-patient communication',
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-white/90">
                    <div className="h-2 w-2 rounded-full bg-white/60" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* -------- RIGHT PANEL (LOGIN) -------- */}
          <div
            className={cn(
              'flex flex-1 flex-col items-center justify-center p-8 lg:p-12 transition-all duration-700',
              phase === 'split' || phase === 'login'
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            )}
          >
            <div className="w-full max-w-md space-y-8">
              {/* Mobile Logo */}
              <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                  <Heart className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">VNX</h1>
                  <p className="text-xs text-muted-foreground">Pregnancy Tracker</p>
                </div>
              </div>

              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-bold">Welcome back</h2>
                <p className="mt-2 text-muted-foreground">
                  Sign in to access your healthcare portal
                </p>
              </div>

              {/* Role Selection */}
              <div className="space-y-3">
                <Label>I am a...</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('doctor')}
                    className={cn(
                      'rounded-xl border-2 p-4 flex flex-col items-center gap-2',
                      selectedRole === 'doctor'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border'
                    )}
                  >
                    <Stethoscope className="h-6 w-6" />
                    Doctor
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('patient')}
                    className={cn(
                      'rounded-xl border-2 p-4 flex flex-col items-center gap-2',
                      selectedRole === 'patient'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border'
                    )}
                  >
                    <User className="h-6 w-6" />
                    Patient
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label>Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <Label>Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-12 h-12 rounded-xl"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 rounded-xl" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
