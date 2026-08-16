import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AdminPanel } from './AdminPanel'
import { Inventory } from './Inventory'
import { ItemCreate } from './ItemCreate'
import { ItemEdit } from './ItemEdit'
import { supabase } from './lib/supabase'
import type { Item, Profile, RegistrationRequest } from './types'

function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [requestedRole, setRequestedRole] = useState<'capo' | 'rs' | 'eg'>('capo')
  const [requestNote, setRequestNote] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(next: 'login' | 'register') {
    setMode(next)
    setError('')
    setMessage('')
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) setError(authError.message)
    setLoading(false)
  }

  async function submitRegistration(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          registration_source: 'self_service',
          full_name: fullName.trim(),
          requested_role: requestedRole,
          request_note: requestNote.trim(),
        },
      },
    })
    if (authError) {
      setError(authError.message)
    } else if (data.session) {
      setMessage('Richiesta inviata. Il tuo account deve essere approvato da un Admin prima di poter accedere all’inventario.')
    } else {
      setMessage('Registrazione ricevuta. Se richiesto, conferma l’email; l’accesso all’inventario resterà comunque in attesa dell’approvazione di un Admin.')
    }
    setLoading(false)
  }

  return (
    <main className="centered-page">
      <section className="panel auth-panel">
        <p className="eyebrow">Sedi scout di Ragioneria</p>
        <h1>VRZ1 Materiale</h1>
        <div className="subnav auth-tabs">
          <button type="button" className={mode === 'login' ? '' : 'secondary'} onClick={() => switchMode('login')}>Accedi</button>
          <button type="button" className={mode === 'register' ? '' : 'secondary'} onClick={() => switchMode('register')}>Richiedi accesso</button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={submitLogin} className="stack">
            <p className="muted">Accedi con il tuo account già approvato.</p>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? 'Accesso…' : 'Accedi'}</button>
          </form>
        ) : (
          <form onSubmit={submitRegistration} className="stack">
            <p className="muted">Scegli la tua password. Un Admin dovrà approvare la richiesta prima che tu possa usare l’inventario.</p>
            <label>Nome e cognome<input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /><span className="field-help">Almeno 8 caratteri.</span></label>
            <label>Ruolo richiesto<select value={requestedRole} onChange={(e) => setRequestedRole(e.target.value as 'capo' | 'rs' | 'eg')}><option value="capo">Capo</option><option value="rs">R/S</option><option value="eg">E/G</option></select></label>
            <label>Unità / squadriglia (opzionale)<input value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="es. Reparto Mulino, Cobra" /></label>
            {error && <p className="error">{error}</p>}
            {message && <p className="success">{message}</p>}
            <button type="submit" disabled={loading || Boolean(message)}>{loading ? 'Invio…' : 'Invia richiesta'}</button>
          </form>
        )}
      </section>
    </main>
  )
}

function Workspace({ profile }: { profile: Profile }) {
  const [page, setPage] = useState<'inventory' | 'admin' | 'edit' | 'create'>('inventory')
  const [editItem, setEditItem] = useState<Item | null>(null)

  function openEdit(item: Item) {
    setEditItem(item)
    setPage(profile.role === 'admin' ? 'admin' : 'edit')
  }

  function backToInventory() {
    setEditItem(null)
    setPage('inventory')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sedi scout di Ragioneria</p>
          <h1>Materiale</h1>
        </div>
        <div className="account">
          <span>{profile.full_name}</span>
          <span className="role-badge">{profile.role.toUpperCase()}</span>
          <button className="secondary" onClick={() => void supabase.auth.signOut()}>Esci</button>
        </div>
      </header>

      <nav className="mainnav">
        <button className={page === 'inventory' ? '' : 'secondary'} onClick={backToInventory}>Inventario</button>
        {profile.role === 'admin' && <button className={page === 'admin' ? '' : 'secondary'} onClick={() => { setEditItem(null); setPage('admin') }}>Amministrazione</button>}
      </nav>

      {page === 'inventory' && <Inventory profile={profile} onEditItem={openEdit} onCreateItem={() => setPage('create')} />}
      {page === 'create' && (profile.role === 'admin' || profile.role === 'capo' || profile.role === 'rs' || profile.role === 'eg') && (
        <ItemCreate profile={profile} onDone={backToInventory} />
      )}
      {page === 'admin' && profile.role === 'admin' && (
        <AdminPanel currentProfile={profile} initialItem={editItem} onInitialItemHandled={() => setEditItem(null)} />
      )}
      {page === 'edit' && editItem && (profile.role === 'capo' || profile.role === 'rs' || profile.role === 'eg') && (
        <ItemEdit item={editItem} profile={profile} onDone={backToInventory} />
      )}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [registration, setRegistration] = useState<RegistrationRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) {
        setProfile(null)
        setRegistration(null)
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, unit_id, squad_id, active')
        .eq('id', session.user.id)
        .maybeSingle()
      if (data?.active) {
        setProfile(data as Profile)
        setRegistration(null)
        setProfileError('')
      } else {
        setProfile(null)
        const { data: request } = await supabase
          .from('registration_requests')
          .select('id, user_id, email, full_name, requested_role, request_note, status, created_at, reviewed_at')
          .eq('user_id', session.user.id)
          .maybeSingle()
        setRegistration((request as RegistrationRequest | null) ?? null)
        if (error && error.code !== 'PGRST116') setProfileError(error.message)
        else setProfileError('Account autenticato ma non abilitato nell’inventario.')
      }
      setLoading(false)
    }
    void loadProfile()
  }, [session])

  if (loading) return <main className="centered-page"><p>Caricamento…</p></main>
  if (!session) return <Login />
  if (!profile) {
    const pending = registration?.status === 'pending'
    const rejected = registration?.status === 'rejected'
    return <main className="centered-page"><section className="panel auth-panel"><h1>{pending ? 'Richiesta in attesa' : rejected ? 'Richiesta non approvata' : 'Account non abilitato'}</h1><p>{pending ? 'La registrazione è stata ricevuta. Un Admin deve ancora approvare il tuo account e assegnare i permessi.' : rejected ? 'La richiesta di accesso non è stata approvata. Contatta un Admin se pensi che sia un errore.' : profileError}</p><button onClick={() => void supabase.auth.signOut()}>Esci</button></section></main>
  }
  return <Workspace profile={profile} />
}
