import { FormEvent, useEffect, useState } from 'react'
import { loadReferenceData, locationPath } from './data'
import { supabase } from './lib/supabase'
import type { Item, Profile, Room, Site, Squad, StorageLocation, Unit, Branch } from './types'

type Refs = { branches: Branch[]; units: Unit[]; squads: Squad[]; sites: Site[]; rooms: Room[]; locations: StorageLocation[] }

export function ItemEdit({ item, profile, onDone }: { item: Item; profile: Profile; onDone: () => void }) {
  const [refs, setRefs] = useState<Refs | null>(null)
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description ?? '')
  const [category, setCategory] = useState(item.category ?? '')
  const [branchId, setBranchId] = useState(item.branch_id)
  const [unitId, setUnitId] = useState(item.unit_id)
  const [squadId, setSquadId] = useState(item.squad_id ?? '')
  const [siteId, setSiteId] = useState('')
  const [roomId, setRoomId] = useState(item.room_id ?? '')
  const [locationId, setLocationId] = useState(item.storage_location_id ?? '')
  const [location, setLocation] = useState(item.location ?? '')
  const [isConsumable, setIsConsumable] = useState(item.is_consumable)
  const [unitOfMeasure, setUnitOfMeasure] = useState(item.unit_of_measure)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadReferenceData().then((data) => {
      setRefs(data)
      setSiteId(data.rooms.find((room) => room.id === item.room_id)?.site_id ?? '')
    }).catch((err) => setError(err instanceof Error ? err.message : 'Errore'))
  }, [item.room_id])

  if (!refs) return <p className="muted">Caricamento editor…</p>

  const units = refs.units.filter((unit) => unit.branch_id === branchId)
  const squads = refs.squads.filter((squad) => squad.unit_id === unitId)
  const rooms = refs.rooms.filter((room) => room.site_id === siteId && room.active)
  const locations = refs.locations.filter((entry) => entry.room_id === roomId && entry.active)
  const rsLocked = profile.role === 'rs'

  function changeBranch(next: string) {
    if (rsLocked) return
    setBranchId(next)
    setUnitId(refs.units.find((unit) => unit.branch_id === next)?.id ?? '')
    setSquadId('')
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    const payload = {
      name: name.trim(), description: description.trim() || null, category: category.trim() || null,
      branch_id: branchId, unit_id: unitId, squad_id: squadId || null,
      room_id: roomId || null, storage_location_id: locationId || null, location: location.trim() || null,
      is_consumable: isConsumable, unit_of_measure: unitOfMeasure.trim() || 'pz', notes: notes.trim() || null,
    }
    const { error: updateError } = await supabase.from('items').update(payload).eq('id', item.id)
    if (updateError) setError(updateError.message); else onDone()
    setSaving(false)
  }

  return (
    <main className="stack">
      <form className="panel admin-form" onSubmit={save}>
        <div className="section-heading"><div><p className="eyebrow">EDIT</p><h3>Modifica {item.name}</h3></div><button type="button" className="secondary" onClick={onDone}>Annulla</button></div>
        {error && <p className="error">{error}</p>}
        <div className="form-grid two-columns">
          <label>Nome *<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>Categoria<input value={category} onChange={(e) => setCategory(e.target.value)} /></label>
          <label className="wide">Descrizione<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label>Branca<select value={branchId} onChange={(e) => changeBranch(e.target.value)} disabled={rsLocked}>{refs.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}</select></label>
          <label>Unità<select value={unitId} onChange={(e) => { setUnitId(e.target.value); setSquadId('') }}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
          {branchId === 'eg' && squads.length > 0 && <label>Squadriglia<select value={squadId} onChange={(e) => setSquadId(e.target.value)}><option value="">Comune / nessuna</option>{squads.map((squad) => <option key={squad.id} value={squad.id}>{squad.label}</option>)}</select></label>}
          <label>Sede<select value={siteId} onChange={(e) => { setSiteId(e.target.value); setRoomId(''); setLocationId('') }}><option value="">Non indicata</option>{refs.sites.filter((site) => site.active).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <label>Stanza<select value={roomId} onChange={(e) => { setRoomId(e.target.value); setLocationId('') }}><option value="">Non indicata</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          <label>Posizione<select value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">Non indicata</option>{locations.map((entry) => <option key={entry.id} value={entry.id}>{locationPath(entry.id, refs.locations)}</option>)}</select></label>
          <label>Dettaglio posizione<input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
          <label>Quantità attuale<input value={`${item.quantity} ${item.unit_of_measure}`} disabled /><span className="field-help">Usa Consuma/Aggiungi per modificarla.</span></label>
          <label>Unità di misura<input value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} /></label>
          <label className="checkbox-label"><input type="checkbox" checked={isConsumable} onChange={(e) => setIsConsumable(e.target.checked)} /> Materiale consumabile</label>
          <label className="wide">Nota permanente<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </div>
        <div className="form-actions"><button type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva modifiche'}</button></div>
      </form>
    </main>
  )
}
