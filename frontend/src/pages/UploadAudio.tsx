import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Upload,
  FileAudio,
  X,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { uploadRecording } from '../api/recordings'
import { useRecordingStore } from '../stores/recordingStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { TemplateSelector } from '../components/recording/TemplateSelector'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'Bangla' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
]

const ACCEPTED_FORMATS = [
  'audio/mpeg',     // .mp3
  'audio/wav',      // .wav
  'audio/x-wav',    // .wav alt
  'audio/mp4',      // .m4a
  'audio/x-m4a',    // .m4a alt
  'audio/flac',     // .flac
  'audio/ogg',      // .ogg
  'audio/webm',     // .webm
]

const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function UploadAudio() {
  const navigate = useNavigate()
  const language = useRecordingStore((s) => s.language)
  const setLanguage = useRecordingStore((s) => s.setLanguage)
  const templateId = useRecordingStore((s) => s.templateId)
  const setTemplateId = useRecordingStore((s) => s.setTemplateId)

  const [file, setFile] = useState<File | null>(null)
  const [recordingName, setRecordingName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    setError(null)

    // Validate format
    const ext = f.name.split('.').pop()?.toLowerCase()
    const isValidExt = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'webm', 'aac', 'wma'].includes(ext || '')
    const isValidMime = ACCEPTED_FORMATS.includes(f.type) || f.type === ''
    if (!isValidExt && !isValidMime) {
      setError(`Unsupported format: ${f.name}. Use MP3, WAV, M4A, FLAC, or OGG.`)
      return
    }

    // Validate size
    if (f.size > MAX_SIZE_BYTES) {
      setError(`File too large: ${formatFileSize(f.size)}. Maximum is 2 GB.`)
      return
    }

    setFile(f)
    // Auto-fill recording name from filename (strip extension)
    const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '')
    setRecordingName(nameWithoutExt)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) handleFile(selected)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }, [handleFile])

  const clearFile = useCallback(() => {
    setFile(null)
    setRecordingName('')
    setError(null)
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file) return
    const name = recordingName.trim() || file.name.replace(/\.[^/.]+$/, '')

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      const result = await uploadRecording(
        name,
        file,
        null, // no system audio for file uploads
        language,
        null, // no pre-transcript
        setUploadProgress,
        templateId,
      )
      // Navigate to the recording detail page
      navigate(`/recording/${result.recording_id}`)
    } catch (err: unknown) {
      let message = 'Upload failed. Please try again.'
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } }
        if (axiosErr.response?.data?.detail) {
          message = axiosErr.response.data.detail
        }
      }
      setError(message)
      setIsUploading(false)
    }
  }, [file, recordingName, language, navigate])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="h-8 w-8 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold text-foreground">Upload Audio</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-lg space-y-6">

          {/* Recording Name */}
          <div className="space-y-1.5">
            <Label htmlFor="recordingName">Recording Name</Label>
            <Input
              id="recordingName"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              placeholder="Auto-filled from filename..."
              disabled={isUploading}
            />
          </div>

          {/* Drop Zone */}
          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleBrowse}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors',
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50',
              )}
            >
              <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Drag & drop an audio file here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                MP3, WAV, M4A, FLAC, OGG — Max 2 GB
              </p>
              <Button variant="outline" size="sm" className="mt-4" type="button">
                Browse Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.flac,.ogg,.webm,.aac,.wma"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          ) : (
            /* Selected file card */
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileAudio className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                {!isUploading && (
                  <button
                    onClick={clearFile}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Upload progress */}
              {isUploading && (
                <div className="mt-3 space-y-1.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}

              {/* Upload complete indicator */}
              {uploadProgress === 100 && isUploading && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Processing...
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Language selector */}
          <div className="space-y-1.5">
            <Label htmlFor="language">Language</Label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isUploading}
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Template selector */}
          <div className="space-y-1.5">
            <Label>Template</Label>
            <TemplateSelector
              value={templateId}
              onChange={setTemplateId}
              disabled={isUploading}
            />
          </div>

          {/* Upload button */}
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                Upload & Process
                <Upload className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

        </div>
      </div>
    </div>
  )
}
