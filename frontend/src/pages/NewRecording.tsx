import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock } from 'lucide-react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useRecordingStore } from '../stores/recordingStore'
import { useTranscriptionStore } from '../stores/transcriptionStore'
import { useLiveTranscription } from '../hooks/useLiveTranscription'
import { uploadRecording } from '../api/recordings'
import { formatDuration } from '../lib/utils'
import { decodeAndMergeAudioBlobs, transcribeInWorker } from '../lib/whisper'
import { Waveform } from '../components/recording/Waveform'
import { ChannelStatus } from '../components/recording/ChannelStatus'
import { AudioDeviceSelector } from '../components/recording/AudioDeviceSelector'
import { SystemAudioSelector } from '../components/recording/SystemAudioSelector'
import { TranscriptionModeSelector } from '../components/recording/TranscriptionModeSelector'
import { TranscriptionPanel } from '../components/recording/TranscriptionPanel'
import { RecordingControls } from '../components/recording/RecordingControls'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'Bangla' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
]

export default function NewRecording() {
  const navigate = useNavigate()
  const {
    state,
    duration,
    micLevel,
    systemLevel,
    micBlob,
    systemBlob,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    start,
    pause,
    resume,
    stop,
    discard,
    micAnalyserNode,
    systemAnalyserNode,
    micStream,
    systemStream,
  } = useAudioRecorder()

  const recordingName = useRecordingStore((s) => s.recordingName)
  const setRecordingName = useRecordingStore((s) => s.setRecordingName)
  const micDeviceId = useRecordingStore((s) => s.micDeviceId)
  const language = useRecordingStore((s) => s.language)
  const setLanguage = useRecordingStore((s) => s.setLanguage)

  const transcriptionMode = useTranscriptionStore((s) => s.mode)
  const whisperModel = useTranscriptionStore((s) => s.whisperModel)
  const modelReady = useTranscriptionStore((s) => s.modelReady)
  const setTranscriptionProgress = useTranscriptionStore((s) => s.setProgress)
  const setTranscriptionStage = useTranscriptionStore((s) => s.setStage)
  const setTranscriptionError = useTranscriptionStore((s) => s.setError)
  const transcriptionProgress = useTranscriptionStore((s) => s.progress)
  const transcriptionStage = useTranscriptionStore((s) => s.stage)
  const transcriptionReset = useTranscriptionStore((s) => s.reset)

  const { startLive, stopLive, discardLive, preloadModel } = useLiveTranscription()

  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const whisperWorkerRef = useRef<Worker | null>(null)

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      whisperWorkerRef.current?.terminate()
    }
  }, [])

  // Auto-reset transcription state on page entry (fresh session)
  useEffect(() => {
    transcriptionReset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Start audio monitoring on mount (keeps level meters active at all times)
  useEffect(() => {
    if (micDeviceId) {
      startMonitoring(micDeviceId).catch((err) => {
        console.error('Failed to start audio monitoring:', err)
      })
    }
    return () => {
      stopMonitoring()
    }
  }, [micDeviceId, startMonitoring, stopMonitoring])

  const isRecording = state === 'recording'
  const isPaused = state === 'paused'
  const isActive = isRecording || isPaused
  const isStopped = state === 'stopped'

  const handleStart = useCallback(async () => {
    try {
      await start()
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }, [start])

  // Preload the Whisper model as soon as local mode is selected (before recording)
  useEffect(() => {
    if (transcriptionMode === 'local') {
      preloadModel(whisperModel)
    }
  }, [transcriptionMode, whisperModel, preloadModel])

  // Start live transcription when recording begins (mic + system audio)
  useEffect(() => {
    if (state === 'recording' && micStream && transcriptionMode === 'local') {
      startLive(micStream, whisperModel, language, systemStream)
    }
  }, [state, micStream, systemStream, transcriptionMode, whisperModel, language, startLive])

  const handleStop = useCallback(async () => {
    // Stop live transcription first (does final pass)
    if (transcriptionMode === 'local') {
      await stopLive()
    }
    await stop()
  }, [stop, stopLive, transcriptionMode])

  const handleDiscard = useCallback(() => {
    discardLive()
    discard()
    setRecordingName('')
    transcriptionReset()
    whisperWorkerRef.current?.terminate()
    whisperWorkerRef.current = null
  }, [discardLive, discard, setRecordingName, transcriptionReset])

  const handleUpload = useCallback(async () => {
    if (!micBlob) return
    setIsUploading(true)
    setUploadProgress(0)
    setTranscriptionError(null)

    try {
      const name = recordingName || `Recording ${new Date().toLocaleString()}`
      let transcriptJson: string | null = null

      // ── Local transcription (client-side Whisper) ───────────────
      if (transcriptionMode === 'local') {
        const existingSegments = useTranscriptionStore.getState().segments
        if (existingSegments.length > 0) {
          // Live transcription already ran — use those results
          transcriptJson = JSON.stringify(existingSegments)
          setTranscriptionStage('Using live transcript…')
        } else {
          // Fallback: transcribe now (e.g., if live transcription was skipped)
          setTranscriptionStage('Decoding audio…')
          setTranscriptionProgress(0)
          // Merge mic + system audio into a single buffer for Whisper
          const audioBlobs = [micBlob, systemBlob].filter((b): b is Blob => !!b && b.size > 0)
          const audioData = await decodeAndMergeAudioBlobs(audioBlobs)

          const worker = new Worker(
            new URL('../lib/whisperWorker.ts', import.meta.url),
            { type: 'module' },
          )
          whisperWorkerRef.current = worker

          try {
            const result = await transcribeInWorker(
              worker,
              audioData,
              whisperModel,
              language,
              (progress, stage) => {
                setTranscriptionProgress(progress)
                if (stage) setTranscriptionStage(stage)
              },
            )
            transcriptJson = JSON.stringify(result.segments)
          } finally {
            worker.terminate()
            whisperWorkerRef.current = null
          }
        }
        setTranscriptionStage('Uploading transcript…')
      }

      // ── Upload to backend ───────────────────────────────────────
      const result = await uploadRecording(
        name,
        micBlob,
        systemBlob,
        language,
        transcriptJson,
        (p) => setUploadProgress(p),
      )
      navigate(`/recording/${result.recordingId}`, { replace: true })
    } catch (err) {
      console.error('Upload failed:', err)
      setTranscriptionError(err instanceof Error ? err.message : String(err))
      setIsUploading(false)
    }
  }, [
    micBlob, systemBlob, recordingName, language, navigate,
    transcriptionMode, whisperModel,
    setTranscriptionProgress, setTranscriptionStage, setTranscriptionError,
  ])

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">
          New Recording
        </h1>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        {/* Recording name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Recording Name
          </label>
          <Input
            placeholder="Team Standup - June 2026"
            value={recordingName}
            onChange={(e) => setRecordingName(e.target.value)}
            disabled={isActive || isUploading}
          />
        </div>

        {/* Waveform */}
        <Waveform
          micAnalyserNode={micAnalyserNode}
          systemAnalyserNode={systemAnalyserNode}
          isRecording={isMonitoring}
        />

        {/* Channel status cards */}
        <div className="flex gap-4">
          <ChannelStatus
            type="mic"
            level={micLevel}
            isActive={isMonitoring}
          />
          <ChannelStatus
            type="system"
            level={systemLevel}
            isActive={isMonitoring}
          />
        </div>

        {/* Device selector */}
        <AudioDeviceSelector disabled={isActive || isUploading} />

        {/* System audio status */}
        <SystemAudioSelector
          disabled={isActive || isUploading}
          isCapturing={isMonitoring && systemLevel > 0}
        />

        {/* Transcription mode selector */}
        <TranscriptionModeSelector disabled={isActive || isUploading} />

        {/* Language selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isActive || isUploading}
            className="flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-card-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Duration + Controls */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          {/* Duration display */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="font-mono text-base text-foreground">
              {formatDuration(duration)}
            </span>
            {isRecording && (
              <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-pulse" />
            )}
          </div>

          {/* Recording controls */}
          <RecordingControls
            state={state}
            onStart={handleStart}
            onPause={pause}
            onResume={resume}
            onStop={handleStop}
            onDiscard={handleDiscard}
            isUploading={isUploading}
            startDisabled={transcriptionMode === 'local' && !modelReady}
            startHint={transcriptionMode === 'local' && !modelReady ? (transcriptionStage || 'Loading model…') : undefined}
          />
        </div>

        {/* Live transcription panel — visible during preload, recording, and after in local mode */}
        {transcriptionMode === 'local' && (isActive || isStopped || transcriptionStage) && (
          <TranscriptionPanel />
        )}

        {/* Upload progress */}
        {isUploading && (
          <div className="space-y-2">
            {/* Transcription progress (local mode) */}
            {transcriptionMode === 'local' && transcriptionStage && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {transcriptionStage}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-300"
                    style={{ width: `${transcriptionProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {transcriptionProgress}% — runs in Web Worker (UI stays responsive)
                </p>
              </div>
            )}

            {/* Upload progress */}
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Uploading… {uploadProgress}%
            </p>
          </div>
        )}

        {/* Post-recording actions */}
        {isStopped && micBlob && !isUploading && (
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button onClick={handleUpload} className="gap-2">
              Upload &amp; Process
            </Button>
            <Button variant="outline" onClick={handleDiscard} className="gap-2">
              Discard
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
