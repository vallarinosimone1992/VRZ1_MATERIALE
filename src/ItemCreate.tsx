import { FormEvent, useEffect, useState } from 'react'
import { loadReferenceData, locationPath } from './data'
import { supabase } from './lib/supabase'
import type { Branch, Profile, Room, Site, Squad, StorageLocation, Unit } from './types'

type Refs = { branches: Branch[]; units: Unit[]; squads: Squad[]; sites: Site[]; rooms: Room[]; locations: StorageLocation[] }

export function ItemCreate({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [refs, setRefs] = useState<Refs | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [branchId, setBranchId] = useState(profile.role === 'eg' ? 'eg' : 'comune')
  const [unitId, setUnitId] = useState(profile.role === 'eg' ? profile.unit_id ?? '' : 'comune')
  const [squadId, setSquadId] = useState(profile.role === 'eg' ? profile.squad_id ?? '' : '')
  const [siteId, setSiteId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [location, setLocation] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [unitOfMeasure, setUnitOfMeasure] = useState('pz')
  const [isConsumable, setIsConsumable] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadReferenceData().then((data) => {
      setRefs(data)
      if (profile.role === 'eg') {
        setBranchId('eg')
        setUnitId(profile.unit_id ?? '')
        setSquadId(profile.squad_id ?? '')
      } else {
        const firstBranch = profile.role === 'rs'
          ? data.branches.find((branch) => branch.id === 'comune')
          : data.branches[0]
        const nextBranch = firstBranch?.id ?? 'comune'
        setBranchId(nextBranch)
        setUnitId(data.units.find((unit) => unit.branch_id === nextBranch)?.id ?? '')
        setSquadId('')
      }
      setSiteId(data.sites[0]?.id ?? '')
    }).catch((err) => setError(err instanceof Error ? err.message : 'Errore'))
  }, [profile.role, profile.unit_id, profile.squad_id])

  if (!refs) return <p className="muted">Caricamento nuovo materiale…</p>
  const dataRefs = refs
  const egLocked = profile.role === 'eg'

  const allowedBranches = profile.role === 'rs'
    ? dataRefs.branches.filter((branch) => branch.id === 'comune' || branch.id === 'rs')
    : profile.role === 'eg'
      ? dataRefs.branches.filter((branch) => branch.id === 'eg')
      : dataRefs.branches
  const units = profile.role === 'eg'
    ? dataRefs.units.filter((unit) => unit.id === profile.unit_id)
    : dataRefs.units.filter((unit) => unit.branch_id === branchId)
  const squads = profile.role === 'eg'
    ? dataRefs.squads.filter((squad) => squad.id === profile.squad_id)
    : dataRefs.squads.filter((squad) => squad.unit_id === unitId)
  const rooms = dataRefs.rooms.filter((room) => room.site_id === siteId && room.active)
  const locations = dataRefs.locations.filter((entry) => entry.room_id === roomId && entry.active)

  function changeBranch(next: string) {
    if (egLocked) return
    setBranchId(next)
    setUnitId(dataRefs.units.find((unit) => unit.branch_id === next)?.id ?? '')
    setSquadId('')
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const numericQuantity = Number(quantity.replace(',', '.'))
    const finalBranchId = profile.role === 'eg' ? 'eg' : branchId
    const finalUnitId = profile.role === 'eg' ? profile.unit_id ?? '' : unitId
    const finalSquadId = profile.role === 'eg' ? profile.squad_id ?? '' : squadId

    if (!name.trim() || !finalBranchId || !finalUnitId) {
      setSaving(false)
      return setError('Nome, branca e unità sono obbligatori.')
    }
    if (profile.role === 'eg' && !finalSquadId) {
      setSaving(false)
      return setError('Il profilo E/G deve essere associato a una squadriglia.')
    }
    if (!Number.isFinite(numericQuantity) || numericQuantity < 0) {
      setSaving(false)
      return setError('Quantità non valida.')
    }
    const { error: insertError } = await supabase.from('items').insert({
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      branch_id: finalBranchId,
      unit_id: finalUnitId,
      squad_id: finalSquadId || null,
      room_id: roomId || null,
      storage_location_id: locationId || null,
      location: location.trim() || null,
      quantity: numericQuantity,
      unit_of_measure: unitOfMeasure.trim() || 'pz',
      is_consumable: isConsumable,
      notes: notes.trim() || null,
    })
    if (insertError) setError(insertError.message)
    else onDone()
    setSaving(false)
  }

  return (
    <main className="stack">
      <form className="panel admin-form" onSubmit={save}>
        <div className="section-heading"><div><p className="eyebrow">Inventario</p><h3>Nuovo materiale</h3></div><button type="button" className="secondary" onClick={onDone}>Annulla</button></div>
        {error && <p className="error">{error}</p>}
        <div className="form-grid two-columns">
          <label>Nome *<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>Categoria<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="es. Pionieristica" /></label>
          <label className="wide">Descrizione<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label>Branca *<select value={branchId} onChange={(e) => changeBranch(e.target.value)} disabled={egLocked}>{allowedBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}</select></label>
          <label>Unità *<select value={unitId} onChange={(e) => { if (!egLocked) { setUnitId(e.target.value); setSquadId('') } }} disabled={egLocked}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
          {branchId === 'eg' && squads.length > 0 && <label>Squadriglia *<select value={squadId} onChange={(e) => { if (!egLocked) setSquadId(e.target.value) }} disabled={egLocked} required><option value="">Comune / nessuna</option>{squads.map((squad) => <option key={squad.id} value={squad.id}>{squad.label}</option>)}</select></label>}
          <label>Sede<select value={siteId} onChange={(e) => { setSiteId(e.target.value); setRoomId(''); setLocationId('') }}><option value="">Non indicata</option>{dataRefs.sites.filter((site) => site.active).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <label>Stanza<select value={roomId} onChange={(e) => { setRoomId(e.target.value); setLocationId('') }}><option value="">Non indicata</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          <label>Posizione<select value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">Non indicata</option>{locations.map((entry) => <option key={entry.id} value={entry.id}>{locationPath(entry.id, dataRefs.locations)}</option>)}</select></label>
          <label>Dettaglio posizione<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="es. dietro la cassa blu" /></label>
          <label>Quantità iniziale<input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
          <label>Unità di misura<input value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} placeholder="pz, m, rotoli…" /></label>
          <label className="checkbox-label"><input type="checkbox" checked={isConsumable} onChange={(e) => setIsConsumable(e.target.checked)} /> Materiale consumabile</label>
          <label className="wide">Nota permanente<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </div>
        {egLocked && <p className="field-help">Come E/G puoi aggiungere materiale solo alla tua squadriglia.</p>}
        <div className="form-actions"><button type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva materiale'}</button></div>
      </form>
    </main>
  )
}
