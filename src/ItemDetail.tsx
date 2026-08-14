import { FormEvent, useEffect, useMemo, useState } from 'react'
import { canUseItem, formatPhysicalLocation, formatScope } from './data'
import { supabase } from './lib/supabase'
import type { AuditEntry, Item, ItemNote, Profile, StockMovement, StorageLocation } from './types'

const fieldLabels: Record<string, string> = {
  name: 'nome', description: 'descrizione', category: 'categoria', branch_id: 'branca', unit_id: 'unità',
  squad_id: 'squadriglia', room_id: 'stanza', storage_location_id: 'posizione', location: 'dettaglio posizione',
  is_consumable: 'consumabile', unit_of_measure: 'unità di misura', notes: 'note', quantity: 'quantità',
}

function auditSummary(entry: AuditEntry) {
  if (entry.action === 'item.created') return 'Materiale creato'
  if (entry.action === 'item.deleted') return 'Materiale eliminato'
  if (entry.action !== 'item.updated' || !entry.old_data || !entry.new_data) return null

  const ignored = new Set(['updated_at', 'updated_by'])
  const changed = Object.keys(entry.new_data).filter((key) => !ignored.has(key) && entry.old_data?.[key] !== entry.new_data?.[key])
  if (changed.length === 1 && changed[0] === 'quantity') return null
  const labels = changed.map((key) => fieldLabels[key] ?? key)
  return labels.length ? `Modificato: ${labels.join(', ')}` : 'Scheda aggiornata'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ItemDetail({
  item,
  profile,
  locations,
  onClose,
  onQuantityChanged,
  onEdit,
}: {
  item: Item
  profile: Profile
  locations: StorageLocation[]
  onClose: () => void
  onQuantityChanged: () => Promise<void>
  onEdit?: () => void
}) {
  const [notes, setNotes] = useState<ItemNote[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [newNote, setNewNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadHistory() {
    setLoading(true)
    const [noteResult, movementResult, auditResult] = await Promise.all([
      supabase.from('item_notes').select('id, note, author_id, created_at').eq('item_id', item.id).order('created_at', { ascending: false }),
      supabase.from('stock_movements').select('id, delta, quantity_before, quantity_after, note, user_id, created_at').eq('item_id', item.id).order('created_at', { ascending: false }),
      supabase.from('audit_log').select('id, action, old_data, new_data, user_id, created_at').eq('item_id', item.id).order('created_at', { ascending: false }),
    ])
    const queryError = noteResult.error || movementResult.error || auditResult.error
    if (queryError) setError(queryError.message)
    else {
      setNotes((noteResult.data ?? []) as ItemNote[])
      setMovements((movementResult.data ?? []) as StockMovement[])
      setAudit((auditResult.data ?? []) as AuditEntry[])
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => { void loadHistory() }, [item.id])

  const timeline = useMemo(() => {
    const rows = [
      ...movements.map((movement) => ({
        id: `m-${movement.id}`,
        date: movement.created_at,
        title: movement.delta > 0 ? `Aggiunti ${movement.delta} ${item.unit_of_measure}` : `Consumati ${Math.abs(movement.delta)} ${item.unit_of_measure}`,
        detail: `${movement.quantity_before} → ${movement.quantity_after}${movement.note ? ` · ${movement.note}` : ''}`,
      })),
      ...audit.map((entry) => ({ id: `a-${entry.id}`, date: entry.created_at, title: auditSummary(entry), detail: '' }))
        .filter((row): row is { id: string; date: string; title: string; detail: string } => Boolean(row.title)),
    ]
    return rows.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  }, [audit, movements, item.unit_of_measure])

  async function addNote(event: FormEvent) {
    event.preventDefault()
    const note = newNote.trim()
    if (!note) return
    const { error: insertError } = await supabase.from('item_notes').insert({ item_id: item.id, note, author_id: profile.id })
    if (insertError) setError(insertError.message)
    else {
      setNewNote('')
      await loadHistory()
    }
  }

  async function changeQuantity(direction: 1 | -1) {
    const verb = direction > 0 ? 'Aggiungi' : 'Consuma'
    const raw = window.prompt(`${verb}: quantità in ${item.unit_of_measure}`)
    if (raw === null) return
    const amount = Number(raw.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) return window.alert('Inserisci una quantità positiva valida.')
    const note = window.prompt('Nota opzionale sul movimento:') ?? null
    const { error: movementError } = await supabase.rpc('apply_stock_movement', {
      p_item_id: item.id,
      p_delta: direction * amount,
      p_note: note || null,
    })
    if (movementError) return window.alert(movementError.message)
    await onQuantityChanged()
    await loadHistory()
  }

  return (
    <section className="detail-page">
      <div className="detail-toolbar">
        <button className="secondary" onClick={onClose}>← Inventario</button>
        <div className="toolbar-actions">
          {onEdit && <button className="secondary" onClick={onEdit}>Modifica scheda</button>}
          {canUseItem(profile, item) && <>
            <button className="secondary danger" onClick={() => void changeQuantity(-1)}>Consuma</button>
            <button onClick={() => void changeQuantity(1)}>Aggiungi</button>
          </>}
        </div>
      </div>

      <div className="detail-hero panel">
        <div>
          <p className="eyebrow">{formatScope(item)}</p>
          <h2>{item.name}</h2>
          {item.description && <p>{item.description}</p>}
        </div>
        <strong className="detail-quantity">{item.quantity} {item.unit_of_measure}</strong>
      </div>

      {error && <p className="error panel">{error}</p>}

      <div className="detail-grid">
        <section className="panel">
          <h3>Collocazione e dati</h3>
          <dl>
            <div><dt>Posizione</dt><dd>{formatPhysicalLocation(item, locations)}</dd></div>
            <div><dt>Categoria</dt><dd>{item.category || 'Non indicata'}</dd></div>
            <div><dt>Consumabile</dt><dd>{item.is_consumable ? 'Sì' : 'No'}</dd></div>
          </dl>
          {item.notes && <div className="note-box"><strong>Nota permanente</strong><p>{item.notes}</p></div>}
        </section>

        <section className="panel">
          <h3>Note</h3>
          {canUseItem(profile, item) && (
            <form className="inline-note-form" onSubmit={addNote}>
              <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Aggiungi una nota operativa…" />
              <button type="submit">Aggiungi</button>
            </form>
          )}
          <div className="history-list">
            {notes.map((note) => <article key={note.id} className="history-row"><strong>{note.note}</strong><span>{formatDate(note.created_at)}</span></article>)}
            {!loading && notes.length === 0 && <p className="muted">Nessuna nota.</p>}
          </div>
        </section>
      </div>

      <section className="panel">
        <h3>Cronologia</h3>
        <div className="history-list">
          {timeline.map((row) => (
            <article className="history-row" key={row.id}>
              <div><strong>{row.title}</strong>{row.detail && <p>{row.detail}</p>}</div>
              <span>{formatDate(row.date)}</span>
            </article>
          ))}
          {!loading && timeline.length === 0 && <p className="muted">Nessuna modifica registrata.</p>}
        </div>
      </section>
    </section>
  )
}
