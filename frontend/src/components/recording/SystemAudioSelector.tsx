import { Volume2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SystemAudioSelectorProps {
  disabled?: boolean
  /** Whether system audio is currently being captured */
  isCapturing?: boolean
}

/** Status indicator showing system audio is auto-detected and captured. */
export function SystemAudioSelector({ disabled, isCapturing }: SystemAudioSelectorProps) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Volume2 className="h-3 w-3" />
        System Audio
      </label>
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full',
            isCapturing ? 'bg-success animate-pulse' : 'bg-muted-foreground/40',
          )}
        />
        <span className={cn(
          'text-sm',
          isCapturing ? 'text-success' : 'text-muted-foreground',
        )}>
          {isCapturing ? 'System audio detected' : 'Auto-detected on recording'}
        </span>
      </div>
    </div>
  )
}
