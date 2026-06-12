import { Cpu, Cloud, ChevronDown, Check, Loader2 } from 'lucide-react'
import { useTranscriptionStore } from '../../stores/transcriptionStore'
import { TRANSCRIPTION_WHISPER_MODELS, type WhisperModelId } from '../../lib/whisper'
import { cn } from '../../lib/utils'

interface TranscriptionModeSelectorProps {
  disabled?: boolean
}

/** Mode selector + model picker for the recording screen. */
export function TranscriptionModeSelector({ disabled }: TranscriptionModeSelectorProps) {
  const mode = useTranscriptionStore((s) => s.mode)
  const whisperModel = useTranscriptionStore((s) => s.whisperModel)
  const modelReady = useTranscriptionStore((s) => s.modelReady)
  const progress = useTranscriptionStore((s) => s.progress)
  const stage = useTranscriptionStore((s) => s.stage)
  const isTranscribing = useTranscriptionStore((s) => s.isTranscribing)
  const setMode = useTranscriptionStore((s) => s.setMode)
  const setWhisperModel = useTranscriptionStore((s) => s.setWhisperModel)

  const isLocal = mode === 'local'
  // Show loading state when model is loading (not yet ready, not yet transcribing)
  const isModelLoading = isLocal && !modelReady && !isTranscribing && progress >= 0 && stage !== null

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-muted-foreground">
        Transcription
      </label>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode('local')}
          className={cn(
            'flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
            isLocal
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:border-border hover:bg-muted',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <Cpu className="h-4 w-4" />
          <div className="text-left">
            <div>Local</div>
            <div className="text-[10px] font-normal opacity-70">Whisper (client)</div>
          </div>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode('remote')}
          className={cn(
            'flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
            !isLocal
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:border-border hover:bg-muted',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <Cloud className="h-4 w-4" />
          <div className="text-left">
            <div>Server</div>
            <div className="text-[10px] font-normal opacity-70">faster-whisper</div>
          </div>
        </button>
      </div>

      {/* Model selector (only shown in local mode) */}
      {isLocal && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            Whisper Model
          </label>
          <div className="relative">
            <select
              value={whisperModel}
              onChange={(e) => setWhisperModel(e.target.value as WhisperModelId)}
              disabled={disabled}
              className="flex h-9 w-full appearance-none items-center rounded-lg border border-border bg-card px-3 pr-8 text-sm text-card-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {TRANSCRIPTION_WHISPER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.size}) — {m.desc}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Model status */}
          <div className="space-y-1.5">
            {isModelLoading ? (
              <div className="flex items-center gap-1.5 text-[11px]">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="text-muted-foreground">{stage || 'Loading model…'}</span>
                {progress > 0 && progress < 100 && (
                  <span className="text-primary">{progress}%</span>
                )}
              </div>
            ) : modelReady ? (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="flex items-center gap-1 text-success">
                  <Check className="h-3 w-3" />
                  Model ready
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="flex items-center gap-1 text-success">
                  <Check className="h-3 w-3" />
                  Bundled with app
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
