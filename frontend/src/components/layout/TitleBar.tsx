import { Minus, Square, X } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Custom frameless window title bar.
 * Uses CSS class `.drag-region` / `.no-drag-region` for window dragging.
 *
 * Gracefully degrades when running outside Electron (browser dev mode).
 */
export function TitleBar() {
  const api = window.electronAPI

  // Outside Electron, render a simple non-interactive bar
  if (!api) {
    return (
      <div className="flex h-8 shrink-0 items-center border-b border-border bg-card">
        <div className="flex-1" />
        <span className="pr-4 text-xs text-muted-foreground">Browser Mode</span>
      </div>
    )
  }

  return (
    <div className="flex h-8 shrink-0 items-center border-b border-border bg-card">
      {/* Draggable region — fills all available space */}
      <div
        className="flex-1 self-stretch"
        style={{
          WebkitAppRegion: 'drag',
          userSelect: 'none',
        } as React.CSSProperties}
      />

      {/* Window controls */}
      <div
        className="flex h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Minimize */}
        <button
          onClick={() => api.minimizeWindow()}
          className={cn(
            'flex h-full w-10 items-center justify-center',
            'text-muted-foreground transition-colors hover:bg-muted',
          )}
          aria-label="Minimize"
        >
          <Minus className="h-4 w-4" />
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={() => api.maximizeWindow()}
          className={cn(
            'flex h-full w-10 items-center justify-center',
            'text-muted-foreground transition-colors hover:bg-muted',
          )}
          aria-label="Maximize"
        >
          <Square className="h-3 w-3" />
        </button>

        {/* Close */}
        <button
          onClick={() => api.closeWindow()}
          className={cn(
            'flex h-full w-10 items-center justify-center',
            'text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground',
          )}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
