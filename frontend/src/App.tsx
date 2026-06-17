import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { useTheme } from './hooks/useTheme'
import { useRecordings } from './hooks/useRecordings'
import { TitleBar } from './components/layout/TitleBar'
import { AppShell } from './components/layout/AppShell'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import NewRecording from './pages/NewRecording'
import UploadAudio from './pages/UploadAudio'
import Templates from './pages/Templates'
import Settings from './pages/Settings'

/** Wrapper that provides recordings to AppShell for the /record route */
function RecordRoute() {
  const { sidebarRecordings } = useRecordings()
  return (
    <AppShell recordings={sidebarRecordings}>
      <NewRecording />
    </AppShell>
  )
}

/** Wrapper that provides recordings to AppShell for the /upload route */
function UploadRoute() {
  const { sidebarRecordings } = useRecordings()
  return (
    <AppShell recordings={sidebarRecordings}>
      <UploadAudio />
    </AppShell>
  )
}

/** Wrapper that provides recordings to AppShell for the /templates route */
function TemplatesRoute() {
  const { sidebarRecordings } = useRecordings()
  return (
    <AppShell recordings={sidebarRecordings}>
      <Templates />
    </AppShell>
  )
}

/** Wrapper that provides recordings to AppShell for the /settings route */
function SettingsRoute() {
  const { sidebarRecordings } = useRecordings()
  return (
    <AppShell recordings={sidebarRecordings}>
      <Settings />
    </AppShell>
  )
}

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
          <Route
            path="/auth/register"
            element={
              <GuestOnly>
                <Register />
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
                <RecordRoute />
              </RequireAuth>
            }
          />

          {/* Upload audio file */}
          <Route
            path="/upload"
            element={
              <RequireAuth>
                <UploadRoute />
              </RequireAuth>
            }
          />

          {/* Templates manager */}
          <Route
            path="/templates"
            element={
              <RequireAuth>
                <TemplatesRoute />
              </RequireAuth>
            }
          />

          {/* Settings page */}
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsRoute />
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
