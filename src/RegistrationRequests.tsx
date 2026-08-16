import { useEffect, useMemo, useState } from 'react'
import { loadReferenceData } from './data'
import { supabase } from './lib/supabase'
import type { RegistrationRequest, Squad, Unit, UserRole } from './types'

type ApprovalDraft = {
  request: RegistrationRequest
  role: Exclude<UserRole, 'admin'>
  unit_id: string
  squad_id: string
}

export function RegistrationRequests() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [draft, setDraft] = useState<ApprovalDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      const [requestResult, refs] = await Promise.all([
        supabase
          .from('registration_requests')
          .select('id, user_id, email, full_name, requested_role, request_note, status, created_at, reviewed_at')
          .eq('status', 'pending')
          .order('created_at'),
        loadReferenceData(),
      ])
      if (requestResult.error) throw requestResult.error
      setRequests((requestResult.data ?? []) as RegistrationRequest[])
      setUnits(refs.units)
      setSquads(refs.squads)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento delle richieste')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const allowedUnits = useMemo(() => {
    if (!draft) return []
    if (draft.role === 'eg') return units.filter((unit) => unit.branch_id === 'eg' && !unit.is_common)
    if (draft.role === 'rs') return units.filter((unit) => unit.branch_id === 'rs' && !unit.is_common)
    return units.filter((unit) => !unit.is_common)
  }, [draft, units])

  const allowedSquads = useMemo(() => {
    if (!draft?.unit_id) return []
    return squads.filter((squad) => squad.unit_id === draft.unit_id)
  }, [draft, squads])

  function beginApprove(request: RegistrationRequest) {
    const role = request.requested_role
    const firstUnit = role === 'eg'
      ? units.find((unit) => unit.branch_id === 'eg' && !unit.is_common)?.id ?? ''
      : role === 'rs'
        ? units.find((unit) => unit.branch_id === 'rs' && !unit.is_common)?.id ?? ''
        : ''
    setDraft({ request, role, unit_id: firstUnit, squad_id: '' })
    setError('')
  }

  function changeRole(role: Exclude<UserRole, 'admin'>) {
    if (!draft) return
    const firstUnit = role === 'eg'
      ? units.find((unit) => unit.branch_id === 'eg' && !unit.is_common)?.id ?? ''
      : role === 'rs'
        ? units.find((unit) => unit.branch_id === 'rs' && !unit.is_common)?.id ?? ''
        : ''
    setDraft({ ...draft, role, unit_id: firstUnit, squad_id: '' })
  }

  async function approve() {
    if (!draft) return
    if (draft.role === 'eg' && !draft.squad_id) {
      setError('Per un utente E/G devi selezionare una squadriglia.')
      return
    }
    setSaving(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('approve_registration_request', {
      p_request_id: draft.request.id,
      p_role: draft.role,
      p_unit_id: draft.unit_id || null,
      p_squad_id: draft.role === 'eg' ? draft.squad_id || null : null,
    })
    if (rpcError) setError(rpcError.message)
    else {
      setDraft(null)
      await refresh()
    }
    setSaving(false)
  }

  async function reject(request: RegistrationRequest) {
    if (!window.confirm(`Rifiutare la richiesta di ${request.full_name}?`)) return
    setError('')
    const { error: rpcError } = await supabase.rpc('reject_registration_request', { p_request_id: request.id })
    if (rpcError) setError(rpcError.message)
    else await refresh()
  }

  if (draft) {
    return (
      <main className="stack">
        <section className="panel admin-form">
          <div className="section-heading">
            <div><p className="eyebrow">Richieste accesso</p><h3>Approva {draft.request.full_name}</h3></div>
            <button className="secondary" onClick={() => setDraft(null)}>Annulla</button>
          </div>
          <p><strong>{draft.request.email}</strong></p>
          {draft.request.request_note && <p className="item-note">Indicazione dell’utente: {draft.request.request_note}</p>}
          {error && <p className="error">{error}</p>}
          <div className="form-grid two-columns">
            <label>Ruolo<select value={draft.role} onChange={(e) => changeRole(e.target.value as Exclude<UserRole, 'admin'>)}><option value="capo">Capo</option><option value="rs">R/S</option><option value="eg">E/G</option></select></label>
            {draft.role !== 'capo' && <label>Unità<select value={draft.unit_id} onChange={(e) => setDraft({ ...draft, unit_id: e.target.value, squad_id: '' })}><option value="">Nessuna / non rilevante</option>{allowedUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>}
            {draft.role === 'eg' && <label>Squadriglia *<select value={draft.squad_id} onChange={(e) => setDraft({ ...draft, squad_id: e.target.value })}><option value="">Seleziona…</option>{allowedSquads.map((squad) => <option key={squad.id} value={squad.id}>{squad.label}</option>)}</select></label>}
          </div>
          <div className="form-actions"><button onClick={() => void approve()} disabled={saving}>{saving ? 'Approvazione…' : 'Approva account'}</button></div>
        </section>
      </main>
    )
  }

  return (
    <main className="stack">
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Admin</p><h2>Richieste accesso</h2></div><button className="secondary" onClick={() => void refresh()}>Aggiorna</button></div>
        {error && <p className="error">{error}</p>}
        {loading && <p className="muted">Caricamento…</p>}
        {!loading && requests.length === 0 && <p className="muted">Nessuna richiesta in attesa.</p>}
        <div className="admin-list">
          {requests.map((request) => (
            <article className="admin-row" key={request.id}>
              <div>
                <strong>{request.full_name}</strong>
                <span>{request.email} · ruolo richiesto: {request.requested_role.toUpperCase()}</span>
                {request.request_note && <span>{request.request_note}</span>}
              </div>
              <div className="actions">
                <button className="secondary danger" onClick={() => void reject(request)}>Rifiuta</button>
                <button onClick={() => beginApprove(request)}>Approva</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
