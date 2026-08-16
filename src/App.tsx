import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AdminPanel } from './AdminPanel'
import { Inventory } from './Inventory'
import { ItemCreate } from './ItemCreate'
import { ItemEdit } from './ItemEdit'
import { supabase } from './lib/supabase'
import type { Item, Profile } from './types'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) setError(authError.message)
    setLoading(false)
  }

  return (
    <main className="centered-page">
      <section className="panel auth-panel">
        <p className="eyebrow">Sedi scout di Ragioneria</p>
        <h1>VRZ1 Materiale</h1>
        <p className="muted">Accedi per cercare e utilizzare il materiale.</p>
        <form onSubmit={submit} className="stack">
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Accesso…' : 'Accedi'}</button>
        </form>
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
      {page === 'create' && (profile.role === 'admin' || profile.role === 'capo' || profile.role === 'rs') && (
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
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, unit_id, squad_id, active')
        .eq('id', session.user.id)
        .single()
      if (error || !data?.active) {
        setProfile(null)
        setProfileError('Account autenticato ma non ancora abilitato nell’inventario. Contatta l’amministratore.')
      } else {
        setProfile(data as Profile)
        setProfileError('')
      }
      setLoading(false)
    }
    void loadProfile()
  }, [session])

  if (loading) return <main className="centered-page"><p>Caricamento…</p></main>
  if (!session) return <Login />
  if (!profile) {
    return <main className="centered-page"><section className="panel"><h1>Account non abilitato</h1><p>{profileError}</p><button onClick={() => void supabase.auth.signOut()}>Esci</button></section></main>
  }
  return <Workspace profile={profile} />
}
