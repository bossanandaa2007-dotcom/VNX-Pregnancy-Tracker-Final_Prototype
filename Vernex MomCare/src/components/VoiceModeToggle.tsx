import { Switch } from '@/components/ui/switch';

interface VoiceModeToggleProps {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function VoiceModeToggle({
  checked,
  disabled = false,
  onCheckedChange,
}: VoiceModeToggleProps) {
  return (
    <label className="flex items-center gap-3">
      <div className="flex flex-col">
        <span className="text-xs font-medium text-foreground">Voice mode</span>
        <span className="text-[11px] text-muted-foreground">
          Auto-send spoken input and speak Thozhi replies
        </span>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label="Toggle voice mode"
      />
    </label>
  );
}
