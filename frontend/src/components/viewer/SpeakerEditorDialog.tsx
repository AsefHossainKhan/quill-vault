import { useState, useEffect } from 'react'
import { Loader2, Users } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/Dialog'
import { getSpeakers, updateSpeakers } from '../../api/recordings'
import type { Speaker } from '../../types/api'

/** Predefined speaker colors (matching transcript color scheme) */
const SPEAKER_COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-teal-500',
]

interface SpeakerEditorDialogProps {
  recordingId: string
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}

export function SpeakerEditorDialog({
  recordingId,
  isOpen,
  onClose,
  onSaved,
}: SpeakerEditorDialogProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch speakers when dialog opens
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await getSpeakers(recordingId)
        if (cancelled) return
        setSpeakers(data)
        // Initialize name map
        const nameMap: Record<string, string> = {}
        for (const s of data) {
          nameMap[s.label] = s.name || ''
        }
        setNames(nameMap)
      } catch {
        if (!cancelled) setError('Failed to load speakers')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [isOpen, recordingId])

  function handleNameChange(label: string, value: string) {
    setNames((prev) => ({ ...prev, [label]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const payload = speakers.map((s) => ({
        label: s.label,
        name: names[s.label]?.trim() || null,
      }))
      await updateSpeakers(recordingId, payload)
      onSaved?.()
      onClose()
    } catch {
      setError('Failed to save speaker names')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Edit Speaker Names
          </DialogTitle>
          <DialogDescription>
            Assign names to identified speakers. Changes will update the Named Transcript.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : speakers.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No speakers found. Run diarization first.
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {speakers.map((speaker, i) => (
              <div
                key={speaker.id}
                className="flex items-center gap-3"
              >
                {/* Color dot */}
                <div
                  className={cn(
                    'h-3 w-3 rounded-full shrink-0',
                    SPEAKER_COLORS[i % SPEAKER_COLORS.length],
                  )}
                />
                {/* Label */}
                <span className="w-24 shrink-0 text-sm font-medium text-foreground">
                  {speaker.label}
                </span>
                {/* Name input */}
                <Input
                  value={names[speaker.label] || ''}
                  onChange={(e) => handleNameChange(speaker.label, e.target.value)}
                  placeholder="Enter name..."
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving || speakers.length === 0}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
