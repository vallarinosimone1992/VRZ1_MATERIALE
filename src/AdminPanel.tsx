import { FormEvent, useEffect, useMemo, useState } from 'react'
import { loadItems, loadReferenceData, locationPath } from './data'
import { supabase } from './lib/supabase'
import type { Branch, Item, Profile, Room, Site, Squad, StorageLocation, Unit, UserRole } from './types'

type ReferenceData = {
  branches: Branch[]
  units: Unit[]
  squads: Squad[]
  sites: Site[]
  rooms: Room[]
  locations: StorageLocation[]
}

const emptyRefs: ReferenceData = { branches: [], units: [], squads: [], sites: [], rooms: [], locations: [] }

type ItemDraft = {
  id?: string
  name: string
  description: string
  category: string
  branch_id: string
  unit_id: string
  squad_id: string
  site_id: string
  room_id: string
  storage_location_id: string
  location: string
  is_consumable: boolean
  quantity: string
  unit_of_measure: string
  notes: string
}

function emptyItem(refs: ReferenceData): ItemDraft {
  const branch = refs.branches[0]?.id ?? 'comune'
  const unit = refs.units.find((entry) => entry.branch_id === branch)?.id ?? 'comune'
  const site = refs.sites[0]?.id ?? ''
  return {
    name: '', description: '', category: '', branch_id: branch, unit_id: unit, squad_id: '',
    site_id: site, room_id: '', storage_location_id: '', location: '', is_consumable: false,
    quantity: '0', unit_of_measure: 'pz', notes: '',
  }
}

function draftFromItem(item: Item, refs: ReferenceData): ItemDraft {
  const room = refs.rooms.find((entry) => entry.id === item.room_id)
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    category: item.category ?? '',
    branch_id: item.branch_id,
    unit_id: item.unit_id,
    squad_id: item.squad_id ?? '',
    site_id: room?.site_id ?? '',
    room_id: item.room_id ?? '',
    storage_location_id: item.storage_location_id ?? '',
    location: item.location ?? '',
    is_consumable: item.is_consumable,
    quantity: String(item.quantity),
    unit_of_measure: item.unit_of_measure,
    notes: item.notes ?? '',
  }
}

function MaterialManager({ refs, initialItem, onDone }: { refs: ReferenceData; initialItem: Item | null; onDone: () => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [draft, setDraft] = useState<ItemDraft>(() => initialItem ? draftFromItem(initialItem, refs) : emptyItem(refs))
  const [editing, setEditing] = useState(Boolean(initialItem))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function refreshItems() {
    try { setItems(await loadItems()) } catch (err) { setError(err instanceof Error ? err.message : 'Errore') }
  }
  useEffect(() => { void refreshItems() }, [])
  useEffect(() => {
    if (initialItem) { setDraft(draftFromItem(initialItem, refs)); setEditing(true) }
  }, [initialItem, refs])

  const units = refs.units.filter((unit) => unit.branch_id === draft.branch_id)
  const squads = refs.squads.filter((squad) => squad.unit_id === draft.unit_id)
  const rooms = refs.rooms.filter((room) => room.site_id === draft.site_id && room.active)
  const locations = refs.locations.filter((location) => location.room_id === draft.room_id && location.active)

  function setBranch(branchId: string) {
    const firstUnit = refs.units.find((unit) => unit.branch_id === branchId)?.id ?? ''
    setDraft((current) => ({ ...current, branch_id: branchId, unit_id: firstUnit, squad_id: '' }))
  }
  function setSite(siteId: string) {
    setDraft((current) => ({ ...current, site_id: siteId, room_id: '', storage_location_id: '' }))
  }
  function setRoom(roomId: string) {
    setDraft((current) => ({ ...current, room_id: roomId, storage_location_id: '' }))
  }

  function startNew() { setDraft(emptyItem(refs)); setEditing(true); setError('') }
  function startEdit(item: Item) { setDraft(draftFromItem(item, refs)); setEditing(true); setError('') }
  function cancel() { setEditing(false); setDraft(emptyItem(refs)); onDone() }

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const quantity = Number(draft.quantity.replace(',', '.'))
    if (!draft.name.trim() || !draft.branch_id || !draft.unit_id) {
      setSaving(false); return setError('Nome, branca e unità sono obbligatori.')
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      setSaving(false); return setError('Quantità non valida.')
    }

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      category: draft.category.trim() || null,
      branch_id: draft.branch_id,
      unit_id: draft.unit_id,
      squad_id: draft.squad_id || null,
      room_id: draft.room_id || null,
      storage_location_id: draft.storage_location_id || null,
      location: draft.location.trim() || null,
      is_consumable: draft.is_consumable,
      unit_of_measure: draft.unit_of_measure.trim() || 'pz',
      notes: draft.notes.trim() || null,
    }

    const result = draft.id
      ? await supabase.from('items').update(payload).eq('id', draft.id)
      : await supabase.from('items').insert({ ...payload, quantity })

    if (result.error) setError(result.error.message)
    else {
      await refreshItems()
      setEditing(false)
      setDraft(emptyItem(refs))
      onDone()
    }
    setSaving(false)
  }

  if (editing) {
    return (
      <form className="panel admin-form" onSubmit={save}>
        <div className="section-heading"><div><p className="eyebrow">Materiale</p><h3>{draft.id ? 'Modifica materiale' : 'Nuovo materiale'}</h3></div><button type="button" className="secondary" onClick={cancel}>Annulla</button></div>
        {error && <p className="error">{error}</p>}
        <div className="form-grid two-columns">
          <label>Nome *<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
          <label>Categoria<input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="es. Pionieristica" /></label>
          <label className="wide">Descrizione<textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          <label>Branca *<select value={draft.branch_id} onChange={(e) => setBranch(e.target.value)}>{refs.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}</select></label>
          <label>Unità *<select value={draft.unit_id} onChange={(e) => setDraft({ ...draft, unit_id: e.target.value, squad_id: '' })}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
          {draft.branch_id === 'eg' && squads.length > 0 && <label>Squadriglia<select value={draft.squad_id} onChange={(e) => setDraft({ ...draft, squad_id: e.target.value })}><option value="">Comune / nessuna</option>{squads.map((squad) => <option key={squad.id} value={squad.id}>{squad.label}</option>)}</select></label>}
          <label>Sede<select value={draft.site_id} onChange={(e) => setSite(e.target.value)}><option value="">Non indicata</option>{refs.sites.filter((site) => site.active).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <label>Stanza<select value={draft.room_id} onChange={(e) => setRoom(e.target.value)}><option value="">Non indicata</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          <label>Posizione<select value={draft.storage_location_id} onChange={(e) => setDraft({ ...draft, storage_location_id: e.target.value })}><option value="">Non indicata</option>{locations.map((location) => <option key={location.id} value={location.id}>{locationPath(location.id, refs.locations)}</option>)}</select></label>
          <label>Dettaglio posizione<input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="es. dietro la cassa blu" /></label>
          {!draft.id && <label>Quantità iniziale<input inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></label>}
          {draft.id && <label>Quantità attuale<input value={draft.quantity} disabled /><span className="field-help">Modificala con Consuma/Aggiungi.</span></label>}
          <label>Unità di misura<input value={draft.unit_of_measure} onChange={(e) => setDraft({ ...draft, unit_of_measure: e.target.value })} placeholder="pz, m, rotoli…" /></label>
          <label className="checkbox-label"><input type="checkbox" checked={draft.is_consumable} onChange={(e) => setDraft({ ...draft, is_consumable: e.target.checked })} /> Materiale consumabile</label>
          <label className="wide">Nota permanente<textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
        </div>
        <div className="form-actions"><button type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva'}</button></div>
      </form>
    )
  }

  return (
    <section className="panel">
      <div className="section-heading"><div><p className="eyebrow">Materiale</p><h3>Gestione inventario</h3></div><button onClick={startNew}>+ Nuovo materiale</button></div>
      <div className="admin-list">
        {items.map((item) => <article className="admin-row" key={item.id}><div><strong>{item.name}</strong><span>{item.branch?.label} · {item.unit?.label}{item.squad?.label ? ` · ${item.squad.label}` : ''}</span></div><div><span>{item.quantity} {item.unit_of_measure}</span><button className="secondary" onClick={() => startEdit(item)}>Modifica</button></div></article>)}
        {items.length === 0 && <p className="muted">Nessun materiale ancora inserito.</p>}
      </div>
    </section>
  )
}

function LocationManager({ refs, reload }: { refs: ReferenceData; reload: () => Promise<void> }) {
  const [siteName, setSiteName] = useState('')
  const [roomSite, setRoomSite] = useState(refs.sites[0]?.id ?? '')
  const [roomName, setRoomName] = useState('')
  const [locationRoom, setLocationRoom] = useState(refs.rooms[0]?.id ?? '')
  const [parentId, setParentId] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationType, setLocationType] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!roomSite && refs.sites[0]) setRoomSite(refs.sites[0].id)
    if (!locationRoom && refs.rooms[0]) setLocationRoom(refs.rooms[0].id)
  }, [refs, roomSite, locationRoom])

  const parents = refs.locations.filter((location) => location.room_id === locationRoom)

  async function addSite(event: FormEvent) {
    event.preventDefault(); const name = siteName.trim(); if (!name) return
    const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { error: insertError } = await supabase.from('sites').insert({ id, name })
    if (insertError) setError(insertError.message); else { setSiteName(''); await reload() }
  }
  async function addRoom(event: FormEvent) {
    event.preventDefault(); if (!roomSite || !roomName.trim()) return
    const { error: insertError } = await supabase.from('rooms').insert({ site_id: roomSite, name: roomName.trim() })
    if (insertError) setError(insertError.message); else { setRoomName(''); await reload() }
  }
  async function addLocation(event: FormEvent) {
    event.preventDefault(); if (!locationRoom || !locationName.trim()) return
    const { error: insertError } = await supabase.from('storage_locations').insert({ room_id: locationRoom, parent_id: parentId || null, name: locationName.trim(), location_type: locationType.trim() || null })
    if (insertError) setError(insertError.message); else { setLocationName(''); setLocationType(''); setParentId(''); await reload() }
  }
  async function rename(table: 'sites' | 'rooms' | 'storage_locations', id: string, current: string) {
    const next = window.prompt('Nuovo nome:', current)?.trim(); if (!next || next === current) return
    const { error: updateError } = await supabase.from(table).update({ name: next }).eq('id', id)
    if (updateError) setError(updateError.message); else await reload()
  }

  return (
    <div className="stack">
      {error && <p className="error panel">{error}</p>}
      <section className="panel"><p className="eyebrow">Luoghi</p><h3>Sedi e stanze</h3>
        <div className="location-columns">
          {refs.sites.map((site) => <div className="location-card" key={site.id}><div className="location-title"><strong>{site.name}</strong><button className="link-button" onClick={() => void rename('sites', site.id, site.name)}>Rinomina</button></div>{refs.rooms.filter((room) => room.site_id === site.id).map((room) => <div className="room-block" key={room.id}><div className="location-title"><span>{room.name}</span><button className="link-button" onClick={() => void rename('rooms', room.id, room.name)}>Rinomina</button></div>{refs.locations.filter((location) => location.room_id === room.id).map((location) => <div className="location-leaf" key={location.id}><span>{locationPath(location.id, refs.locations)}</span><button className="link-button" onClick={() => void rename('storage_locations', location.id, location.name)}>Rinomina</button></div>)}</div>)}</div>)}
        </div>
      </section>
      <section className="admin-three-grid">
        <form className="panel stack" onSubmit={addSite}><h3>+ Sede</h3><label>Nome<input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></label><button type="submit">Aggiungi sede</button></form>
        <form className="panel stack" onSubmit={addRoom}><h3>+ Stanza</h3><label>Sede<select value={roomSite} onChange={(e) => setRoomSite(e.target.value)}>{refs.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label><label>Nome<input value={roomName} onChange={(e) => setRoomName(e.target.value)} /></label><button type="submit">Aggiungi stanza</button></form>
        <form className="panel stack" onSubmit={addLocation}><h3>+ Posizione</h3><label>Stanza<select value={locationRoom} onChange={(e) => { setLocationRoom(e.target.value); setParentId('') }}>{refs.rooms.map((room) => <option key={room.id} value={room.id}>{refs.sites.find((site) => site.id === room.site_id)?.name} · {room.name}</option>)}</select></label><label>Dentro a<select value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">Direttamente nella stanza</option>{parents.map((location) => <option key={location.id} value={location.id}>{locationPath(location.id, refs.locations)}</option>)}</select></label><label>Nome<input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Armadio verde, ripiano alto…" /></label><label>Tipo opzionale<input value={locationType} onChange={(e) => setLocationType(e.target.value)} placeholder="armadio, scaffale, cassetto…" /></label><button type="submit">Aggiungi posizione</button></form>
      </section>
    </div>
  )
}

type UserDraft = { id?: string; email: string; password: string; full_name: string; role: UserRole; unit_id: string; squad_id: string; active: boolean }
const emptyUser: UserDraft = { email: '', password: '', full_name: '', role: 'capo', unit_id: '', squad_id: '', active: true }

function UserManager({ refs, currentProfile }: { refs: ReferenceData; currentProfile: Profile }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [draft, setDraft] = useState<UserDraft>(emptyUser)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadProfiles() {
    const { data, error: queryError } = await supabase.from('profiles').select('id, email, full_name, role, unit_id, squad_id, active').order('full_name')
    if (queryError) setError(queryError.message); else setProfiles((data ?? []) as Profile[])
  }
  useEffect(() => { void loadProfiles() }, [])

  const allowedUnits = useMemo(() => {
    if (draft.role === 'eg') return refs.units.filter((unit) => unit.branch_id === 'eg' && !unit.is_common)
    if (draft.role === 'rs') return refs.units.filter((unit) => unit.branch_id === 'rs' && !unit.is_common)
    return refs.units.filter((unit) => !unit.is_common)
  }, [draft.role, refs.units])
  const allowedSquads = refs.squads.filter((squad) => !draft.unit_id || squad.unit_id === draft.unit_id)

  function beginNew() { setDraft(emptyUser); setEditing(true); setError('') }
  function beginEdit(profile: Profile) { setDraft({ id: profile.id, email: profile.email ?? '', password: '', full_name: profile.full_name, role: profile.role, unit_id: profile.unit_id ?? '', squad_id: profile.squad_id ?? '', active: profile.active }); setEditing(true); setError('') }
  function setRole(role: UserRole) { setDraft((current) => ({ ...current, role, unit_id: '', squad_id: '' })) }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    if (draft.id) {
      if (draft.id === currentProfile.id && (draft.role !== 'admin' || !draft.active)) {
        setSaving(false); return setError('Non puoi rimuovere il tuo ruolo Admin o disattivare il tuo account da qui.')
      }
      const { error: updateError } = await supabase.from('profiles').update({ full_name: draft.full_name.trim(), role: draft.role, unit_id: draft.unit_id || null, squad_id: draft.role === 'eg' ? draft.squad_id || null : null, active: draft.active }).eq('id', draft.id)
      if (updateError) setError(updateError.message); else { setEditing(false); await loadProfiles() }
    } else {
      const { data, error: functionError } = await supabase.functions.invoke('admin-users', { body: { action: 'create', email: draft.email, password: draft.password, full_name: draft.full_name, role: draft.role, unit_id: draft.unit_id || null, squad_id: draft.role === 'eg' ? draft.squad_id || null : null } })
      const message = functionError?.message || (data as { error?: string } | null)?.error
      if (message) setError(message); else { setEditing(false); setDraft(emptyUser); await loadProfiles() }
    }
    setSaving(false)
  }

  if (editing) {
    return <form className="panel admin-form" onSubmit={save}><div className="section-heading"><div><p className="eyebrow">Utenti</p><h3>{draft.id ? 'Modifica utente' : 'Nuovo utente'}</h3></div><button type="button" className="secondary" onClick={() => setEditing(false)}>Annulla</button></div>{error && <p className="error">{error}</p>}<div className="form-grid two-columns"><label>Nome *<input value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} required /></label><label>Email *<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} disabled={Boolean(draft.id)} required /></label>{!draft.id && <label>Password temporanea *<input type="password" minLength={8} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} required /><span className="field-help">Almeno 8 caratteri.</span></label>}<label>Ruolo<select value={draft.role} onChange={(e) => setRole(e.target.value as UserRole)}><option value="capo">Capo</option><option value="rs">R/S</option><option value="eg">E/G</option><option value="admin">Admin</option></select></label>{draft.role !== 'admin' && <label>Unità<select value={draft.unit_id} onChange={(e) => setDraft({ ...draft, unit_id: e.target.value, squad_id: '' })}><option value="">Nessuna / non rilevante</option>{allowedUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>}{draft.role === 'eg' && <label>Squadriglia *<select value={draft.squad_id} onChange={(e) => setDraft({ ...draft, squad_id: e.target.value })} required><option value="">Seleziona…</option>{allowedSquads.map((squad) => <option key={squad.id} value={squad.id}>{squad.label}</option>)}</select></label>}{draft.id && <label className="checkbox-label"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Account attivo</label>}</div><div className="form-actions"><button type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva'}</button></div></form>
  }

  return <section className="panel"><div className="section-heading"><div><p className="eyebrow">Utenti</p><h3>Gestione utenti</h3></div><button onClick={beginNew}>+ Nuovo utente</button></div>{error && <p className="error">{error}</p>}<div className="admin-list">{profiles.map((profile) => <article className="admin-row" key={profile.id}><div><strong>{profile.full_name}</strong><span>{profile.email || 'Email non registrata'} · {profile.role.toUpperCase()} · {profile.active ? 'attivo' : 'disattivato'}</span></div><button className="secondary" onClick={() => beginEdit(profile)}>Modifica</button></article>)}</div></section>
}

export function AdminPanel({ currentProfile, initialItem, onInitialItemHandled }: { currentProfile: Profile; initialItem: Item | null; onInitialItemHandled: () => void }) {
  const [section, setSection] = useState<'materials' | 'locations' | 'users'>(initialItem ? 'materials' : 'materials')
  const [refs, setRefs] = useState<ReferenceData>(emptyRefs)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function reloadRefs() {
    try { setRefs(await loadReferenceData()); setError('') } catch (err) { setError(err instanceof Error ? err.message : 'Errore') }
  }
  useEffect(() => { void reloadRefs().finally(() => setLoading(false)) }, [])

  if (loading) return <p className="muted">Caricamento amministrazione…</p>
  if (error) return <p className="error panel">{error}</p>

  return <main className="stack"><nav className="subnav"><button className={section === 'materials' ? '' : 'secondary'} onClick={() => setSection('materials')}>Materiale</button><button className={section === 'locations' ? '' : 'secondary'} onClick={() => setSection('locations')}>Sedi e posizioni</button><button className={section === 'users' ? '' : 'secondary'} onClick={() => setSection('users')}>Utenti</button></nav>{section === 'materials' && <MaterialManager refs={refs} initialItem={initialItem} onDone={onInitialItemHandled} />}{section === 'locations' && <LocationManager refs={refs} reload={reloadRefs} />}{section === 'users' && <UserManager refs={refs} currentProfile={currentProfile} />}</main>
}
