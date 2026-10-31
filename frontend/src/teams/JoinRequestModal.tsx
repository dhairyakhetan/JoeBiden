import { useState } from 'react'
import Modal from '../components/Modal'
import Button from '../components/Button'
import TextArea from '../components/TextArea'
import Alert from '../components/Alert'
import teamService from '../services/teamService'
import { useToast } from '../components/Toast'

interface JoinRequestModalProps {
  isOpen: boolean
  onClose: () => void
  teamName: string
  teamUuid: string
  onSuccess: () => void
}

const JoinRequestModal = ({ isOpen, onClose, teamName, teamUuid, onSuccess }: JoinRequestModalProps) => {
  const { success: toastSuccess, error: toastError } = useToast()
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await teamService.createJoinRequest(teamUuid, message.trim() || undefined)
      if (result.success) {
        toastSuccess('application sent.', 'You\'ll hear back via Notifications.')
        setSubmitted(true)
        onSuccess()
      } else {
        const message = result.message || 'Failed to submit application'
        setError(message)
        toastError('Application failed', message)
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to submit application'
      setError(message)
      toastError('Application failed', message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setMessage('')
    setError(null)
    setSubmitted(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={submitted ? 'Application sent' : `Apply to Join ${teamName}`} size="md" fullScreenMobile>
      {submitted ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48 }} aria-hidden>✓</div>
          <div className="h-display" style={{ fontSize: 24, marginTop: 12 }}>Application sent!</div>
          <p style={{ color: 'var(--ink-2)', marginTop: 8 }}>The team lead will review your application and respond via Notifications.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={handleClose}>Done</button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {error && (
              <Alert variant="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <p className="text-sm text-gray-600">
              Your application will be reviewed by a team lead. You'll be added once approved.
            </p>

            <TextArea
              label="Why do you want to join?"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell the team leads why you'd like to join (optional)…"
              rows={4}
            />
          </div>

          <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={isSubmitting}>
              Submit Application
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  )
}

export default JoinRequestModal
