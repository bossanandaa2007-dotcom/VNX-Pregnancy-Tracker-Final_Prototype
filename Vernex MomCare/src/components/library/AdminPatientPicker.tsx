import { useEffect, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { LibraryPatientOption } from '@/types/library';
import { libraryApi } from '@/lib/libraryApi';

interface AdminPatientPickerProps {
  selectedPatientId: string;
  onSelectPatient: (patient: LibraryPatientOption) => void;
}

export function AdminPatientPicker({
  selectedPatientId,
  onSelectPatient,
}: AdminPatientPickerProps) {
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<LibraryPatientOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    libraryApi
      .searchPatients(query)
      .then((items) => {
        if (active) setPatients(items);
      })
      .catch(() => {
        if (active) setPatients([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  return (
    <Card className="border-0 bg-white/70 shadow-sm backdrop-blur">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-amber-100 p-2 text-amber-700">
            <UserRound className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Patient Library Access</p>
            <p className="text-sm text-slate-500">Search and load a patient&apos;s secure Library view.</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="rounded-xl border-slate-200 pl-9"
          />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {patients.map((patient) => (
            <Button
              key={patient._id}
              type="button"
              variant={selectedPatientId === patient._id ? 'default' : 'outline'}
              className="h-auto justify-start rounded-2xl px-4 py-3 text-left"
              onClick={() => onSelectPatient(patient)}
            >
              <div>
                <div className="font-medium">{patient.name}</div>
                <div className="text-xs opacity-80">{patient.email}</div>
                {patient.gestationalWeek ? (
                  <div className="text-xs opacity-80">Week {patient.gestationalWeek}</div>
                ) : null}
              </div>
            </Button>
          ))}
          {!loading && patients.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No patients found for this search.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
