import { useState } from 'react'
import { FileText } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Transcript, TranscriptType } from '../../types/api'

interface TranscriptTabsProps {
  transcripts: Transcript[]
  isProcessing: boolean
  onTabChange?: (tab: TranscriptType) => void
}

const TABS: { id: TranscriptType; label: string; description: string }[] = [
  { id: 'raw', label: 'Raw', description: 'Unprocessed transcription' },
  { id: 'diarized', label: 'Diarized', description: 'Speaker-separated transcript' },
  { id: 'named', label: 'Named', description: 'Speakers identified by name' },
  { id: 'output', label: 'Output', description: 'Formatted meeting notes' },
]

export function TranscriptTabs({ transcripts, isProcessing, onTabChange }: TranscriptTabsProps) {
  const [activeTab, setActiveTab] = useState<TranscriptType>('raw')

  const activeTranscript = transcripts.find((t) => t.type === activeTab)

  // Build a set of available types
  const availableTypes = new Set(transcripts.map((t) => t.type))

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border px-4">
        {TABS.map((tab) => {
          const isAvailable = availableTypes.has(tab.id)
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isAvailable) {
                  setActiveTab(tab.id)
                  onTabChange?.(tab.id)
                }
              }}
              disabled={!isAvailable}
              className={cn(
                'relative px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : isAvailable
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'cursor-not-allowed text-muted-foreground/40',
              )}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTranscript ? (
          <TranscriptContent transcript={activeTranscript} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            {isProcessing ? (
              <>
                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">
                  Waiting for {activeTab} transcript...
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  This tab will populate as the pipeline progresses
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  No {activeTab} transcript available
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {TABS.find((t) => t.id === activeTab)?.description}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Content Renderers ─────────────────────────────────────────────────────────

function TranscriptContent({ transcript }: { transcript: Transcript }) {
  if (transcript.type === 'output') {
    return <OutputRenderer content={transcript.content} />
  }

  // Parse segment-based content (raw, diarized, named)
  let segments: Array<{ start: number; end: number; text: string; speaker?: string }>
  try {
    segments = JSON.parse(transcript.content)
  } catch {
    return (
      <div className="rounded-lg bg-destructive/5 p-4 text-sm text-destructive">
        Failed to parse transcript content
      </div>
    )
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No segments in this transcript
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          The audio may have been filtered out during processing
        </p>
      </div>
    )
  }

  // Collect unique speakers for color mapping
  const speakers = [...new Set(segments.map((s) => s.speaker).filter((s): s is string => !!s))]
  const speakerColorMap = buildSpeakerColorMap(speakers)

  return (
    <div className="space-y-1">
      {transcript.type === 'raw' ? (
        <RawSegments segments={segments} />
      ) : (
        <SpeakerSegments
          segments={segments}
          speakerColorMap={speakerColorMap}
          showNames={transcript.type === 'named'}
        />
      )}
    </div>
  )
}

function RawSegments({
  segments,
}: {
  segments: Array<{ start: number; end: number; text: string }>
}) {
  return (
    <>
      {segments.map((seg, i) => (
        <div
          key={i}
          className="group flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
        >
          <span className="shrink-0 font-mono text-xs text-muted-foreground pt-0.5 tabular-nums">
            {formatTimestamp(seg.start)}
          </span>
          <span className="text-sm leading-relaxed text-foreground font-mono">
            {seg.text}
          </span>
        </div>
      ))}
    </>
  )
}

function SpeakerSegments({
  segments,
  speakerColorMap,
  showNames,
}: {
  segments: Array<{ start: number; end: number; text: string; speaker?: string }>
  speakerColorMap: Map<string, { bg: string; text: string; dot: string }>
  showNames: boolean
}) {
  return (
    <>
      {segments.map((seg, i) => {
        const speaker = seg.speaker || 'Unknown'
        const colors = speakerColorMap.get(speaker) || {
          bg: 'bg-muted',
          text: 'text-foreground',
          dot: 'bg-muted-foreground',
        }

        return (
          <div
            key={i}
            className="group flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
          >
            <span className="shrink-0 font-mono text-xs text-muted-foreground pt-0.5 tabular-nums">
              {formatTimestamp(seg.start)}
            </span>
            <div className="flex-1 min-w-0">
              {showNames && (
                <div className="mb-1 flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', colors.dot)} />
                  <span className="text-xs font-semibold text-foreground">
                    {speaker}
                  </span>
                </div>
              )}
              <span className="text-sm leading-relaxed text-foreground">
                {seg.text}
              </span>
            </div>
            {!showNames && seg.speaker && (
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  colors.bg,
                  colors.text,
                )}
              >
                {speaker}
              </span>
            )}
          </div>
        )
      })}
    </>
  )
}

function OutputRenderer({ content }: { content: string }) {
  if (!content || !content.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No output content generated
        </p>
      </div>
    )
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <div
        className="whitespace-pre-wrap leading-relaxed text-sm text-foreground"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

const SPEAKER_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-500' },
  { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
]

function buildSpeakerColorMap(
  speakers: string[],
): Map<string, { bg: string; text: string; dot: string }> {
  const map = new Map<string, { bg: string; text: string; dot: string }>()
  speakers.forEach((speaker, i) => {
    map.set(speaker, SPEAKER_COLORS[i % SPEAKER_COLORS.length])
  })
  return map
}

/** Minimal markdown → HTML renderer (bold, headings, lists, horizontal rules) */
function renderMarkdown(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      // Horizontal rule
      if (/^---+$/.test(line.trim())) {
        return '<hr class="my-4 border-border" />'
      }
      // Headings
      if (line.startsWith('### ')) {
        return `<h3 class="text-base font-semibold text-foreground mt-6 mb-2">${escapeHtml(line.slice(4))}</h3>`
      }
      if (line.startsWith('## ')) {
        return `<h2 class="text-lg font-bold text-foreground mt-8 mb-3">${escapeHtml(line.slice(3))}</h2>`
      }
      if (line.startsWith('# ')) {
        return `<h1 class="text-xl font-bold text-foreground mt-8 mb-3">${escapeHtml(line.slice(2))}</h1>`
      }
      // Bold
      let processed = escapeHtml(line).replace(
        /\*\*(.+?)\*\*/g,
        '<strong class="font-semibold text-foreground">$1</strong>',
      )
      // Inline code
      processed = processed.replace(
        /`(.+?)`/g,
        '<code class="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">$1</code>',
      )
      // Bullet list items
      if (/^\s*[-*]\s/.test(line)) {
        return `<div class="flex gap-2 ml-4 my-0.5"><span class="text-primary">•</span><span>${processed.replace(/^\s*[-*]\s/, '')}</span></div>`
      }
      // Empty lines
      if (line.trim() === '') {
        return '<div class="h-2" />'
      }
      // Regular paragraph
      return `<p class="my-1 leading-relaxed">${processed}</p>`
    })
    .join('\n')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
