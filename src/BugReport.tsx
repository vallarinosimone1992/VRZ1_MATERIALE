import { FormEvent, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Profile } from './types'

export function BugReport({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const text = description.trim()
    if (text.length < 5) return setError('Descrivi il problema con almeno qualche parola.')

    setSaving(true)
    setError('')
    setMessage('')

    const { error: insertError } = await supabase.from('bug_reports').insert({
      description: text,
      page: window.location.pathname,
      user_agent: navigator.userAgent,
    })
    if (insertError) {
      setSaving(false)
      return setError(insertError.message)
    }

    const { data: recipient, error: recipientError } = await supabase.rpc('bug_report_recipient')
    if (recipientError || !recipient) {
      setSaving(false)
      setMessage('Segnalazione salvata. Non è stato possibile preparare automaticamente l’email all’Admin.')
      return
    }

    const subject = encodeURIComponent('VRZ1 Materiale - Segnalazione bug')
    const body = encodeURIComponent(
      `Segnalazione da: ${profile.full_name}${profile.email ? ` <${profile.email}>` : ''}\n\n${text}\n\nPagina: ${window.location.href}\nBrowser: ${navigator.userAgent}`,
    )

    setMessage('Segnalazione salvata. Si apre ora l’app email: controlla il testo e premi Invia.')
    setSaving(false)
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`
  }

  return (
    <main className="stack">
      <section className="panel admin-form">
        <div className="section-heading">
          <div><p className="eyebrow">Supporto</p><h2>Segnala un bug</h2></div>
          <button type="button" className="secondary" onClick={onDone}>Annulla</button>
        </div>
        <p className="muted">Descrivi cosa è successo e, se utile, cosa stavi cercando di fare. La segnalazione viene salvata nell’app e viene preparata anche un’email per l’Admin.</p>
        <form className="stack" onSubmit={submit}>
          <label>Descrizione del problema
            <textarea rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Es. Premendo Aggiungi sulla scheda della tenda compare…" required />
          </label>
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <div className="form-actions"><button type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva e prepara email'}</button></div>
        </form>
      </section>
    </main>
  )
}
