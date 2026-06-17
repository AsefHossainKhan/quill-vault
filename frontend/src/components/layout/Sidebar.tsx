import { useNavigate, useLocation } from 'react-router-dom'
import {
  FolderOpen,
  Settings,
  User,
  HelpCircle,
  LifeBuoy,
  Search,
  Plus,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { ResizeHandle } from '../ui/ResizeHandle'
import { useTheme } from '../../hooks/useTheme'
import { useAuthStore } from '../../stores/authStore'
import { useSettingsStore } from '../../stores/settingsStore'

interface RecordingItem {
  id: string
  name: string
  date: string
  duration: string
}

interface SidebarProps {
  recordings?: RecordingItem[]
}

const navItems = [
  { label: 'Library', icon: FolderOpen, path: '/' },
  { label: 'Settings', icon: Settings, path: '/settings' },
  { label: 'Profile', icon: User, path: '/profile' },
]

const bottomItems = [
  { label: 'Help', icon: HelpCircle },
  { label: 'Support', icon: LifeBuoy },
]

export function Sidebar({ recordings = [] }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const { theme, cycleTheme } = useTheme()
  const sidebarWidth = useSettingsStore((s) => s.sidebarWidth)
  const saveSettings = useSettingsStore((s) => s.save)

  // Extract active recording ID from URL (/recording/:id)
  const activeRecordingId = location.pathname.startsWith('/recording/')
    ? location.pathname.split('/')[2]
    : null

  return (
    <aside
      className="relative flex h-full flex-col border-r border-border bg-card"
      style={{ width: sidebarWidth }}
    >
      {/* Resize handle — right edge */}
      <ResizeHandle
        side="right"
        width={sidebarWidth}
        onResize={(w) => saveSettings({ sidebarWidth: w })}
        minWidth={180}
        maxWidth={400}
      />
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <img
          src="/quillvault-logo.png"
          alt="QuillVault"
          className="h-8 w-8 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold leading-tight text-card-foreground truncate">
            QuillVault
          </h1>
          <p className="text-xs text-muted-foreground">Transcription Hub</p>
        </div>
      </div>

      {/* New Recording button */}
      <div className="px-3 pb-3">
        <Button
          onClick={() => navigate('/record')}
          className="w-full justify-start gap-2"
        >
          <Plus className="h-4 w-4" />
          New Recording
        </Button>
      </div>

      {/* Navigation */}
      <nav className="px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/' || location.pathname.startsWith('/recording')
            : location.pathname === item.path

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-4 border-t border-border" />

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">Search recordings...</span>
        </div>
      </div>

      {/* Recent Recordings */}
      <div className="flex-1 overflow-y-auto px-3">
        <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Recordings
        </h3>
        <div className="space-y-0.5">
          {recordings.map((rec) => {
            const isActive = rec.id === activeRecordingId
            return (
              <button
                key={rec.id}
                onClick={() => navigate(`/recording/${rec.id}`)}
                className={cn(
                  'flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors group min-w-0 overflow-hidden',
                  isActive
                    ? 'bg-accent border-l-2 border-primary'
                    : 'hover:bg-accent',
                )}
              >
                <span className={cn(
                  'text-sm font-medium truncate block',
                  isActive ? 'text-foreground' : 'text-card-foreground group-hover:text-accent-foreground',
                )}>
                  {rec.name}
                </span>
                <span className="text-xs text-muted-foreground truncate block">
                  {rec.date} &middot; {rec.duration}
                </span>
              </button>
            )
          })}
          {recordings.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              No recordings yet
            </p>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="border-t border-border px-3 py-3 space-y-0.5">
        {bottomItems.map((item) => (
          <button
            key={item.label}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </button>
        ))}

        {/* Divider */}
        <div className="my-1 border-t border-border" />

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {theme === 'light' && <Sun className="h-4 w-4 shrink-0" />}
          {theme === 'dark' && <Moon className="h-4 w-4 shrink-0" />}
          {theme === 'system' && <Monitor className="h-4 w-4 shrink-0" />}
          <span>Theme</span>
        </button>

        {/* Logout */}
        <button
          onClick={() => {
            logout()
            navigate('/auth/login')
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
