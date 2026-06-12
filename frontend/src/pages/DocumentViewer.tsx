interface DocumentViewerProps {
  recordingId: string
}

/** Placeholder — will be built out with tabs, waveform, transcript, etc. */
export function DocumentViewer({ recordingId }: DocumentViewerProps) {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">
        Recording <span className="font-mono text-foreground">{recordingId}</span> — coming soon
      </p>
    </div>
  )
}
