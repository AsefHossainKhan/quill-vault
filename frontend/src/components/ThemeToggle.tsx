import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type Theme } from '../hooks/useTheme'
import { cn } from '../lib/utils'

const icons: Record<Theme, React.ReactNode> = {
  light: <Sun className="h-4 w-4" />,
  dark: <Moon className="h-4 w-4" />,
  system: <Monitor className="h-4 w-4" />,
}

const labels: Record<Theme, string> = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System theme',
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, cycleTheme } = useTheme()

  return (
    <button
      onClick={cycleTheme}
      title={labels[theme]}
      aria-label={labels[theme]}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full',
        'border border-border bg-card text-muted-foreground',
        'shadow-sm transition-colors hover:bg-accent hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      {icons[theme]}
    </button>
  )
}
