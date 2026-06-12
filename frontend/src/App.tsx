import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { useTheme } from './hooks/useTheme'
import { TitleBar } from './components/layout/TitleBar'
import { AppShell } from './components/layout/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewRecording from './pages/NewRecording'

/** Redirect unauthenticated users to login */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth/login" replace />
}

/** Redirect authenticated users away from auth pages */
function GuestOnly({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>
}

export default function App() {
  // Apply saved theme on mount
  useTheme()

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* TitleBar — always visible, draggable + window controls */}
      <TitleBar />

      <HashRouter>
        <Routes>
          {/* Auth routes */}
          <Route
            path="/auth/login"
            element={
              <GuestOnly>
                <Login />
              </GuestOnly>
            }
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />

          {/* Recording detail — same Dashboard shell, recordingId in URL */}
          <Route
            path="/recording/:recordingId"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />

          {/* New recording — full-screen overlay within main content */}
          <Route
            path="/record"
            element={
              <RequireAuth>
                <AppShell>
                  <NewRecording />
                </AppShell>
              </RequireAuth>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </div>
  )
}
