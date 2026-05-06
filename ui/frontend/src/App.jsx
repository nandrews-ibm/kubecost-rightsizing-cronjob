import { useState, useCallback } from 'react'
import ConfigForm from './components/ConfigForm'
import JobHistory from './components/JobHistory'

export default function App() {
  const [tab, setTab] = useState('config')
  const [toasts, setToasts] = useState([])
  const [running, setRunning] = useState(false)

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const handleRunNow = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/run', { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast(`Job started: ${data.jobName}`, 'success')
      setTab('history')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-title">Kubecost Rightsizing</span>
          <span className="header-sep">·</span>
          <span className="header-subtitle">CronJob Manager</span>
        </div>
        <div className="header-right">
          <button className="btn btn-primary" onClick={handleRunNow} disabled={running}>
            {running ? <span className="spinner" /> : <PlayIcon />}
            {running ? 'Starting…' : 'Run Now'}
          </button>
        </div>
      </header>

      <div className="tabs">
        <button className={`tab ${tab === 'config' ? 'active' : ''}`} onClick={() => setTab('config')}>
          Configuration
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          Job History
        </button>
      </div>

      <div className="main">
        {tab === 'config' && <ConfigForm showToast={showToast} />}
        {tab === 'history' && <JobHistory showToast={showToast} />}
      </div>

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? <CheckIcon /> : <XIcon />}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
