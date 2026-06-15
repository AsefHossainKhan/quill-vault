import { useEffect, useRef } from 'react'
import { FileText, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { useTranscriptionStore, type TranscriptSegment } from '../../stores/transcriptionStore'
import { formatDuration } from '../../lib/utils'

/** Panel that displays live transcription results during and after recording. */
export function TranscriptionPanel() {
  const segments = useTranscriptionStore((s) => s.segments)
  const isTranscribing = useTranscriptionStore((s) => s.isTranscribing)
  const progress = useTranscriptionStore((s) => s.progress)
  const stage = useTranscriptionStore((s) => s.stage)
  const error = useTranscriptionStore((s) => s.error)
  const detectedLanguage = useTranscriptionStore((s) => s.detectedLanguage)
  const queueCount = useTranscriptionStore((s) => s.queueCount)
  const isStopping = useTranscriptionStore((s) => s.isStopping)
  const reset = useTranscriptionStore((s) => s.reset)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as new segments arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [segments])

  const hasResult = segments.length > 0
  const isModelLoading = !isTranscribing && progress >= 0 && progress < 100 && stage !== null && !hasResult
  const showProgress = (isTranscribing && !hasResult) || isModelLoading
  const showError = error && !isTranscribing

  // Show during: model loading, transcribing, stopping, or when we have results
  if (!hasResult && !showProgress && !showError && !isTranscribing && !isStopping) return null

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Transcript
            {detectedLanguage && (
              <span className="ml-1.5 text-primary">({detectedLanguage})</span>
            )}
          </span>
          {isTranscribing && !isStopping && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
              Live
            </span>
          )}
          {isStopping && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Stopping
            </span>
          )}
          {queueCount > 0 && !isStopping && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {queueCount} chunk{queueCount !== 1 ? 's' : ''} queued
            </span>
          )}
        </div>
        {hasResult && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {segments.length} segment{segments.length !== 1 ? 's' : ''}
            </span>
            {!isTranscribing && (
              <button
                onClick={reset}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                title="Clear transcript"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {showProgress && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>{stage || 'Preparing…'}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            {progress >= 0 ? (
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            ) : (
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {progress >= 0 ? `${Math.min(progress, 100)}%` : 'Processing…'}
          </p>
        </div>
      )}

      {/* Error state */}
      {showError && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Transcription failed</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Transcript segments */}
      {hasResult && (
        <div
          ref={scrollRef}
          className="max-h-[300px] overflow-y-auto rounded-xl border border-border bg-card"
        >
          <div className="p-4 space-y-3">
            {segments.map((seg, i) => (
              <Segment key={i} segment={seg} />
            ))}
          </div>

          {/* Still transcribing indicator */}
          {isTranscribing && (
            <div className="flex items-center gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Still transcribing…
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Segment({ segment }: { segment: TranscriptSegment }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 font-mono text-[11px] leading-5 text-muted-foreground">
        {formatDuration(Math.floor(segment.start))}
      </span>
      <p className="text-sm leading-5 text-foreground">
        {segment.text}
      </p>
    </div>
  )
}
