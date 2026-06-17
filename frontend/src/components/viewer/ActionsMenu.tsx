import { useState, useRef, useEffect } from 'react'
import {
  MoreVertical,
  Copy,
  Download,
  Pencil,
  Sparkles,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Transcript, TranscriptType } from '../../types/api'

interface ActionsMenuProps {
  recordingName: string
  transcripts: Transcript[]
  activeTranscriptType: TranscriptType
  onRename: (newName: string) => void
  onAutoName: () => Promise<void>
  onDelete: () => void
  autoNaming?: boolean
}

export function ActionsMenu({
  recordingName,
  transcripts,
  activeTranscriptType,
  onRename,
  onAutoName,
  onDelete,
  autoNaming = false,
}: ActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(recordingName)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setRenaming(false)
        setConfirmDelete(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [renaming])

  // Sync rename value when recordingName changes
  useEffect(() => {
    setRenameValue(recordingName)
  }, [recordingName])

  function handleCopy() {
    const transcript = transcripts.find((t) => t.type === activeTranscriptType)
    if (!transcript) return

    // Format content nicely
    let text: string
    try {
      const segments = JSON.parse(transcript.content)
      if (Array.isArray(segments)) {
        text = segments
          .map((seg: any) => {
            const ts = `[${Math.floor(seg.start / 60)}:${String(Math.floor(seg.start % 60)).padStart(2, '0')}]`
            const speaker = seg.speaker ? `${seg.speaker}: ` : ''
            return `${ts} ${speaker}${seg.text}`
          })
          .join('\n')
      } else {
        text = transcript.content
      }
    } catch {
      text = transcript.content
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
    setOpen(false)
  }

  function handleExport() {
    const transcript = transcripts.find((t) => t.type === activeTranscriptType)
    if (!transcript) return

    let text: string
    try {
      const segments = JSON.parse(transcript.content)
      if (Array.isArray(segments)) {
        const lines = [`# ${recordingName}\n`]
        let currentSpeaker = ''
        for (const seg of segments) {
          const speaker = seg.speaker || ''
          if (speaker && speaker !== currentSpeaker) {
            lines.push(`\n**${speaker}:**\n`)
            currentSpeaker = speaker
          }
          lines.push(seg.text)
        }
        text = lines.join(' ')
      } else {
        text = transcript.content
      }
    } catch {
      text = transcript.content
    }

    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${recordingName.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'transcript'}.md`
    a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  function handleRenameSubmit() {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== recordingName) {
      onRename(trimmed)
    }
    setRenaming(false)
    setOpen(false)
  }

  async function handleAutoName() {
    setOpen(false)
    await onAutoName()
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete()
      setOpen(false)
      setConfirmDelete(false)
    } else {
      setConfirmDelete(true)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          open
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
        title="Actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg">
          {/* Rename section */}
          {renaming ? (
            <div className="px-2 py-1.5">
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit()
                  if (e.key === 'Escape') { setRenaming(false); setRenameValue(recordingName) }
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Recording name"
              />
              <div className="mt-2 flex justify-end gap-1.5">
                <button
                  onClick={() => { setRenaming(false); setRenameValue(recordingName) }}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenameSubmit}
                  className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <MenuItem
                icon={copied ? Check : Copy}
                label={copied ? 'Copied!' : 'Copy transcript'}
                onClick={handleCopy}
                disabled={!transcripts.find((t) => t.type === activeTranscriptType)}
              />
              <MenuItem
                icon={Download}
                label="Export as Markdown"
                onClick={handleExport}
                disabled={!transcripts.find((t) => t.type === activeTranscriptType)}
              />

              <div className="mx-2 my-1 border-t border-border" />

              <MenuItem
                icon={Pencil}
                label="Rename"
                onClick={() => setRenaming(true)}
              />
              <MenuItem
                icon={autoNaming ? Loader2 : Sparkles}
                label={autoNaming ? 'Generating name…' : 'Auto-generate name'}
                onClick={handleAutoName}
                disabled={autoNaming}
                iconClassName={autoNaming ? 'animate-spin' : ''}
              />

              <div className="mx-2 my-1 border-t border-border" />

              <MenuItem
                icon={Trash2}
                label={confirmDelete ? 'Click again to confirm' : 'Delete recording'}
                onClick={handleDeleteClick}
                variant="destructive"
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Menu Item ─────────────────────────────────────────────────────────────────

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  variant = 'default',
  iconClassName,
}: {
  icon: typeof Copy
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'destructive'
  iconClassName?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
        variant === 'destructive'
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-muted',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', iconClassName)} />
      {label}
    </button>
  )
}
