import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { EmptyState } from '../components/layout/EmptyState'
import { DocumentViewer } from './DocumentViewer'

/** Mock recordings for development */
const mockRecordings = [
  { id: '1', name: 'Q3 Planning Session', date: 'Oct 12', duration: '45:20' },
  { id: '2', name: 'Client Intake - Acme Corp', date: 'Oct 10', duration: '1:12:05' },
  { id: '3', name: 'Design Sync', date: 'Oct 08', duration: '22:15' },
]

export default function Dashboard() {
  const { recordingId } = useParams()
  const navigate = useNavigate()

  return (
    <AppShell recordings={mockRecordings}>
      {recordingId ? (
        <DocumentViewer recordingId={recordingId} />
      ) : (
        <EmptyState
          onStartRecording={() => navigate('/record')}
          onUploadFile={() => navigate('/upload')}
        />
      )}
    </AppShell>
  )
}
