import { useState, useRef, useCallback, useEffect } from 'react'

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped'

interface AudioRecorderResult {
  state: RecorderState
  duration: number
  micLevel: number    // 0–100
  systemLevel: number // 0–100
  micBlob: Blob | null
  systemBlob: Blob | null
  /** Whether audio streams are open and level meters are active */
  isMonitoring: boolean
  /** Open mic + system audio streams and start level detection (call on mount) */
  startMonitoring: (micDeviceId: string) => Promise<void>
  /** Close audio streams and stop level detection */
  stopMonitoring: () => void
  /** Start recording (streams must already be open via startMonitoring) */
  start: () => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => Promise<void>
  discard: () => void
  micAnalyserNode: AnalyserNode | null
  systemAnalyserNode: AnalyserNode | null
  micStream: MediaStream | null
  systemStream: MediaStream | null
}

export function useAudioRecorder(): AudioRecorderResult {
  const [state, setState] = useState<RecorderState>('idle')
  const [duration, setDuration] = useState(0)
  const [micLevel, setMicLevel] = useState(0)
  const [systemLevel, setSystemLevel] = useState(0)
  const [micBlob, setMicBlob] = useState<Blob | null>(null)
  const [systemBlob, setSystemBlob] = useState<Blob | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)

  const micRecorderRef = useRef<MediaRecorder | null>(null)
  const systemRecorderRef = useRef<MediaRecorder | null>(null)
  const micChunksRef = useRef<Blob[]>([])
  const systemChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const systemAnalyserRef = useRef<AnalyserNode | null>(null)
  const levelAnimRef = useRef<number | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const systemStreamRef = useRef<MediaStream | null>(null)
  const micCtxRef = useRef<AudioContext | null>(null)
  const sysCtxRef = useRef<AudioContext | null>(null)

  const readLevels = useCallback(() => {
    const readLevel = (analyser: AnalyserNode | null): number => {
      if (!analyser) return 0
      const data = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(data)
      const rms = Math.sqrt(
        data.reduce((sum, v) => sum + (v - 128) ** 2, 0) / data.length,
      )
      return Math.min(100, Math.round((rms / 64) * 100))
    }
    setMicLevel(readLevel(micAnalyserRef.current))
    setSystemLevel(readLevel(systemAnalyserRef.current))
    levelAnimRef.current = requestAnimationFrame(readLevels)
  }, [])

  /** Open mic + system audio streams and start level detection. */
  const startMonitoring = useCallback(async (micDeviceId: string) => {
    // Clean up any existing streams first
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    systemStreamRef.current?.getTracks().forEach((t) => t.stop())
    micCtxRef.current?.close()
    sysCtxRef.current?.close()
    micAnalyserRef.current = null
    systemAnalyserRef.current = null

    // --- Mic stream ---
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: micDeviceId ? { exact: micDeviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    })
    micStreamRef.current = micStream

    // --- System audio stream (auto-detect via Electron desktopCapturer) ---
    let systemStream: MediaStream | null = null
    try {
      if (window.electronAPI?.getDesktopSources) {
        const sources = await window.electronAPI.getDesktopSources()
        const screenSourceId = sources[0]?.id

        if (screenSourceId) {
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
        }
      }
    } catch {
      // System audio unavailable — proceed with mic only
      systemStream = null
    }
    systemStreamRef.current = systemStream

    // --- Analysers for level meters ---
    const micCtx = new AudioContext()
    micCtxRef.current = micCtx
    const micSource = micCtx.createMediaStreamSource(micStream)
    const micAnalyser = micCtx.createAnalyser()
    micAnalyser.fftSize = 256
    micSource.connect(micAnalyser)
    micAnalyserRef.current = micAnalyser

    if (systemStream) {
      const sysCtx = new AudioContext()
      sysCtxRef.current = sysCtx
      const sysSource = sysCtx.createMediaStreamSource(systemStream)
      // Boost system audio signal for better waveform visibility
      const sysGain = sysCtx.createGain()
      sysGain.gain.value = 3.0
      const sysAnalyser = sysCtx.createAnalyser()
      sysAnalyser.fftSize = 256
      sysSource.connect(sysGain)
      sysGain.connect(sysAnalyser)
      systemAnalyserRef.current = sysAnalyser
    }

    // --- Start level animation ---
    levelAnimRef.current = requestAnimationFrame(readLevels)
    setIsMonitoring(true)
  }, [readLevels])

  /** Close audio streams and stop level detection. */
  const stopMonitoring = useCallback(() => {
    if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current)
    levelAnimRef.current = null

    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    systemStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    systemStreamRef.current = null

    if (micCtxRef.current && micCtxRef.current.state !== 'closed') {
      micCtxRef.current.close().catch(() => {})
    }
    micCtxRef.current = null
    if (sysCtxRef.current && sysCtxRef.current.state !== 'closed') {
      sysCtxRef.current.close().catch(() => {})
    }
    sysCtxRef.current = null

    micAnalyserRef.current = null
    systemAnalyserRef.current = null

    setMicLevel(0)
    setSystemLevel(0)
    setIsMonitoring(false)
  }, [])

  /** Start recording — streams must already be open via startMonitoring. */
  const start = useCallback(async () => {
    if (!micStreamRef.current && !systemStreamRef.current) {
      throw new Error('Audio streams not open — call startMonitoring first')
    }

    micChunksRef.current = []
    systemChunksRef.current = []

    // --- MediaRecorders on existing streams ---
    if (micStreamRef.current) {
      const micRecorder = new MediaRecorder(micStreamRef.current, {
        mimeType: 'audio/webm;codecs=opus',
      })
      micRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) micChunksRef.current.push(e.data)
      }
      micRecorderRef.current = micRecorder
      micRecorder.start(1000)
    }

    if (systemStreamRef.current) {
      const sysRecorder = new MediaRecorder(systemStreamRef.current, {
        mimeType: 'audio/webm;codecs=opus',
      })
      sysRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) systemChunksRef.current.push(e.data)
      }
      systemRecorderRef.current = sysRecorder
      sysRecorder.start(1000)
    }

    // --- Timer ---
    setDuration(0)
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)

    setState('recording')
  }, [])

  const pause = useCallback(() => {
    micRecorderRef.current?.pause()
    systemRecorderRef.current?.pause()
    if (timerRef.current) clearInterval(timerRef.current)
    // Keep level animation running — user can still see levels while paused
    setState('paused')
  }, [])

  const resume = useCallback(() => {
    micRecorderRef.current?.resume()
    systemRecorderRef.current?.resume()
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    setState('recording')
  }, [])

  const stop = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (state === 'idle' || state === 'stopped') {
        resolve()
        return
      }

      if (timerRef.current) clearInterval(timerRef.current)

      let micDone = false
      let sysDone = false
      const checkDone = () => {
        if (micDone && sysDone) resolve()
      }

      if (micRecorderRef.current && micRecorderRef.current.state !== 'inactive') {
        micRecorderRef.current.onstop = () => {
          setMicBlob(new Blob(micChunksRef.current, { type: 'audio/webm' }))
          micDone = true
          checkDone()
        }
        micRecorderRef.current.stop()
      } else {
        micDone = true
      }

      if (systemRecorderRef.current && systemRecorderRef.current.state !== 'inactive') {
        systemRecorderRef.current.onstop = () => {
          setSystemBlob(new Blob(systemChunksRef.current, { type: 'audio/webm' }))
          sysDone = true
          checkDone()
        }
        systemRecorderRef.current.stop()
      } else {
        sysDone = true
      }

      setState('stopped')

      // NOTE: We do NOT stop the streams here — monitoring continues
      // Streams are cleaned up in stopMonitoring() or discard()

      // If no recorders were active, resolve immediately
      checkDone()
    })
  }, [state])

  const discard = useCallback(() => {
    micRecorderRef.current?.stop()
    systemRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    micChunksRef.current = []
    systemChunksRef.current = []
    micRecorderRef.current = null
    systemRecorderRef.current = null
    setMicBlob(null)
    setSystemBlob(null)
    setDuration(0)
    setState('idle')
    // NOTE: monitoring stays active — streams are still open
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current)
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      systemStreamRef.current?.getTracks().forEach((t) => t.stop())
      if (micCtxRef.current && micCtxRef.current.state !== 'closed') {
        micCtxRef.current.close().catch(() => {})
      }
      if (sysCtxRef.current && sysCtxRef.current.state !== 'closed') {
        sysCtxRef.current.close().catch(() => {})
      }
    }
  }, [])

  return {
    state,
    duration,
    micLevel,
    systemLevel,
    micBlob,
    systemBlob,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    start,
    pause,
    resume,
    stop,
    discard,
    micAnalyserNode: micAnalyserRef.current,
    systemAnalyserNode: systemAnalyserRef.current,
    micStream: micStreamRef.current,
    systemStream: systemStreamRef.current,
  }
}
