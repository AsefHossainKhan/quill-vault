import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

interface RecordingItem {
  id: string
  name: string
  date: string
  duration: string
}

interface AppShellProps {
  children: ReactNode
  recordings?: RecordingItem[]
}

export function AppShell({ children, recordings = [] }: AppShellProps) {
  return (
    <div className="flex h-full overflow-hidden bg-background">
      <Sidebar recordings={recordings} />

      {/* Main content area */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
