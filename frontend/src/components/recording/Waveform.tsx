import { useRef, useEffect, useCallback } from 'react'

interface WaveformProps {
  micAnalyserNode: AnalyserNode | null
  systemAnalyserNode: AnalyserNode | null
  isRecording: boolean
}

/** Canvas-based live waveform visualizer with two overlaid channel lines. */
export function Waveform({
  micAnalyserNode,
  systemAnalyserNode,
  isRecording,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Match canvas internal resolution to CSS size
    const rect = canvas.getBoundingClientRect()
    if (canvas.width !== rect.width * 2 || canvas.height !== rect.height * 2) {
      canvas.width = rect.width * 2
      canvas.height = rect.height * 2
      ctx.scale(2, 2)
    }

    const w = rect.width
    const h = rect.height

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Draw a channel waveform line
    const drawChannel = (analyser: AnalyserNode | null, color: string) => {
      if (!analyser) return
      const bufferLength = analyser.fftSize
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteTimeDomainData(dataArray)

      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'

      const sliceWidth = w / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * h) / 2

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += sliceWidth
      }

      ctx.stroke()
    }

    // Mic channel: indigo/primary color
    drawChannel(micAnalyserNode, 'hsl(var(--primary))')
    // System channel: emerald/success color
    drawChannel(systemAnalyserNode, 'hsl(var(--success))')

    animRef.current = requestAnimationFrame(draw)
  }, [micAnalyserNode, systemAnalyserNode])

  useEffect(() => {
    if (isRecording) {
      animRef.current = requestAnimationFrame(draw)
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      // Draw flat line when not recording
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const rect = canvas.getBoundingClientRect()
          canvas.width = rect.width * 2
          canvas.height = rect.height * 2
          ctx.scale(2, 2)
          ctx.clearRect(0, 0, rect.width, rect.height)
          ctx.beginPath()
          ctx.strokeStyle = 'hsl(var(--muted-foreground) / 0.3)'
          ctx.lineWidth = 1
          ctx.moveTo(0, rect.height / 2)
          ctx.lineTo(rect.width, rect.height / 2)
          ctx.stroke()
        }
      }
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [isRecording, draw])

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <canvas
        ref={canvasRef}
        className="h-[120px] w-full"
        style={{ display: 'block' }}
      />
      {/* Legend */}
      <div className="absolute right-3 top-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          Mic
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-success" />
          System
        </span>
      </div>
    </div>
  )
}
