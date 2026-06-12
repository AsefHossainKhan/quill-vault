import { useState, useEffect } from 'react'
import { Mic, ChevronDown } from 'lucide-react'
import { useRecordingStore } from '../../stores/recordingStore'
import { cn } from '../../lib/utils'

interface AudioDevice {
  deviceId: string
  label: string
  groupId: string
}

interface AudioDeviceSelectorProps {
  disabled?: boolean
}

/** Dropdown to select the microphone input device. */
export function AudioDeviceSelector({ disabled }: AudioDeviceSelectorProps) {
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [open, setOpen] = useState(false)
  const micDeviceId = useRecordingStore((s) => s.micDeviceId)
  const setMicDeviceId = useRecordingStore((s) => s.setMicDeviceId)

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((mediaDevices) => {
      const devs = mediaDevices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label, groupId: d.groupId }))
      setDevices(devs)
      // Auto-select first device if none selected
      if (!micDeviceId && devs.length > 0) {
        setMicDeviceId(devs[0].deviceId)
      }
    })
  }, [micDeviceId, setMicDeviceId])

  const selected = devices.find((d) => d.deviceId === micDeviceId)
  const displayLabel = selected?.label || 'Default Microphone'

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Mic className="h-3 w-3" />
        Microphone
      </label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground transition-colors',
            'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
            {devices.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No devices found
              </div>
            ) : (
              devices.map((device) => (
                <button
                  key={device.deviceId}
                  type="button"
                  onClick={() => {
                    setMicDeviceId(device.deviceId)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center px-3 py-2 text-left text-sm transition-colors',
                    device.deviceId === micDeviceId
                      ? 'bg-accent text-accent-foreground'
                      : 'text-card-foreground hover:bg-muted',
                  )}
                >
                  <span className="truncate">{device.label || 'Microphone'}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
