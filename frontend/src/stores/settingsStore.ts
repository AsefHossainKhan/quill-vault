import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme } from '../hooks/useTheme'

interface Settings {
  theme: Theme
  backendUrl: string
}

interface SettingsState extends Settings {
  save: (partial: Partial<Settings>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      backendUrl: 'http://localhost:8000',

      save: (partial) => set({ ...get(), ...partial }),
    }),
    {
      name: 'quillvault-settings',
    },
  ),
)
