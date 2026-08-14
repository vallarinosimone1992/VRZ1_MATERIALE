import { FormEvent, useEffect, useState } from 'react'
import { canEditItem, canUseItem, formatPhysicalLocation, formatScope, loadItems, loadReferenceData } from './data'
import { ItemDetail } from './ItemDetail'
import { supabase } from './lib/supabase'
import type { Item, Profile, StorageLocation } from './types'

export function Inventory({ profile, onEditItem }: { profile: Profile; onEditItem: (item: Item) => void }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function refresh(search = query) {
    setLoading(true)
    try {
      const [nextItems, refs] = await Promise.all([loadItems(search), loadReferenceData()])
      setItems(nextItems)
      setLocations(refs.locations)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh('') }, [])

  const selected = selectedId ? items.find((item) => item.id === selectedId) ?? null : null

  async function changeQuantity(item: Item, direction: 1 | -1) {
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
    await refresh()
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    void refresh()
  }

  if (selected) {
    return (
      <ItemDetail
        item={selected}
        profile={profile}
        locations={locations}
        onClose={() => setSelectedId(null)}
        onQuantityChanged={async () => { await refresh(); }}
        onEdit={canEditItem(profile, selected) ? () => onEditItem(selected) : undefined}
      />
    )
  }

  return (
    <main>
      <form className="searchbar" onSubmit={submitSearch}>
        <input
          aria-label="Cerca materiale"
          placeholder="Cerca materiale, posizione, categoria, note…"
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
            <article className="item-card clickable" key={item.id} onClick={() => setSelectedId(item.id)}>
              <div className="item-heading">
                <div>
                  <h2>{item.name}</h2>
                  <p className="scope">{formatScope(item)}</p>
                </div>
                <strong className="quantity">{item.quantity} {item.unit_of_measure}</strong>
              </div>
              {item.description && <p>{item.description}</p>}
              <dl>
                <div><dt>Posizione</dt><dd>{formatPhysicalLocation(item, locations)}</dd></div>
                {item.category && <div><dt>Categoria</dt><dd>{item.category}</dd></div>}
              </dl>
              {item.notes && <p className="item-note">{item.notes}</p>}
              {canUseItem(profile, item) && (
                <div className="actions" onClick={(event) => event.stopPropagation()}>
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
  )
}
