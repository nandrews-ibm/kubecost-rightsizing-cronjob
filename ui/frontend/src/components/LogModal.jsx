import { useState, useEffect, useRef, useCallback } from 'react'

export default function LogModal({ job, onClose }) {
  const [logs, setLogs] = useState('')
  const [podName, setPodName] = useState(null)
  const [prUrl, setPrUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const bodyRef = useRef(null)
  const isLive = job.status === 'running'

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/jobs/${job.name}/logs`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLogs(data.logs)
      setPodName(data.podName)
      if (data.prUrl) setPrUrl(data.prUrl)
      if (bodyRef.current) {
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight
      }
    } catch (err) {
      setLogs(`Error fetching logs: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [job.name])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (!isLive) return
    const interval = setInterval(() => fetchLogs(true), 4000)
    return () => clearInterval(interval)
  }, [isLive, fetchLogs])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="modal-title">{job.name}</span>
              {isLive && <span className="live-badge">● LIVE</span>}
            </div>
            {podName && <div className="modal-pod">{podName}</div>}
            {prUrl && (
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pr-link"
              >
                View Pull Request →
              </a>
            )}
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
