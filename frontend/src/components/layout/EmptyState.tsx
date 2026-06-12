import { Mic, Upload } from 'lucide-react'
import { Button } from '../ui/Button'

interface EmptyStateProps {
  onStartRecording?: () => void
  onUploadFile?: () => void
}

export function EmptyState({ onStartRecording, onUploadFile }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      {/* Mic icon */}
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
        <Mic className="h-10 w-10 text-primary" />
      </div>

      {/* Text */}
      <h2 className="mb-2 text-xl font-semibold text-card-foreground">
        No recording selected
      </h2>
      <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
        Select a recording from your library or start a new transcription session to begin analysis.
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button onClick={onStartRecording} className="gap-2">
          <Mic className="h-4 w-4" />
          Start Recording
        </Button>
        <Button
          variant="outline"
          onClick={onUploadFile}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Upload File
        </Button>
      </div>

      {/* Supported formats */}
      <p className="mt-4 text-xs text-muted-foreground">
        Supported formats: MP3, WAV, M4A, MP4 (max 500MB)
      </p>
    </div>
  )
}
