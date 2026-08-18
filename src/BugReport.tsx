import { FormEvent, useState } from 'react'
import { supabase } from './lib/supabase'

export function BugReport({ onDone }: { onDone: () => void }) {
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

    setDescription('')
    setMessage('Segnalazione inviata. Grazie.')
    setSaving(false)
  }

  return (
    <main className="stack">
      <section className="panel admin-form">
        <div className="section-heading">
          <div><p className="eyebrow">Supporto</p><h2>Segnala un bug</h2></div>
          <button type="button" className="secondary" onClick={onDone}>Annulla</button>
        </div>
        <p className="muted">Descrivi cosa è successo e, se utile, cosa stavi cercando di fare. La segnalazione sarà visibile agli Admin.</p>
        <form className="stack" onSubmit={submit}>
          <label>Descrizione del problema
            <textarea rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Es. Premendo Aggiungi sulla scheda della tenda compare…" required />
          </label>
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <div className="form-actions"><button type="submit" disabled={saving}>{saving ? 'Invio…' : 'Invia segnalazione'}</button></div>
        </form>
      </section>
    </main>
  )
}
