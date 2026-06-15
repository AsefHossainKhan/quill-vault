import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask about this document…',
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea as user types
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [value])

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent px-2 py-1.5 text-sm',
            'placeholder:text-muted-foreground focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            value.trim() && !disabled
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-muted-foreground/40 cursor-not-allowed',
          )}
          title="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
