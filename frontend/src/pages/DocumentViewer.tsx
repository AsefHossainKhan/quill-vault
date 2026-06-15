import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Calendar,
  Clock,
  FileText,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Loader2,
  MessageSquare,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { PipelineStatusBar } from '../components/viewer/PipelineStatusBar'
import { TranscriptTabs } from '../components/viewer/TranscriptTabs'
import { ChatPanel } from '../components/chat/ChatPanel'
import { useSettingsStore } from '../stores/settingsStore'
import {
  getRecording,
  getTranscripts,
  getJobStatus,
} from '../api/recordings'
import type {
  Recording,
  Transcript,
  JobStatus,
  PipelineStage,
} from '../types/api'

interface DocumentViewerProps {
  recordingId: string
}

export function DocumentViewer({ recordingId }: DocumentViewerProps) {
  const navigate = useNavigate()

  // ── State ─────────────────────────────────────────────────────────────────
  const [recording, setRecording] = useState<Recording | null>(null)
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const chatOpen = useSettingsStore((s) => s.chatOpen)
  const setChatOpen = useSettingsStore((s) => s.setChatOpen)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchRecording = useCallback(async () => {
    try {
      const data = await getRecording(recordingId)
      setRecording(data)
      return data
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load recording')
      return null
    }
  }, [recordingId])

  const fetchTranscripts = useCallback(async () => {
    try {
      const data = await getTranscripts(recordingId)
      setTranscripts(data)
    } catch {
      // Transcripts may not exist yet during processing
    }
  }, [recordingId])

  const fetchJobStatus = useCallback(
    async (jobId: string) => {
      try {
        const data = await getJobStatus(jobId)
        setJobStatus(data)
        return data
      } catch {
        return null
      }
    },
    [],
  )

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const rec = await fetchRecording()
      if (cancelled) return

      await fetchTranscripts()
      if (cancelled) return

      // If there's an active job, start polling
      if (rec?.active_job_id) {
        const job = await fetchJobStatus(rec.active_job_id)
        if (cancelled) return

        if (job && job.stage !== 'done' && job.stage !== 'failed') {
          startPolling(rec.active_job_id)
        }
      }

      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [recordingId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling for active jobs ───────────────────────────────────────────────

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling()
      pollingRef.current = setInterval(async () => {
        const job = await fetchJobStatus(jobId)
        if (!job) return

        // Refresh transcripts each poll cycle
        await fetchTranscripts()

        // Stop polling when done or failed
        if (job.stage === 'done' || job.stage === 'failed') {
          stopPolling()
          // Refresh recording to clear active_job_id
          await fetchRecording()
          setLoading(false)
        }
      }, 2000) // Poll every 2 seconds
    },
    [fetchJobStatus, fetchTranscripts, fetchRecording],
  )

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // ── Derived state ─────────────────────────────────────────────────────────

  const isProcessing =
    !!jobStatus &&
    jobStatus.stage !== 'done' &&
    jobStatus.stage !== 'failed'

  const pipelineStage = jobStatus?.stage as PipelineStage | null

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading recording...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-foreground font-medium">Error loading recording</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="mt-2 gap-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Library
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Main Column ──────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="h-8 w-8 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">
            {recording?.name || 'Untitled Recording'}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            {recording?.created_at && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(recording.created_at).toLocaleDateString()}
              </span>
            )}
            {recording?.duration_seconds != null && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDuration(recording.duration_seconds)}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {isProcessing && (
            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Processing
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              fetchTranscripts()
              if (recording?.active_job_id) fetchJobStatus(recording.active_job_id)
            }}
            className="h-8 w-8"
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', isProcessing && 'animate-spin')} />
          </Button>
          <Button
            variant={chatOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setChatOpen(!chatOpen)}
            className="gap-1.5"
            title={chatOpen ? 'Close chat' : 'Open chat'}
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </Button>
        </div>
      </div>

      {/* ── Pipeline Status Bar ────────────────────────────────────────── */}
      {pipelineStage && (
        <PipelineStatusBar
          stage={pipelineStage}
          progress={jobStatus?.progress ?? 0}
          error={jobStatus?.error}
        />
      )}

      {/* ── Tab Content ────────────────────────────────────────────────── */}
      <TranscriptTabs
        transcripts={transcripts}
        isProcessing={isProcessing}
      />
      </div>

      {/* ── Chat Panel ──────────────────────────────────────────────────── */}
      <ChatPanel
        recordingId={recordingId}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        availableTranscriptTypes={transcripts.map((t) => t.type)}
      />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}h ${m}m`
  }
  return `${m}m ${s}s`
}
