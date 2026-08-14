import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type UserRole = 'admin' | 'capo' | 'rs' | 'eg'

type Profile = {
  id: string
  full_name: string
  role: UserRole
  unit_id: string | null
  squad_id: string | null
  active: boolean
}

type Item = {
  id: string
  name: string
  description: string | null
  category: string | null
  branch_id: string
  unit_id: string
  squad_id: string | null
  location: string | null
  quantity: number
  unit_of_measure: string
  is_consumable: boolean
  notes: string | null
  branch: { label: string } | null
  unit: { label: string } | null
  squad: { label: string } | null
  room: { name: string } | null
}

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
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Accesso…' : 'Accedi'}</button>
        </form>
      </section>
    </main>
  )
}

function Inventory({ profile }: { profile: Profile }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadItems(search = query) {
    setLoading(true)
    setError('')

    let request = supabase
      .from('items')
      .select(`
        id, name, description, category, branch_id, unit_id, squad_id,
        location, quantity, unit_of_measure, is_consumable, notes,
        branch:branches(label), unit:units(label), squad:squads(label), room:rooms(name)
      `)
      .order('name')
      .limit(100)

    const cleaned = search.trim().replaceAll(',', ' ')
    if (cleaned) {
      const pattern = `%${cleaned}%`
      request = request.or(
        `name.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},location.ilike.${pattern},notes.ilike.${pattern}`,
      )
    }

    const { data, error: queryError } = await request
    if (queryError) setError(queryError.message)
    else setItems((data ?? []) as unknown as Item[])
    setLoading(false)
  }

  useEffect(() => {
    void loadItems('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canUse = useMemo(() => (item: Item) => {
    if (profile.role === 'admin' || profile.role === 'capo' || profile.role === 'rs') return true
    return profile.role === 'eg' && item.branch_id === 'eg' && !!profile.squad_id && item.squad_id === profile.squad_id
  }, [profile])

  async function changeQuantity(item: Item, direction: 1 | -1) {
    const verb = direction > 0 ? 'Aggiungi' : 'Consuma'
    const raw = window.prompt(`${verb}: quantità in ${item.unit_of_measure}`)
    if (raw === null) return

    const amount = Number(raw.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert('Inserisci una quantità positiva valida.')
      return
    }

    const note = window.prompt('Nota opzionale sul movimento:') ?? null
    const { error: movementError } = await supabase.rpc('apply_stock_movement', {
      p_item_id: item.id,
      p_delta: direction * amount,
      p_note: note || null,
    })

    if (movementError) {
      window.alert(movementError.message)
      return
    }

    await loadItems()
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    void loadItems()
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

      <main>
        <form className="searchbar" onSubmit={submitSearch}>
          <input
            aria-label="Cerca materiale"
            placeholder="Cerca materiale, stanza, posizione, categoria…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">Cerca</button>
        </form>

        {error && <p className="error panel">{error}</p>}
        {loading && <p className="muted">Ricerca…</p>}

        {!loading && (
          <section className="item-grid">
            {items.map((item) => (
              <article className="item-card" key={item.id}>
                <div className="item-heading">
                  <div>
                    <h2>{item.name}</h2>
                    <p className="scope">
                      {item.branch?.label ?? item.branch_id} · {item.unit?.label ?? item.unit_id}
                      {item.squad && ` · ${item.squad.label}`}
                    </p>
                  </div>
                  <strong className="quantity">{item.quantity} {item.unit_of_measure}</strong>
                </div>

                {item.description && <p>{item.description}</p>}
                <dl>
                  <div><dt>Stanza</dt><dd>{item.room?.name ?? 'Non indicata'}</dd></div>
                  <div><dt>Posizione</dt><dd>{item.location ?? 'Non indicata'}</dd></div>
                  {item.category && <div><dt>Categoria</dt><dd>{item.category}</dd></div>}
                </dl>
                {item.notes && <p className="item-note">{item.notes}</p>}

                {canUse(item) && (
                  <div className="actions">
                    <button className="danger secondary" onClick={() => void changeQuantity(item, -1)}>Consuma</button>
                    <button onClick={() => void changeQuantity(item, 1)}>Aggiungi</button>
                  </div>
                )}
              </article>
            ))}
            {items.length === 0 && <p className="muted">Nessun materiale trovato.</p>}
          </section>
        )}
      </main>
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
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
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
        .select('id, full_name, role, unit_id, squad_id, active')
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
    return (
      <main className="centered-page">
        <section className="panel">
          <h1>Account non abilitato</h1>
          <p>{profileError}</p>
          <button onClick={() => void supabase.auth.signOut()}>Esci</button>
        </section>
      </main>
    )
  }

  return <Inventory profile={profile} />
}
