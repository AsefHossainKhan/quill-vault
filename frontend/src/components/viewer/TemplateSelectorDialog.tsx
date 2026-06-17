import { useState, useEffect } from 'react'
import { Loader2, FileText, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/Dialog'
import { getTemplates, generateOutput } from '../../api/recordings'
import type { Template } from '../../types/api'

interface TemplateSelectorDialogProps {
  recordingId: string
  isOpen: boolean
  onClose: () => void
  onGenerated?: () => void
}

export function TemplateSelectorDialog({
  recordingId,
  isOpen,
  onClose,
  onGenerated,
}: TemplateSelectorDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch templates when dialog opens
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await getTemplates()
        if (cancelled) return
        setTemplates(data)
        // Auto-select first template
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id)
        }
      } catch {
        if (!cancelled) setError('Failed to load templates')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    if (!selectedId) return

    setGenerating(true)
    setError(null)
    try {
      await generateOutput(recordingId, selectedId)
      onGenerated?.()
      onClose()
    } catch {
      setError('Failed to generate output')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generate Output
          </DialogTitle>
          <DialogDescription>
            Choose a template to generate a structured output from the named transcript.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No templates available.
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                  selectedId === template.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent',
                )}
              >
                <span className="text-xl">{template.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {template.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {template.category}
                    {template.is_builtin && ' · Built-in'}
                  </p>
                </div>
                {selectedId === template.id && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading || generating || !selectedId}
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
