import { useState, useEffect, useRef } from 'react'

export default function LogModal({ job, onClose }) {
  const [logs, setLogs] = useState('')
  const [podName, setPodName] = useState(null)
  const [loading, setLoading] = useState(true)
  const bodyRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/jobs/${job.name}/logs`)
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setLogs(data.logs)
        setPodName(data.podName)
        setTimeout(() => {
          if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
        }, 50)
      } catch (err) {
        setLogs(`Error fetching logs: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [job.name])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{job.name}</div>
            {podName && <div className="modal-pod">{podName}</div>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="modal-body" ref={bodyRef}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : (
            <pre className="log-output">{logs || '(no output)'}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
