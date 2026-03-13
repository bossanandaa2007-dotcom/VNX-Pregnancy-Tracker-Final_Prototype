import type { VoiceLanguage } from '@/hooks/useSpeechRecognition';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface VoiceLanguageToggleProps {
  disabled?: boolean;
  onValueChange: (language: VoiceLanguage) => void;
  value: VoiceLanguage;
}

export function VoiceLanguageToggle({
  disabled = false,
  onValueChange,
  value,
}: VoiceLanguageToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Voice</span>
      <ToggleGroup
        type="single"
        value={value}
        variant="outline"
        size="sm"
        className="gap-1"
        onValueChange={(nextLanguage) => {
          if (nextLanguage === 'en') {
            onValueChange(nextLanguage);
          }
        }}
      >
        <ToggleGroupItem value="en" disabled={disabled} aria-label="English voice">
          English
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
