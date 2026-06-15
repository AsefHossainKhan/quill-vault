import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  CircleDot,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { PIPELINE_STAGES, type PipelineStage } from '../../types/api'

interface PipelineStatusBarProps {
  stage: PipelineStage | string | null
  progress: number
  error?: string | null
}

const stageLabels: Record<string, string> = {
  queued: 'Queued',
  transcribing: 'Transcribing',
  diarizing: 'Diarizing',
  naming: 'Naming Speakers',
  generating: 'Generating Output',
  done: 'Complete',
  failed: 'Failed',
}

export function PipelineStatusBar({ stage, progress, error }: PipelineStatusBarProps) {
  const isActive = stage && stage !== 'done' && stage !== 'failed'
  const isDone = stage === 'done'
  const isFailed = stage === 'failed'

  // If pipeline is done or not running, don't show the status bar
  if (!stage || isDone) return null

  return (
    <div
      className={cn(
        'mx-4 mt-3 rounded-xl border px-4 py-3',
        isFailed
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-primary/20 bg-primary/5',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Status icon */}
        {isFailed ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
        ) : isActive ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : (
          <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        {/* Stage label */}
        <span
          className={cn(
            'text-sm font-medium',
            isFailed ? 'text-destructive' : 'text-foreground',
          )}
        >
          {isFailed ? 'Processing Failed' : stageLabels[stage] || stage}
        </span>

        {/* Progress percentage */}
        {isActive && (
          <span className="ml-auto text-xs font-medium text-primary">
            {progress}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {isActive && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Stage dots */}
      {isActive && (
        <div className="mt-2.5 flex items-center gap-1.5">
          {PIPELINE_STAGES.filter((s) => s !== 'queued' && s !== 'done').map(
            (s) => {
              const sIdx = PIPELINE_STAGES.indexOf(s)
              const currentIdx = PIPELINE_STAGES.indexOf(stage as PipelineStage)
              const isPast = sIdx < currentIdx
              const isCurrent = sIdx === currentIdx

              return (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'h-1.5 w-1.5 rounded-full transition-colors',
                      isPast
                        ? 'bg-primary'
                        : isCurrent
                          ? 'bg-primary animate-pulse'
                          : 'bg-muted-foreground/30',
                    )}
                  />
                  {isPast && (
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                  )}
                  <span
                    className={cn(
                      'text-[10px] font-medium',
                      isPast || isCurrent
                        ? 'text-foreground'
                        : 'text-muted-foreground/50',
                    )}
                  >
                    {stageLabels[s]}
                  </span>
                </div>
              )
            },
          )}
        </div>
      )}

      {/* Error message */}
      {isFailed && error && (
        <p className="mt-2 text-xs text-destructive/80">{error}</p>
      )}
    </div>
  )
}
