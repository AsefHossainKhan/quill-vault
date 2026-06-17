import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { EmptyState } from '../components/layout/EmptyState'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { DocumentViewer } from './DocumentViewer'
import { useRecordings } from '../hooks/useRecordings'

export default function Dashboard() {
  const { recordingId } = useParams()
  const navigate = useNavigate()
  const { sidebarRecordings } = useRecordings()

  return (
    <AppShell recordings={sidebarRecordings}>
      {recordingId ? (
        <ErrorBoundary key={recordingId} fallbackTitle="Error viewing recording">
          <DocumentViewer recordingId={recordingId} />
        </ErrorBoundary>
      ) : (
        <EmptyState
          onStartRecording={() => navigate('/record')}
          onUploadFile={() => navigate('/upload')}
        />
      )}
    </AppShell>
  )
}
