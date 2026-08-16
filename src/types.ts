export type UserRole = 'admin' | 'capo' | 'rs' | 'eg'

export type Profile = {
  id: string
  email: string | null
  full_name: string
  role: UserRole
  unit_id: string | null
  squad_id: string | null
  active: boolean
}

export type RegistrationRequest = {
  id: string
  user_id: string
  email: string
  full_name: string
  requested_role: Exclude<UserRole, 'admin'>
  request_note: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
}

export type Branch = { id: string; label: string; sort_order: number }
export type Unit = { id: string; branch_id: string; label: string; is_common: boolean; sort_order: number }
export type Squad = { id: string; unit_id: string; label: string; sort_order: number }
export type Site = { id: string; name: string; active: boolean; sort_order: number }
export type Room = { id: string; site_id: string; name: string; notes: string | null; active: boolean }
export type StorageLocation = {
  id: string
  room_id: string
  parent_id: string | null
  name: string
  location_type: string | null
  notes: string | null
  active: boolean
  sort_order: number
}

export type Item = {
  id: string
  name: string
  description: string | null
  category: string | null
  branch_id: string
  unit_id: string
  squad_id: string | null
  room_id: string | null
  storage_location_id: string | null
  location: string | null
  quantity: number
  unit_of_measure: string
  is_consumable: boolean
  notes: string | null
  created_at?: string
  updated_at?: string
  branch: { label: string } | null
  unit: { label: string } | null
  squad: { label: string } | null
  room: ({ id: string; name: string; site_id: string; site: { name: string } | null } | null)
  storage_location: ({ id: string; name: string; parent_id: string | null } | null)
}

export type ItemNote = { id: string; note: string; author_id: string; created_at: string }
export type StockMovement = {
  id: string
  delta: number
  quantity_before: number
  quantity_after: number
  note: string | null
  user_id: string | null
  created_at: string
}
export type AuditEntry = {
  id: number
  action: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  user_id: string | null
  created_at: string
}
