import { Mic, Volume2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ChannelStatusProps {
  type: 'mic' | 'system'
  level: number       // 0–100
  isActive: boolean
}

/** Two status cards side by side showing mic / system audio levels. */
export function ChannelStatus({ type, level, isActive }: ChannelStatusProps) {
  const isMic = type === 'mic'
  const Icon = isMic ? Mic : Volume2
  const label = isMic ? 'Microphone' : 'System Audio'
  const barCount = 8

  return (
    <div
      className={cn(
        'flex flex-1 flex-col gap-3 rounded-xl border p-4 transition-colors',
        isActive
          ? 'border-border bg-card'
          : 'border-border/50 bg-muted/30',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-card-foreground">
          {label}
        </span>
      </div>

      {/* Status dot + label */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full',
            isActive ? 'bg-success animate-pulse' : 'bg-muted-foreground/40',
          )}
        />
        <span
          className={cn(
            'text-xs',
            isActive ? 'text-success' : 'text-muted-foreground',
          )}
        >
          {isActive ? 'Active' : 'Not detected'}
        </span>
      </div>

      {/* Level meter */}
      <div className="flex items-end gap-[3px]">
        {Array.from({ length: barCount }).map((_, i) => {
          const threshold = ((i + 1) / barCount) * 100
          const lit = isActive && level >= threshold
          return (
            <div
              key={i}
              className={cn(
                'h-3 w-2 rounded-sm transition-all duration-75',
                lit
                  ? isMic
                    ? 'bg-primary'
                    : 'bg-success'
                  : 'bg-muted',
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
