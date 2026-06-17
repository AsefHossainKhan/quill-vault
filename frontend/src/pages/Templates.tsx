import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  X,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/Dialog'
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../api/templates'
import type { Template } from '../types/api'

const EMOJI_OPTIONS = ['📋', '📝', '✅', '📧', '🎯', '📊', '📌', '📎', '📑', '💡', '🔑', '📣']

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Template | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await listTemplates()
      setTemplates(data)
    } catch {
      setError('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = () => setMenuOpen(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpen])

  const builtinTemplates = templates.filter((t) => t.is_builtin)
  const customTemplates = templates.filter((t) => !t.is_builtin)

  function openCreate() {
    setEditingTemplate(null)
    setEditOpen(true)
  }

  function openEdit(template: Template) {
    setEditingTemplate(template)
    setEditOpen(true)
    setMenuOpen(null)
  }

  async function handleDelete(template: Template) {
    setDeleteConfirm(null)
    setMenuOpen(null)
    try {
      await deleteTemplate(template.id)
      setTemplates((prev) => prev.filter((t) => t.id !== template.id))
    } catch {
      setError('Failed to delete template')
    }
  }

  function handleSaved(template: Template, isNew: boolean) {
    if (isNew) {
      setTemplates((prev) => [...prev, template])
    } else {
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)))
    }
    setEditOpen(false)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">Templates</h1>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Built-in templates */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Built-in
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {builtinTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        </section>

        {/* Custom templates */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            My Templates
          </h2>
          {customTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No custom templates yet
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={openCreate}
                className="mt-3 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Create your first template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {customTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={() => openEdit(template)}
                  onDelete={() => setDeleteConfirm(template)}
                  menuOpen={menuOpen === template.id}
                  onMenuToggle={() =>
                    setMenuOpen(menuOpen === template.id ? null : template.id)
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Create / Edit dialog */}
      <TemplateFormDialog
        isOpen={editOpen}
        template={editingTemplate}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteConfirm?.name}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Template Card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: Template
  onEdit?: () => void
  onDelete?: () => void
  menuOpen?: boolean
  onMenuToggle?: () => void
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
  menuOpen,
  onMenuToggle,
}: TemplateCardProps) {
  const isCustom = !template.is_builtin

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between">
        <span className="text-2xl">{template.icon}</span>
        {isCustom && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMenuToggle?.()
              }}
              className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-10 w-36 rounded-lg border border-border bg-card py-1 shadow-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit?.()
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete?.()
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <h3 className="mt-3 text-sm font-medium text-foreground truncate">
        {template.name}
      </h3>
      <p className="text-xs text-muted-foreground">
        {template.category}
        {template.is_builtin && (
          <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            Built-in
          </span>
        )}
      </p>
    </div>
  )
}

// ── Template Form Dialog ─────────────────────────────────────────────────────

interface TemplateFormDialogProps {
  isOpen: boolean
  template: Template | null // null = create mode
  onClose: () => void
  onSaved: (template: Template, isNew: boolean) => void
}

function TemplateFormDialog({
  isOpen,
  template,
  onClose,
  onSaved,
}: TemplateFormDialogProps) {
  const isNew = !template
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📋')
  const [category, setCategory] = useState('General')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName(template?.name || '')
      setIcon(template?.icon || '📋')
      setCategory(template?.category || 'General')
      setSystemPrompt(template?.system_prompt || '')
      setError(null)
    }
  }, [isOpen, template])

  async function handleSave() {
    if (!name.trim() || !systemPrompt.trim()) return

    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        const created = await createTemplate({
          name: name.trim(),
          icon,
          category: category.trim() || 'General',
          system_prompt: systemPrompt.trim(),
        })
        onSaved(created, true)
      } else {
        const updated = await updateTemplate(template!.id, {
          name: name.trim(),
          icon,
          category: category.trim() || 'General',
          system_prompt: systemPrompt.trim(),
        })
        onSaved(updated, false)
      }
    } catch (err: unknown) {
      let message = 'Failed to save template'
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } }
        if (axiosErr.response?.data?.detail) {
          message = axiosErr.response.data.detail
        }
      }
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New Template' : 'Edit Template'}</DialogTitle>
          <DialogDescription>
            {isNew
              ? 'Create a custom template for generating output from transcripts.'
              : 'Update this template\'s name, icon, and prompt.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Icon picker */}
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors',
                    icon === emoji
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-name">Name</Label>
            <Input
              id="tmpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint Retro"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-category">Category</Label>
            <Input
              id="tmpl-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Meetings"
            />
          </div>

          {/* System Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-prompt">System Prompt</Label>
            <textarea
              id="tmpl-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant that summarizes meeting transcripts..."
              rows={6}
              className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This prompt tells the AI how to format the output. The transcript will be appended automatically.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !systemPrompt.trim()}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isNew ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
