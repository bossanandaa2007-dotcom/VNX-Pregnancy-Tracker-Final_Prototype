import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LibraryShellProps {
  title: string;
  subtitle: string;
  role: 'doctor' | 'patient';
  activeModule: 'memories' | 'diary' | 'fitness' | 'music';
  onModuleChange: (value: 'memories' | 'diary' | 'fitness' | 'music') => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  children: React.ReactNode;
}

export function LibraryShell({
  title,
  subtitle,
  role,
  activeModule,
  onModuleChange,
  searchQuery,
  onSearchChange,
  children,
}: LibraryShellProps) {
  const moduleTabs =
    role === 'doctor'
      ? (['fitness', 'music'] as const)
      : (['memories', 'diary', 'fitness', 'music'] as const);
  const showSearch = activeModule === 'memories' || activeModule === 'diary';

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-accent/40">
        <div className="p-5 sm:p-6">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(255,247,248,0.92)_35%,_rgba(240,249,255,0.88)_70%,_rgba(245,253,250,0.96))] p-4 shadow-sm sm:p-5">
        <div className="space-y-3">
          <div className={`grid gap-2 ${role === 'doctor' ? 'grid-cols-2 sm:max-w-md' : 'grid-cols-2 sm:grid-cols-4'}`}>
            {moduleTabs.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={activeModule === value ? 'default' : 'outline'}
                className="h-11 rounded-2xl capitalize"
                onClick={() => onModuleChange(value)}
              >
                {value === 'diary' ? 'Diary Media' : value === 'fitness' ? 'Fitness Videos' : value}
              </Button>
            ))}
          </div>

          {showSearch ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={
                  activeModule === 'memories'
                    ? 'Search memories by title, source, date, or tags'
                    : 'Search diary media by title, date, or tags'
                }
                className="h-11 rounded-2xl border-slate-200 bg-white/90 pl-9"
              />
            </div>
          ) : null}
        </div>
      </div>

      {children}
    </div>
  );
}
