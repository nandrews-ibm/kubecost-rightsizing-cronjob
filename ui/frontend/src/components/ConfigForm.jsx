import { useState, useEffect } from 'react'

const WINDOWS = ['1d', '2d', '3d', '7d', '14d', '30d']

export default function ConfigForm({ showToast }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState(null)

  const fetchConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/config')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setConfig(data)
      setDirty(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfig() }, [])

  const setTop = (field, value) => {
    setDirty(true)
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const setEnv = (key, value) => {
    setDirty(true)
    setConfig(prev => ({ ...prev, env: { ...prev.env, [key]: value } }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDirty(false)
      showToast('Configuration saved')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner spinner-dark" style={{ margin: '0 auto 12px' }} />
        Loading configuration…
      </div>
    )
  }

  if (error) {
    return (
      <>
        <div className="error-banner">Failed to load configuration: {error}</div>
        <button className="btn btn-secondary" onClick={fetchConfig}>Retry</button>
      </>
    )
  }

  const env = config.env || {}
  const cpuPct = Math.round(parseFloat(env.TARGET_CPU_UTIL || '0.65') * 100)
  const ramPct = Math.round(parseFloat(env.TARGET_RAM_UTIL || '0.65') * 100)

  return (
    <div>
      {/* Schedule */}
      <div className="card">
        <div className="card-header"><span className="card-title">Schedule</span></div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-label-cell">
              <span className="form-label">Cron Expression</span>
              <span className="form-hint">UTC timezone</span>
            </div>
            <div>
              <input
                className="form-input mono"
                value={config.schedule || ''}
                onChange={e => setTop('schedule', e.target.value)}
                placeholder="0 2 * * 1"
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                e.g. <code className="code-inline">0 2 * * 1</code> = every Monday at 2 AM UTC
              </div>
            </div>

            <hr className="form-divider" />

            <div className="form-label-cell">
              <span className="form-label">Suspended</span>
              <span className="form-hint">Pause all scheduled runs</span>
            </div>
            <div className="toggle-row">
              <button
                className={`toggle ${config.suspended ? 'active' : ''}`}
                onClick={() => setTop('suspended', !config.suspended)}
                aria-label={config.suspended ? 'Resume' : 'Suspend'}
              />
              <span className={`toggle-label ${config.suspended ? 'danger' : ''}`}>
                {config.suspended ? 'Suspended — no scheduled runs will fire' : 'Active'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Kubecost */}
      <div className="card">
        <div className="card-header"><span className="card-title">Kubecost</span></div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-label-cell">
              <span className="form-label">API Address</span>
              <span className="form-hint">In-cluster service URL</span>
            </div>
            <input
              className="form-input mono"
              value={env.KUBECOST_ADDRESS || ''}
              onChange={e => setEnv('KUBECOST_ADDRESS', e.target.value)}
              placeholder="http://kubecost-frontend.kubecost:9090/model"
            />
          </div>
        </div>
      </div>

      {/* Git */}
      <div className="card">
        <div className="card-header"><span className="card-title">Git Settings</span></div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-label-cell">
              <span className="form-label">Repository URL</span>
              <span className="form-hint">HTTPS clone URL</span>
            </div>
            <input
              className="form-input mono"
              value={env.GIT_REPO_URL || ''}
              onChange={e => setEnv('GIT_REPO_URL', e.target.value)}
              placeholder="https://github.com/your-org/argocd-repo.git"
            />

            <hr className="form-divider" />

            <div className="form-label-cell">
              <span className="form-label">Base Branch</span>
            </div>
            <input
              className="form-input mono"
              value={env.GIT_BRANCH || ''}
              onChange={e => setEnv('GIT_BRANCH', e.target.value)}
              placeholder="main"
            />

            <hr className="form-divider" />

            <div className="form-label-cell">
              <span className="form-label">Commit Author</span>
              <span className="form-hint">Name for PR commits</span>
            </div>
            <input
              className="form-input"
              value={env.GIT_USER_NAME || ''}
              onChange={e => setEnv('GIT_USER_NAME', e.target.value)}
              placeholder="Kubecost Bot"
            />

            <hr className="form-divider" />

            <div className="form-label-cell">
              <span className="form-label">Author Email</span>
            </div>
            <input
              className="form-input"
              value={env.GIT_USER_EMAIL || ''}
              onChange={e => setEnv('GIT_USER_EMAIL', e.target.value)}
              placeholder="kubecost-bot@example.com"
            />

            <hr className="form-divider" />

            <div className="form-label-cell">
              <span className="form-label">GitHub Token</span>
              <span className="form-hint">Managed as a Secret</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Update via{' '}
              <code className="code-inline">kubectl edit secret github-pat -n kubecost</code>
            </div>
          </div>
        </div>
      </div>

      {/* Rightsizing params */}
      <div className="card">
        <div className="card-header"><span className="card-title">Rightsizing Parameters</span></div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-label-cell">
              <span className="form-label">Target CPU Utilization</span>
              <span className="form-hint">Recommendations leave this % headroom</span>
            </div>
            <div className="range-row">
              <input
                type="range"
                className="range-input"
                min="10" max="95" step="1"
                value={cpuPct}
                onChange={e => setEnv('TARGET_CPU_UTIL', (parseInt(e.target.value) / 100).toFixed(2))}
              />
              <span className="range-value">{cpuPct}%</span>
            </div>

            <hr className="form-divider" />

            <div className="form-label-cell">
              <span className="form-label">Target RAM Utilization</span>
              <span className="form-hint">Recommendations leave this % headroom</span>
            </div>
            <div className="range-row">
              <input
                type="range"
                className="range-input"
                min="10" max="95" step="1"
                value={ramPct}
                onChange={e => setEnv('TARGET_RAM_UTIL', (parseInt(e.target.value) / 100).toFixed(2))}
              />
              <span className="range-value">{ramPct}%</span>
            </div>

            <hr className="form-divider" />

            <div className="form-label-cell">
              <span className="form-label">Analysis Window</span>
              <span className="form-hint">Historical data range</span>
            </div>
            <select
              className="form-input form-select"
              value={env.WINDOW || '3d'}
              onChange={e => setEnv('WINDOW', e.target.value)}
            >
              {WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="save-bar">
        {dirty && <span className="save-bar-hint">Unsaved changes</span>}
        <button className="btn btn-secondary" onClick={fetchConfig} disabled={saving}>
          Reset
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
          {saving && <span className="spinner" />}
          {saving ? 'Saving…' : 'Save Configuration'}
        </button>
      </div>
    </div>
  )
}
