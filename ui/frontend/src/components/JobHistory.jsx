import { useState, useEffect, useCallback } from 'react'
import LogModal from './LogModal'

function relativeTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function duration(seconds) {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>
}

export default function JobHistory() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  const fetchJobs = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setJobs(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(() => fetchJobs(true), 30_000)
    return () => clearInterval(interval)
  }, [fetchJobs])

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner spinner-dark" style={{ margin: '0 auto 12px' }} />
        Loading job history…
      </div>
    )
  }

  return (
    <div>
      {error && <div className="error-banner">Failed to load jobs: {error}</div>}

      <div className="section-header">
        <span className="section-title">Recent Runs</span>
        <button className="btn btn-secondary btn-sm" onClick={() => fetchJobs(true)} disabled={refreshing}>
          {refreshing
            ? <span className="spinner spinner-dark" style={{ width: 12, height: 12 }} />
            : <RefreshIcon />}
          Refresh
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">No jobs yet</div>
            <p>Use "Run Now" to trigger a manual run, or wait for the scheduled job.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Trigger</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.name}>
                    <td><span className="job-name">{job.name}</span></td>
                    <td><StatusBadge status={job.status} /></td>
                    <td>
                      <span className={`trigger-pill ${job.manual ? 'trigger-manual' : 'trigger-scheduled'}`}>
                        {job.manual ? 'manual' : 'scheduled'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{relativeTime(job.startTime)}</td>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                      {duration(job.duration)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {job.prUrl && (
                          <a
                            href={job.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            View PR
                          </a>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelected(job)}>
                          Logs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <LogModal job={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}
