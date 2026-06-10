# QuillVault v2 — Frontend Development Guide
> Electron + React + TypeScript desktop application

---

## 1. Technology Stack

| Concern | Technology | Version |
|---------|-----------|---------|
| Desktop shell | Electron | 31.x |
| Build system | electron-vite | 2.x |
| UI framework | React | 18.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui | latest |
| Server state | TanStack Query (React Query) | 5.x |
| Client state | Zustand | 4.x |
| Routing | React Router DOM | 6.x |
| HTTP client | Axios | 1.x |
| Forms | React Hook Form + Zod | 7.x + 3.x |
| Waveform | WaveSurfer.js | 7.x |
| Markdown render | react-markdown + remark-gfm | latest |
| Markdown editor | CodeMirror 6 | latest |
| Local storage | electron-store | 10.x |
| Icons | lucide-react | latest |
| Date formatting | date-fns | 3.x |

---

## 2. Project Structure

```
desktop-app/
├── electron.vite.config.ts       # Build config
├── package.json
├── tsconfig.json
├── tsconfig.node.json
│
├── src/
│   ├── main/                     # Electron main process
│   │   ├── index.ts              # Entry: BrowserWindow, app lifecycle
│   │   ├── ipc/
│   │   │   ├── audio.ts          # IPC handlers: desktopCapturer, device enum
│   │   │   ├── file.ts           # IPC handlers: save dialog, file read
│   │   │   └── store.ts          # IPC handlers: electron-store get/set
│   │   ├── tray.ts               # System tray setup
│   │   └── updater.ts            # Auto-updater
│   │
│   ├── preload/
│   │   └── index.ts              # contextBridge expose API to renderer
│   │
│   └── renderer/                 # React app
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx          # React entry
│       │   ├── App.tsx           # Router + Provider setup
│       │   │
│       │   ├── api/              # Axios instances + endpoint functions
│       │   │   ├── client.ts     # Axios instance, interceptors
│       │   │   ├── auth.ts
│       │   │   ├── recordings.ts
│       │   │   ├── jobs.ts
│       │   │   ├── transcripts.ts
│       │   │   ├── templates.ts
│       │   │   ├── speakers.ts
│       │   │   └── chat.ts
│       │   │
│       │   ├── hooks/            # Custom React hooks
│       │   │   ├── useAudioRecorder.ts
│       │   │   ├── useJobPoller.ts
│       │   │   ├── useAuth.ts
│       │   │   └── useSettings.ts
│       │   │
│       │   ├── stores/           # Zustand stores
│       │   │   ├── authStore.ts
│       │   │   ├── settingsStore.ts
│       │   │   └── recordingStore.ts
│       │   │
│       │   ├── pages/
│       │   │   ├── Login.tsx
│       │   │   ├── Register.tsx
│       │   │   ├── ForgotPassword.tsx
│       │   │   ├── Dashboard.tsx
│       │   │   ├── NewRecording.tsx
│       │   │   ├── UploadAudio.tsx
│       │   │   ├── DocumentViewer.tsx
│       │   │   ├── Templates.tsx
│       │   │   └── Settings.tsx
│       │   │
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── AppShell.tsx
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   ├── TitleBar.tsx
│       │   │   │   └── RecordingListItem.tsx
│       │   │   ├── recording/
│       │   │   │   ├── Waveform.tsx
│       │   │   │   ├── ChannelStatus.tsx
│       │   │   │   ├── RecordingControls.tsx
│       │   │   │   └── AudioDeviceSelector.tsx
│       │   │   ├── document/
│       │   │   │   ├── PipelineStatus.tsx
│       │   │   │   ├── TabRawTranscript.tsx
│       │   │   │   ├── TabDiarized.tsx
│       │   │   │   ├── TabNamed.tsx
│       │   │   │   ├── TabOutput.tsx
│       │   │   │   └── SpeakerBlock.tsx
│       │   │   ├── chat/
│       │   │   │   ├── ChatPanel.tsx
│       │   │   │   ├── ChatMessage.tsx
│       │   │   │   └── ChatInput.tsx
│       │   │   └── ui/           # shadcn/ui generated components
│       │   │
│       │   ├── types/
│       │   │   ├── api.ts        # API response shapes
│       │   │   └── domain.ts     # Domain models
│       │   │
│       │   └── lib/
│       │       ├── utils.ts      # cn() and generic helpers
│       │       └── constants.ts  # PIPELINE_STAGES, etc.
```

---

## 3. Electron Architecture

### 3.1 Process Model

```
Main Process (Node.js)
├── Creates BrowserWindow
├── Manages: desktopCapturer, file dialogs, electron-store, auto-update, tray
└── IPC bridge (ipcMain handlers)
         ↕ contextBridge (ipcRenderer)
Renderer Process (Chromium + React)
├── All UI code
├── Audio recording via Web Audio API
└── Communicates to backend via Axios (HTTP, not IPC)
```

**Rule:** Never access Node.js APIs directly from renderer. Use IPC bridge only.

### 3.2 Preload Script

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Audio
  getDesktopSources: () => ipcRenderer.invoke('audio:get-desktop-sources'),
  getAudioDevices: () => ipcRenderer.invoke('audio:get-devices'),
  
  // File
  showSaveDialog: (options: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke('file:save-dialog', options),
  writeFile: (filePath: string, data: Uint8Array) =>
    ipcRenderer.invoke('file:write', filePath, data),
  
  // Settings (electron-store)
  getSettings: (key: string) => ipcRenderer.invoke('store:get', key),
  setSettings: (key: string, value: unknown) =>
    ipcRenderer.invoke('store:set', key, value),
  
  // Window
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
})

// Type declaration for renderer
declare global {
  interface Window {
    electronAPI: typeof import('./index').electronAPI
  }
}
```

### 3.3 Main Process IPC Handlers

```typescript
// src/main/ipc/audio.ts
import { ipcMain, desktopCapturer } from 'electron'

export function registerAudioHandlers() {
  ipcMain.handle('audio:get-desktop-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      fetchWindowIcons: false,
    })
    return sources.map((s) => ({ id: s.id, name: s.name }))
  })
}
```

---

## 4. Audio Recording

This is the most critical and complex feature. Two independent channels must be captured and kept separate.

### 4.1 Architecture

```
┌─────────────────────────┐    ┌──────────────────────────┐
│  Mic Stream             │    │  System Audio Stream      │
│  getUserMedia()         │    │  desktopCapturer (IPC)   │
│  ↓                      │    │  getUserMedia(chromeMedia)│
│  AudioContext (mic)     │    │  ↓                        │
│  AnalyserNode (levels)  │    │  AudioContext (system)    │
│  MediaRecorder          │    │  AnalyserNode (levels)   │
│  → Blob chunks          │    │  MediaRecorder           │
└─────────────────────────┘    │  → Blob chunks           │
                               └──────────────────────────┘
                                          ↓
                               Both blobs → upload as
                               multipart form data
```

### 4.2 `useAudioRecorder` Hook

```typescript
// src/renderer/src/hooks/useAudioRecorder.ts
import { useState, useRef, useCallback, useEffect } from 'react'

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped'

interface AudioRecorderResult {
  state: RecorderState
  duration: number
  micLevel: number    // 0–100
  systemLevel: number // 0–100
  micBlob: Blob | null
  systemBlob: Blob | null
  start: (micDeviceId: string) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => Promise<void>
  discard: () => void
  micAnalyserNode: AnalyserNode | null
  systemAnalyserNode: AnalyserNode | null
}

export function useAudioRecorder(): AudioRecorderResult {
  const [state, setState] = useState<RecorderState>('idle')
  const [duration, setDuration] = useState(0)
  const [micLevel, setMicLevel] = useState(0)
  const [systemLevel, setSystemLevel] = useState(0)
  const [micBlob, setMicBlob] = useState<Blob | null>(null)
  const [systemBlob, setSystemBlob] = useState<Blob | null>(null)

  const micRecorderRef = useRef<MediaRecorder | null>(null)
  const systemRecorderRef = useRef<MediaRecorder | null>(null)
  const micChunksRef = useRef<Blob[]>([])
  const systemChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const systemAnalyserRef = useRef<AnalyserNode | null>(null)
  const levelAnimRef = useRef<number | null>(null)

  const readLevels = useCallback(() => {
    const readLevel = (analyser: AnalyserNode | null): number => {
      if (!analyser) return 0
      const data = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(data)
      const rms = Math.sqrt(
        data.reduce((sum, v) => sum + (v - 128) ** 2, 0) / data.length
      )
      return Math.min(100, Math.round((rms / 64) * 100))
    }
    setMicLevel(readLevel(micAnalyserRef.current))
    setSystemLevel(readLevel(systemAnalyserRef.current))
    levelAnimRef.current = requestAnimationFrame(readLevels)
  }, [])

  const start = useCallback(async (micDeviceId: string) => {
    micChunksRef.current = []
    systemChunksRef.current = []

    // --- Mic stream ---
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: micDeviceId },
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    })

    // --- System audio stream (via Electron desktopCapturer) ---
    const sources = await window.electronAPI.getDesktopSources()
    const screenSourceId = sources[0]?.id
    let systemStream: MediaStream | null = null

    if (screenSourceId) {
      try {
        // getUserMedia with chromeMediaSource captures system/loopback audio on Windows
        systemStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // @ts-expect-error Electron-specific constraints
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: screenSourceId,
            },
          },
          video: {
            // @ts-expect-error required to get desktop audio, discard video track
            mandatory: { chromeMediaSource: 'desktop' },
          },
        })
        // Discard video tracks — we only want audio
        systemStream.getVideoTracks().forEach((t) => t.stop())
      } catch {
        // System audio unavailable — proceed with mic only
        systemStream = null
      }
    }

    // --- Analysers for level meters ---
    const micCtx = new AudioContext()
    const micSource = micCtx.createMediaStreamSource(micStream)
    const micAnalyser = micCtx.createAnalyser()
    micSource.connect(micAnalyser)
    micAnalyserRef.current = micAnalyser

    if (systemStream) {
      const sysCtx = new AudioContext()
      const sysSource = sysCtx.createMediaStreamSource(systemStream)
      const sysAnalyser = sysCtx.createAnalyser()
      sysSource.connect(sysAnalyser)
      systemAnalyserRef.current = sysAnalyser
    }

    // --- MediaRecorders ---
    const micRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm;codecs=opus' })
    micRecorder.ondataavailable = (e) => { if (e.data.size > 0) micChunksRef.current.push(e.data) }
    micRecorderRef.current = micRecorder
    micRecorder.start(1000) // 1-second chunks

    if (systemStream) {
      const sysRecorder = new MediaRecorder(systemStream, { mimeType: 'audio/webm;codecs=opus' })
      sysRecorder.ondataavailable = (e) => { if (e.data.size > 0) systemChunksRef.current.push(e.data) }
      systemRecorderRef.current = sysRecorder
      sysRecorder.start(1000)
    }

    // --- Timer ---
    setDuration(0)
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)

    // --- Level animation ---
    levelAnimRef.current = requestAnimationFrame(readLevels)

    setState('recording')
  }, [readLevels])

  const pause = useCallback(() => {
    micRecorderRef.current?.pause()
    systemRecorderRef.current?.pause()
    if (timerRef.current) clearInterval(timerRef.current)
    if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current)
    setState('paused')
  }, [])

  const resume = useCallback(() => {
    micRecorderRef.current?.resume()
    systemRecorderRef.current?.resume()
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    levelAnimRef.current = requestAnimationFrame(readLevels)
    setState('recording')
  }, [readLevels])

  const stop = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current)

      let micDone = false
      let sysDone = false
      const checkDone = () => {
        if (micDone && sysDone) resolve()
      }

      if (micRecorderRef.current) {
        micRecorderRef.current.onstop = () => {
          setMicBlob(new Blob(micChunksRef.current, { type: 'audio/webm' }))
          micDone = true
          checkDone()
        }
        micRecorderRef.current.stop()
      } else {
        micDone = true
      }

      if (systemRecorderRef.current) {
        systemRecorderRef.current.onstop = () => {
          setSystemBlob(new Blob(systemChunksRef.current, { type: 'audio/webm' }))
          sysDone = true
          checkDone()
        }
        systemRecorderRef.current.stop()
      } else {
        sysDone = true
        checkDone()
      }

      setState('stopped')
    })
  }, [])

  const discard = useCallback(() => {
    micRecorderRef.current?.stop()
    systemRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current)
    micChunksRef.current = []
    systemChunksRef.current = []
    setMicBlob(null)
    setSystemBlob(null)
    setDuration(0)
    setState('idle')
  }, [])

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current)
  }, [])

  return {
    state, duration, micLevel, systemLevel, micBlob, systemBlob,
    start, pause, resume, stop, discard,
    micAnalyserNode: micAnalyserRef.current,
    systemAnalyserNode: systemAnalyserRef.current,
  }
}
```

### 4.3 Sending Audio to Backend

```typescript
// src/renderer/src/api/recordings.ts
import { apiClient } from './client'

export async function uploadRecording(
  name: string,
  micBlob: Blob,
  systemBlob: Blob | null,
  templateId: string,
  language: string,
  onProgress: (percent: number) => void,
): Promise<{ jobId: string; recordingId: string }> {
  const form = new FormData()
  form.append('name', name)
  form.append('language', language)
  form.append('template_id', templateId)
  form.append('mic_audio', micBlob, 'mic.webm')
  if (systemBlob) {
    form.append('system_audio', systemBlob, 'system.webm')
  }

  const { data } = await apiClient.post('/recordings', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data
}
```

---

## 5. State Management

### 5.1 Zustand Stores

**Auth store:**
```typescript
// src/renderer/src/stores/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  refreshToken: string | null
  userId: string | null
  username: string | null
  setTokens: (access: string, refresh: string, userId: string, username: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      userId: null,
      username: null,
      setTokens: (token, refreshToken, userId, username) =>
        set({ token, refreshToken, userId, username }),
      logout: () => set({ token: null, refreshToken: null, userId: null, username: null }),
    }),
    { name: 'auth-storage' }
  )
)
```

**Settings store (syncs to electron-store):**
```typescript
// src/renderer/src/stores/settingsStore.ts
import { create } from 'zustand'

interface Settings {
  backendUrl: string
  llmProvider: string
  llmApiKey: string
  llmModel: string
  whisperModel: string
  theme: 'light' | 'dark' | 'system'
  defaultTemplateId: string | null
}

interface SettingsState extends Settings {
  load: () => Promise<void>
  save: (partial: Partial<Settings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  backendUrl: 'http://localhost:8000',
  llmProvider: 'openrouter',
  llmApiKey: '',
  llmModel: 'meta-llama/llama-3.1-8b-instruct:free',
  whisperModel: 'base',
  theme: 'system',
  defaultTemplateId: null,

  load: async () => {
    const stored = await window.electronAPI.getSettings('app-settings')
    if (stored) set(stored)
  },

  save: async (partial) => {
    const next = { ...get(), ...partial }
    set(next)
    await window.electronAPI.setSettings('app-settings', next)
  },
}))
```

### 5.2 TanStack Query Setup

```typescript
// src/renderer/src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})
```

**Query keys convention:**
```typescript
export const queryKeys = {
  recordings: {
    all: ['recordings'] as const,
    detail: (id: string) => ['recordings', id] as const,
  },
  job: {
    status: (jobId: string) => ['jobs', jobId, 'status'] as const,
  },
  transcripts: {
    byRecording: (recordingId: string) => ['transcripts', recordingId] as const,
  },
  templates: {
    all: ['templates'] as const,
  },
  chat: {
    messages: (recordingId: string) => ['chat', recordingId] as const,
  },
}
```

---

## 6. API Client

```typescript
// src/renderer/src/api/client.ts
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'

export function createApiClient() {
  const instance = axios.create({
    baseURL: useSettingsStore.getState().backendUrl,
    timeout: 30_000,
  })

  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      if (error.response?.status === 401) {
        // Attempt token refresh
        try {
          const refreshToken = useAuthStore.getState().refreshToken
          const { data } = await axios.post(
            `${useSettingsStore.getState().backendUrl}/auth/refresh`,
            { refresh_token: refreshToken }
          )
          useAuthStore.getState().setTokens(
            data.access_token, data.refresh_token, data.user_id, data.username
          )
          error.config.headers.Authorization = `Bearer ${data.access_token}`
          return instance.request(error.config)
        } catch {
          useAuthStore.getState().logout()
        }
      }
      return Promise.reject(error)
    }
  )

  return instance
}

export const apiClient = createApiClient()
```

---

## 7. Job Polling

The backend processes audio asynchronously. The frontend polls job status until completion.

```typescript
// src/renderer/src/hooks/useJobPoller.ts
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import { getJobStatus } from '../api/jobs'

export type JobStage = 'queued' | 'transcribing' | 'diarizing' | 'naming' | 'generating' | 'done' | 'failed'

interface JobStatus {
  stage: JobStage
  progress: number        // 0–100
  error: string | null
  recordingId: string | null
}

export function useJobPoller(jobId: string | null) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.job.status(jobId ?? ''),
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as JobStatus | undefined
      if (!data) return 2000
      if (data.stage === 'done' || data.stage === 'failed') return false
      return 2000 // poll every 2s while active
    },
    select: (data: JobStatus) => {
      if (data.stage === 'done') {
        // Invalidate related queries so document viewer refreshes
        queryClient.invalidateQueries({
          queryKey: queryKeys.recordings.detail(data.recordingId ?? ''),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.transcripts.byRecording(data.recordingId ?? ''),
        })
      }
      return data
    },
  })
}
```

---

## 8. Key Pages

### 8.1 Dashboard Page

```typescript
// src/renderer/src/pages/Dashboard.tsx
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { DocumentViewer } from './DocumentViewer'
import { getRecordings } from '../api/recordings'
import { queryKeys } from '../api/queryKeys'

export function Dashboard() {
  const { recordingId } = useParams()
  const { data: recordings, isLoading } = useQuery({
    queryKey: queryKeys.recordings.all,
    queryFn: getRecordings,
  })

  return (
    <AppShell recordings={recordings ?? []} isLoadingList={isLoading}>
      {recordingId ? (
        <DocumentViewer recordingId={recordingId} />
      ) : (
        <EmptyState />
      )}
    </AppShell>
  )
}
```

### 8.2 Document Viewer

```typescript
// src/renderer/src/pages/DocumentViewer.tsx
// Tabs: raw transcript, diarized, named, output
// All tabs load their own queries independently
// PipelineStatus polls job if active job exists for this recording

export function DocumentViewer({ recordingId }: { recordingId: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>('raw')
  const [chatOpen, setChatOpen] = useState(false)

  const { data: recording } = useQuery({
    queryKey: queryKeys.recordings.detail(recordingId),
    queryFn: () => getRecording(recordingId),
  })

  const { data: transcripts } = useQuery({
    queryKey: queryKeys.transcripts.byRecording(recordingId),
    queryFn: () => getTranscripts(recordingId),
  })

  // If recording has active job, poll it
  const jobPoller = useJobPoller(recording?.activeJobId ?? null)

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <RecordingHeader recording={recording} onChatToggle={() => setChatOpen((v) => !v)} />
        {jobPoller.data && <PipelineStatus job={jobPoller.data} />}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="raw">Raw Transcript</TabsTrigger>
            <TabsTrigger value="diarized">Diarized</TabsTrigger>
            <TabsTrigger value="named">Speaker Named</TabsTrigger>
            <TabsTrigger value="output">Output</TabsTrigger>
          </TabsList>
          <TabsContent value="raw">
            <TabRawTranscript content={transcripts?.raw} />
          </TabsContent>
          <TabsContent value="diarized">
            <TabDiarized content={transcripts?.diarized} />
          </TabsContent>
          <TabsContent value="named">
            <TabNamed content={transcripts?.named} recordingId={recordingId} />
          </TabsContent>
          <TabsContent value="output">
            <TabOutput content={transcripts?.output} recordingId={recordingId} />
          </TabsContent>
        </Tabs>
      </div>
      {chatOpen && <ChatPanel recordingId={recordingId} />}
    </div>
  )
}
```

---

## 9. Routing

```typescript
// src/renderer/src/App.tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/auth/login" replace />
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/recording/:recordingId" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/templates" element={<RequireAuth><Templates /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
```

**Use `HashRouter`** not `BrowserRouter` — Electron serves from `file://` so hash routing is required.

---

## 10. Waveform Component

```typescript
// src/renderer/src/components/recording/Waveform.tsx
import { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'

// Live level meter (recording) — uses canvas, not WaveSurfer
export function LiveWaveform({
  micAnalyser,
  systemAnalyser,
}: {
  micAnalyser: AnalyserNode | null
  systemAnalyser: AnalyserNode | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      const drawChannel = (analyser: AnalyserNode | null, color: string, yOffset: number) => {
        if (!analyser) return
        const data = new Uint8Array(analyser.fftSize)
        analyser.getByteTimeDomainData(data)
        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        for (let i = 0; i < data.length; i++) {
          const x = (i / data.length) * W
          const y = yOffset + ((data[i] - 128) / 128) * (H / 4)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      drawChannel(micAnalyser, '#818CF8', H * 0.35)    // indigo, upper half
      drawChannel(systemAnalyser, '#4ADE80', H * 0.65) // green, lower half

      animRef.current = requestAnimationFrame(draw)
    }
    animRef.current = requestAnimationFrame(draw)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [micAnalyser, systemAnalyser])

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={120}
      className="w-full rounded-lg bg-zinc-900"
    />
  )
}

// Playback waveform for existing recordings
export function PlaybackWaveform({ audioUrl }: { audioUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    wavesurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#818CF8',
      progressColor: '#4F46E5',
      height: 64,
      barWidth: 2,
      barGap: 1,
    })
    wavesurferRef.current.load(audioUrl)
    return () => wavesurferRef.current?.destroy()
  }, [audioUrl])

  return <div ref={containerRef} />
}
```

---

## 11. Theme System

```typescript
// src/renderer/src/lib/theme.ts
export function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement
  const effectiveTheme =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  root.classList.remove('light', 'dark')
  root.classList.add(effectiveTheme)
}
```

Tailwind config: `darkMode: 'class'` — dark mode toggled by `.dark` on `<html>`.

---

## 12. Error Handling

- All API errors caught in Axios interceptor, emit toast via a toast store
- Query errors: `useQuery` `onError` callback shows toast
- Unhandled renderer errors: `window.onerror` → show error boundary UI, log to file via IPC
- Main process errors: log to app log file via `electron-log`

```typescript
// Global error boundary
import { Component, ErrorInfo, ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info)
  }

  render() {
    if (this.state.hasError) return <CrashScreen error={this.state.error} />
    return this.props.children
  }
}
```

---

## 13. Build & Distribution

```
electron-vite build          # Builds main + preload + renderer
electron-builder --win       # Packages as NSIS installer for Windows
```

**electron-builder config (package.json):**
```json
{
  "build": {
    "appId": "com.bjit.quillvault",
    "productName": "QuillVault",
    "directories": { "output": "dist" },
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

---

## 14. Environment / Config

All runtime config comes from `electron-store` (persisted), not `.env` files.

User-configurable at runtime:
- `backendUrl` — backend server address
- `llmApiKey` — user's own API key
- `llmModel` — model choice
- `whisperModel` — transcription model size
- `theme`

No secrets baked into the build.

---

## 15. Best Practices

- **Never block the renderer thread.** Audio encoding, file I/O: all async.
- **All state mutations via Zustand actions** — no direct `setState` from API callbacks.
- **TanStack Query owns all server data** — never duplicate in Zustand.
- **IPC calls are typed end-to-end** through the preload contextBridge declarations.
- **No `any` types.** Define all API shapes in `src/types/api.ts`.
- **Validate all user inputs** with Zod schemas before sending to backend.
- **Abort controllers** on all long API calls that the user might cancel.
- **Test audio device enumeration** before starting recording — show clear error if mic/system audio unavailable.
