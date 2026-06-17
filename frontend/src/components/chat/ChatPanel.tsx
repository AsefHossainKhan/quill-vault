import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2, MessageSquare, RotateCcw, ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ResizeHandle } from '../ui/ResizeHandle'
import { useSettingsStore } from '../../stores/settingsStore'
import { getChatMessages, sendChatMessage, resetChat } from '../../api/chat'
import type { ChatMessage as ChatMessageType, TranscriptType } from '../../types/api'

interface ChatPanelProps {
  recordingId: string
  isOpen: boolean
  onClose: () => void
  /** Which transcript types are available for this recording */
  availableTranscriptTypes?: TranscriptType[]
}

const CONTEXT_OPTIONS: { id: TranscriptType; label: string; description: string }[] = [
  { id: 'raw', label: 'Raw', description: 'Unprocessed transcription' },
  { id: 'diarized', label: 'Diarized', description: 'Speaker-separated' },
  { id: 'named', label: 'Named', description: 'Speakers identified' },
  { id: 'output', label: 'Output', description: 'Formatted meeting notes' },
]

export function ChatPanel({
  recordingId,
  isOpen,
  onClose,
  availableTranscriptTypes = [],
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedContexts, setSelectedContexts] = useState<TranscriptType[]>(['named'])
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasLoadedRef = useRef(false)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // ── Close context menu on outside click ──────────────────────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuOpen(false)
      }
    }
    if (contextMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenuOpen])

  // ── Sync available types with selection ──────────────────────────────────

  useEffect(() => {
    // If none of the selected types are available, fall back to first available
    const valid = selectedContexts.filter((t) => availableTranscriptTypes.includes(t))
    if (valid.length === 0 && availableTranscriptTypes.length > 0) {
      setSelectedContexts([availableTranscriptTypes[0]])
    } else if (valid.length !== selectedContexts.length) {
      setSelectedContexts(valid)
    }
  }, [availableTranscriptTypes]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load history ─────────────────────────────────────────────────────────

  const loadMessages = useCallback(async () => {
    if (!isOpen) return
    try {
      setLoading(true)
      setError(null)
      const data = await getChatMessages(recordingId)
      setMessages(data)
      hasLoadedRef.current = true
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load chat history')
    } finally {
      setLoading(false)
    }
  }, [recordingId, isOpen])

  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      loadMessages()
    }
  }, [isOpen, loadMessages])

  // Reset when recording changes
  useEffect(() => {
    hasLoadedRef.current = false
    setMessages([])
    setError(null)
  }, [recordingId])

  // ── Auto-scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, sending])

  // ── Send message ─────────────────────────────────────────────────────────

  async function handleSend(text: string) {
    const userMsg: ChatMessageType = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)
    setError(null)

    try {
      await sendChatMessage(recordingId, text, selectedContexts)
      await loadMessages()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (err.code === 'ECONNABORTED') {
        setError('Request timed out. The AI may be loading — please try again.')
      } else {
        setError(detail || 'Failed to get response')
      }
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
    } finally {
      setSending(false)
    }
  }

  // ── Reset chat ───────────────────────────────────────────────────────────

  async function handleReset() {
    if (sending) return
    try {
      await resetChat(recordingId)
      setMessages([])
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to reset chat')
    }
  }

  // ── Context toggle ───────────────────────────────────────────────────────

  function toggleContext(type: TranscriptType) {
    setSelectedContexts((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (!isOpen) return null

  const availableOptions = CONTEXT_OPTIONS.filter((o) =>
    availableTranscriptTypes.includes(o.id),
  )

  const chatWidth = useSettingsStore((s) => s.chatWidth)
  const saveSettings = useSettingsStore((s) => s.save)

  return (
    <div
      className="relative flex h-full flex-col border-l border-border bg-card"
      style={{ width: chatWidth }}
    >
      {/* Resize handle — left edge */}
      <ResizeHandle
        side="left"
        width={chatWidth}
        onResize={(w) => saveSettings({ chatWidth: w })}
        minWidth={260}
        maxWidth={500}
      />
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Document Chat</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            disabled={sending || messages.length === 0}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reset chat"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Context selector */}
      {availableOptions.length > 0 && (
        <div className="border-b border-border px-4 py-2">
          <div className="relative" ref={contextMenuRef}>
            <button
              onClick={() => setContextMenuOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:border-primary/40"
            >
              <span className="text-muted-foreground">
                Context:{' '}
                <span className="font-medium text-foreground">
                  {selectedContexts.length === 0
                    ? 'None'
                    : selectedContexts
                        .map((t) => CONTEXT_OPTIONS.find((o) => o.id === t)?.label)
                        .join(', ')}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-3 w-3 text-muted-foreground transition-transform',
                  contextMenuOpen && 'rotate-180',
                )}
              />
            </button>

            {contextMenuOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border bg-card p-1 shadow-md">
                {availableOptions.map((opt) => {
                  const isSelected = selectedContexts.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleContext(opt.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                        isSelected
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-3.5 w-3.5 items-center justify-center rounded border',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border',
                        )}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5" />}
                      </div>
                      <span className="font-medium">{opt.label}</span>
                      <span className="ml-auto text-muted-foreground">{opt.description}</span>
                    </button>
                  )
                })}
                <p className="px-2.5 pt-1.5 text-[10px] text-muted-foreground/60">
                  Select transcripts to include as context
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading chat…</p>
            </div>
          </div>
        ) : error && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="text-center">
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={loadMessages}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Ask questions about this transcript
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Choose which transcripts to use as context above
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {sending && (
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-muted px-3.5 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {error && messages.length > 0 && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  )
}
