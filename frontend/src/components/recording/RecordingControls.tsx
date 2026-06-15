import { Square, Pause, Play, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import type { RecorderState } from '../../hooks/useAudioRecorder'

interface RecordingControlsProps {
  state: RecorderState
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onDiscard: () => void
  isUploading: boolean
  /** When true the Start button is disabled (e.g. model still loading) */
  startDisabled?: boolean
  /** Hint shown below the Start button when it's disabled */
  startHint?: string
  /** When true, stop was clicked and remaining audio is being processed */
  isStopping?: boolean
}

/** Start / Pause / Resume / Stop / Discard controls. */
export function RecordingControls({
  state,
  onStart,
  onPause,
  onResume,
  onStop,
  onDiscard,
  isUploading,
  startDisabled,
  startHint,
  isStopping,
}: RecordingControlsProps) {
  if (state === 'idle') {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          onClick={onStart}
          size="lg"
          className="gap-2"
          disabled={startDisabled || isUploading}
        >
          <span className="inline-block h-3 w-3 rounded-full bg-destructive animate-pulse" />
          {startDisabled && startHint ? startHint : 'Start Recording'}
        </Button>
      </div>
    )
  }

  if (state === 'stopped') {
    return (
      <div className="flex items-center gap-2">
        {isUploading && (
          <span className="text-sm text-muted-foreground animate-pulse">
            Sending to backend…
          </span>
        )}
      </div>
    )
  }

  // recording or paused
  return (
    <div className="flex items-center gap-3">
      {state === 'recording' ? (
        <Button
          variant="secondary"
          onClick={onPause}
          className="gap-2"
          disabled={isUploading}
        >
          <Pause className="h-4 w-4" />
          Pause
        </Button>
      ) : (
        <Button
          variant="secondary"
          onClick={onResume}
          className="gap-2"
          disabled={isUploading}
        >
          <Play className="h-4 w-4" />
          Resume
        </Button>
      )}

      <Button
        variant="destructive"
        onClick={onStop}
        className="gap-2"
        disabled={isUploading || isStopping}
      >
        <Square className="h-4 w-4" />
        {isStopping ? 'Stopping…' : 'Stop'}
      </Button>

      <Button
        variant="ghost"
        onClick={onDiscard}
        className="gap-2 text-muted-foreground hover:text-destructive"
        disabled={isUploading}
      >
        <Trash2 className="h-4 w-4" />
        Discard
      </Button>
    </div>
  )
}
