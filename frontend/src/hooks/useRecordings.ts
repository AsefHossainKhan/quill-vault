import { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { listRecordings } from '../api/recordings'
import type { Recording } from '../types/api'

/**
 * Shared hook for fetching recordings list.
 * Used by both Dashboard and the /record route so the sidebar always has data.
 * Re-fetches on route change so sidebar shows fresh data (e.g. duration after pipeline).
 */
export function useRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const { pathname } = useLocation()

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listRecordings()
      setRecordings(data)
    } catch {
      setRecordings([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Re-fetch whenever the route changes (navigating between recordings, etc.)
  useEffect(() => {
    refresh()
  }, [refresh, pathname])

  // Map to sidebar format
  const sidebarRecordings = recordings.map((rec) => ({
    id: rec.id,
    name: rec.name,
    date: new Date(rec.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    duration: rec.duration_seconds != null ? formatDuration(rec.duration_seconds) : '--:--',
  }))

  return { recordings, sidebarRecordings, loading, refresh }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
