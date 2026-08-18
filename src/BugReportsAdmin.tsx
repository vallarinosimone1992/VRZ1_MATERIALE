import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type BugReportRow = {
  id: string
  reporter_id: string
  description: string
  page: string | null
  user_agent: string | null
  status: 'open' | 'closed'
  created_at: string
  closed_at: string | null
}

type Reporter = { id: string; full_name: string; email: string | null }

export function BugReportsAdmin() {
  const [reports, setReports] = useState<BugReportRow[]>([])
  const [reporters, setReporters] = useState<Record<string, Reporter>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadReports() {
    setLoading(true)
    const [reportResult, profileResult] = await Promise.all([
      supabase.from('bug_reports').select('id, reporter_id, description, page, user_agent, status, created_at, closed_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email'),
    ])
    const queryError = reportResult.error || profileResult.error
    if (queryError) setError(queryError.message)
    else {
      setReports((reportResult.data ?? []) as BugReportRow[])
      setReporters(Object.fromEntries(((profileResult.data ?? []) as Reporter[]).map((profile) => [profile.id, profile])))
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => { void loadReports() }, [])

  async function setStatus(report: BugReportRow, status: 'open' | 'closed') {
    const { error: updateError } = await supabase
      .from('bug_reports')
      .update({ status, closed_at: status === 'closed' ? new Date().toISOString() : null })
      .eq('id', report.id)
    if (updateError) setError(updateError.message)
    else await loadReports()
  }

  return (
    <main className="stack">
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Supporto</p><h2>Segnalazioni bug</h2></div></div>
        {error && <p className="error">{error}</p>}
        {loading && <p className="muted">Caricamento…</p>}
        {!loading && <div className="admin-list">
          {reports.map((report) => {
            const reporter = reporters[report.reporter_id]
            return (
              <article className="admin-row" key={report.id}>
                <div>
                  <strong>{report.status === 'open' ? 'Aperta' : 'Chiusa'} · {new Date(report.created_at).toLocaleString('it-IT')}</strong>
                  <span>{reporter ? `${reporter.full_name}${reporter.email ? ` · ${reporter.email}` : ''}` : `Utente ${report.reporter_id}`}</span>
                  <span>{report.description}</span>
                  {report.page && <span>Pagina: {report.page}</span>}
                </div>
                <button className="secondary" onClick={() => void setStatus(report, report.status === 'open' ? 'closed' : 'open')}>
                  {report.status === 'open' ? 'Segna risolta' : 'Riapri'}
                </button>
              </article>
            )
          })}
          {reports.length === 0 && <p className="muted">Nessuna segnalazione.</p>}
        </div>}
      </section>
    </main>
  )
}
