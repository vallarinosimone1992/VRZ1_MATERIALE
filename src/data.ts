import { supabase } from './lib/supabase'
import type { Branch, Item, Profile, Room, Site, Squad, StorageLocation, Unit } from './types'

export const ITEM_SELECT = `
  id, name, description, category, branch_id, unit_id, squad_id,
  room_id, storage_location_id, location, quantity, unit_of_measure,
  is_consumable, notes, created_at, updated_at,
  branch:branches(label),
  unit:units(label),
  squad:squads(label),
  room:rooms(id, name, site_id, site:sites(name)),
  storage_location:storage_locations(id, name, parent_id)
`

export async function loadReferenceData() {
  const [branches, units, squads, sites, rooms, locations] = await Promise.all([
    supabase.from('branches').select('*').order('sort_order'),
    supabase.from('units').select('*').order('sort_order'),
    supabase.from('squads').select('*').order('sort_order'),
    supabase.from('sites').select('*').order('sort_order'),
    supabase.from('rooms').select('*').order('name'),
    supabase.from('storage_locations').select('*').order('sort_order').order('name'),
  ])

  const error = branches.error || units.error || squads.error || sites.error || rooms.error || locations.error
  if (error) throw error

  return {
    branches: (branches.data ?? []) as Branch[],
    units: (units.data ?? []) as Unit[],
    squads: (squads.data ?? []) as Squad[],
    sites: (sites.data ?? []) as Site[],
    rooms: (rooms.data ?? []) as Room[],
    locations: (locations.data ?? []) as StorageLocation[],
  }
}

export async function loadItems(search = '') {
  let request = supabase.from('items').select(ITEM_SELECT).order('name').limit(500)
  const cleaned = search.trim().replaceAll(',', ' ')
  if (cleaned) {
    const pattern = `%${cleaned}%`
    request = request.or(
      `name.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},location.ilike.${pattern},notes.ilike.${pattern}`,
    )
  }
  const { data, error } = await request
  if (error) throw error
  return (data ?? []) as unknown as Item[]
}

export function canUseItem(profile: Profile, item: Item) {
  if (profile.role === 'admin' || profile.role === 'capo' || profile.role === 'rs') return true
  return profile.role === 'eg' && item.branch_id === 'eg' && !!profile.squad_id && item.squad_id === profile.squad_id
}

export function canEditItem(profile: Profile, item: Item) {
  if (profile.role === 'admin' || profile.role === 'capo') return true
  return profile.role === 'rs' && item.branch_id === 'rs'
}

export function locationPath(locationId: string | null, locations: StorageLocation[]) {
  if (!locationId) return ''
  const byId = new Map(locations.map((location) => [location.id, location]))
  const names: string[] = []
  let current = byId.get(locationId)
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    names.unshift(current.name)
    current = current.parent_id ? byId.get(current.parent_id) : undefined
  }
  return names.join(' → ')
}

export function formatScope(item: Item) {
  return [item.branch?.label ?? item.branch_id, item.unit?.label ?? item.unit_id, item.squad?.label]
    .filter(Boolean)
    .join(' · ')
}

export function formatPhysicalLocation(item: Item, locations: StorageLocation[] = []) {
  const parts = [item.room?.site?.name, item.room?.name]
  const path = locationPath(item.storage_location_id, locations) || item.storage_location?.name
  if (path) parts.push(path)
  if (item.location) parts.push(item.location)
  return parts.filter(Boolean).join(' → ') || 'Non indicata'
}
