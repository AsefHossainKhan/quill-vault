import { useState, useEffect } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { listTemplates } from '../../api/templates'
import type { Template } from '../../types/api'

interface TemplateSelectorProps {
  value: string | null
  onChange: (templateId: string | null) => void
  disabled?: boolean
}

export function TemplateSelector({
  value,
  onChange,
  disabled = false,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    listTemplates()
      .then((data) => {
        if (!cancelled) setTemplates(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = () => setOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  const selected = templates.find((t) => t.id === value) || null

  if (loading) {
    return (
      <div className="flex h-10 items-center rounded-lg border border-border bg-background px-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) setOpen(!open)
        }}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'hover:border-primary/50 cursor-pointer',
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? (
            <>
              <span className="mr-1.5">{selected.icon}</span>
              {selected.name}
            </>
          ) : (
            'No template (default)'
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-20 w-full max-h-60 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {/* No template option */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
              setOpen(false)
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent',
              !value && 'bg-accent text-primary font-medium',
            )}
          >
            <span className="w-6 text-center text-muted-foreground">—</span>
            <span>No template (default)</span>
          </button>

          {templates.length > 0 && <div className="my-1 border-t border-border" />}

          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(template.id)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent',
                value === template.id && 'bg-accent text-primary font-medium',
              )}
            >
              <span className="w-6 text-center">{template.icon}</span>
              <span className="truncate">{template.name}</span>
              {template.is_builtin && (
                <span className="ml-auto text-[10px] text-muted-foreground">Built-in</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
