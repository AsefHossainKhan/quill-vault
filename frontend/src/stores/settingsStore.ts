import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme } from '../hooks/useTheme'

interface Settings {
  theme: Theme
  backendUrl: string
  chatOpen: boolean
}

interface SettingsState extends Settings {
  save: (partial: Partial<Settings>) => void
  setChatOpen: (open: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      backendUrl: 'http://localhost:8000',
      chatOpen: false,

      save: (partial) => set({ ...get(), ...partial }),
      setChatOpen: (open) => set({ chatOpen: open }),
    }),
    {
      name: 'quillvault-settings',
    },
  ),
)
