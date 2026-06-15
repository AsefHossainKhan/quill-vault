import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  Monitor,
  Server,
  Check,
  Info,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useSettingsStore } from '../stores/settingsStore'
import { useTranscriptionStore } from '../stores/transcriptionStore'
import { TRANSCRIPTION_WHISPER_MODELS } from '../lib/whisper'
import type { Theme } from '../hooks/useTheme'
import type { TranscriptionMode } from '../stores/transcriptionStore'
import type { WhisperModelId } from '../lib/whisper'

const THEME_OPTIONS: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]

const MODE_OPTIONS: { id: TranscriptionMode; label: string; description: string }[] = [
  {
    id: 'local',
    label: 'Local (Client-side)',
    description: 'Runs Whisper on your device. Fast, private, works offline.',
  },
  {
    id: 'remote',
    label: 'Remote (Server)',
    description: 'Runs on the backend server. Higher accuracy with larger models.',
  },
]

export default function Settings() {
  const theme = useSettingsStore((s) => s.theme)
  const backendUrl = useSettingsStore((s) => s.backendUrl)
  const saveSettings = useSettingsStore((s) => s.save)

  const mode = useTranscriptionStore((s) => s.mode)
  const whisperModel = useTranscriptionStore((s) => s.whisperModel)
  const setMode = useTranscriptionStore((s) => s.setMode)
  const setWhisperModel = useTranscriptionStore((s) => s.setWhisperModel)

  const [backendUrlInput, setBackendUrlInput] = useState(backendUrl)
  const [saved, setSaved] = useState(false)

  // Sync input when store changes externally
  useEffect(() => {
    setBackendUrlInput(backendUrl)
  }, [backendUrl])

  function handleSaveBackendUrl() {
    const trimmed = backendUrlInput.trim()
    if (trimmed && trimmed !== backendUrl) {
      saveSettings({ backendUrl: trimmed })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure QuillVault to your preferences
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-6">
        {/* ── Appearance ──────────────────────────────────────────────── */}
        <Section
          title="Appearance"
          description="Choose how QuillVault looks on your screen"
        >
          <div className="flex gap-3">
            {THEME_OPTIONS.map((opt) => {
              const isActive = theme === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => saveSettings({ theme: opt.id })}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 transition-colors',
                    isActive
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  <opt.icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Transcription Mode ──────────────────────────────────────── */}
        <Section
          title="Transcription"
          description="Choose where audio transcription runs"
        >
          <div className="space-y-3">
            {MODE_OPTIONS.map((opt) => {
              const isActive = mode === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => setMode(opt.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors',
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                      isActive
                        ? 'border-primary'
                        : 'border-muted-foreground/40',
                    )}
                  >
                    {isActive && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {opt.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {opt.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Whisper Model (only for local mode) ─────────────────────── */}
        {mode === 'local' && (
          <Section
            title="Whisper Model"
            description="Select the model used for local transcription"
          >
            <div className="space-y-2">
              {TRANSCRIPTION_WHISPER_MODELS.map((model) => {
                const isActive = whisperModel === model.id
                return (
                  <button
                    key={model.id}
                    onClick={() => setWhisperModel(model.id as WhisperModelId)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-colors',
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/40',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40',
                      )}
                    >
                      {isActive && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {model.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {model.desc}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {model.size}
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {model.speed}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Backend URL ─────────────────────────────────────────────── */}
        <Section
          title="Backend Server"
          description="URL of the QuillVault backend API"
        >
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={backendUrlInput}
                onChange={(e) => setBackendUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveBackendUrl()}
                icon={<Server className="h-4 w-4" />}
                placeholder="http://localhost:8000"
              />
            </div>
            <Button
              onClick={handleSaveBackendUrl}
              variant={saved ? 'secondary' : 'default'}
              className="shrink-0 gap-1.5"
              disabled={
                !backendUrlInput.trim() || backendUrlInput.trim() === backendUrl
              }
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Default: <span className="font-mono">http://localhost:8000</span>
            {' · '}Changes take effect on next request
          </p>
        </Section>

        {/* ── About ───────────────────────────────────────────────────── */}
        <Section title="About" description="Application information">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <Info className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  QuillVault v2
                </p>
                <p className="text-xs text-muted-foreground">
                  AI-powered meeting transcription &amp; analysis
                </p>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{description}</p>
      {children}
    </div>
  )
}
