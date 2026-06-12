import { useEffect, useCallback } from 'react'
import { useSettingsStore } from '../stores/settingsStore'

export type Theme = 'light' | 'dark' | 'system'

/**
 * Applies the resolved theme to <html> and listens for system preference changes.
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(prefersDark ? 'dark' : 'light')
  } else {
    root.classList.add(theme)
  }
}

/**
 * Hook to manage light / dark / system theme.
 * Persists the user's choice to the settings store (electron-store).
 */
export function useTheme() {
  const theme = useSettingsStore((s) => s.theme)
  const save = useSettingsStore((s) => s.save)

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Listen for OS-level preference changes when in "system" mode
  useEffect(() => {
    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback(
    (next: Theme) => {
      save({ theme: next })
    },
    [save],
  )

  /** Cycle through light → dark → system */
  const cycleTheme = useCallback(() => {
    const order: Theme[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme)
    const next = order[(idx + 1) % order.length]
    save({ theme: next })
  }, [theme, save])

  return { theme, setTheme, cycleTheme }
}
