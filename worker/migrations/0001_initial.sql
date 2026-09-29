PRAGMA foreign_keys = ON;

-- VRZ1 Materiale v2 - Cloudflare D1 / SQLite
-- IDs applicativi: TEXT UUID/slugs generati dal Worker.

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE units (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  label TEXT NOT NULL,
  is_common INTEGER NOT NULL DEFAULT 0 CHECK (is_common IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (branch_id, label)
);

CREATE TABLE squads (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (unit_id, label)
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','capo','rs','eg')),
  unit_id TEXT REFERENCES units(id) ON UPDATE CASCADE ON DELETE SET NULL,
  squad_id TEXT REFERENCES squads(id) ON UPDATE CASCADE ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX sessions_account_idx ON sessions(account_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

CREATE TABLE registration_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('capo','rs','eg')),
  request_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX registration_requests_status_date_idx
  ON registration_requests(status, created_at DESC);

CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, name)
);

CREATE TABLE storage_locations (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE CASCADE,
  parent_id TEXT REFERENCES storage_locations(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  location_type TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(room_id, parent_id, name)
);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  unit_id TEXT NOT NULL REFERENCES units(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  squad_id TEXT REFERENCES squads(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  room_id TEXT REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE SET NULL,
  storage_location_id TEXT REFERENCES storage_locations(id) ON UPDATE CASCADE ON DELETE SET NULL,
  location TEXT,
  is_consumable INTEGER NOT NULL DEFAULT 0 CHECK (is_consumable IN (0,1)),
  quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_of_measure TEXT NOT NULL DEFAULT 'pz',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX items_name_idx ON items(name);
CREATE INDEX items_branch_idx ON items(branch_id);
CREATE INDEX items_unit_idx ON items(unit_id);
CREATE INDEX items_squad_idx ON items(squad_id);

CREATE TABLE item_notes (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  note TEXT NOT NULL CHECK (length(trim(note)) > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX item_notes_item_date_idx ON item_notes(item_id, created_at DESC);

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  delta REAL NOT NULL CHECK (delta <> 0),
  quantity_before REAL NOT NULL,
  quantity_after REAL NOT NULL CHECK (quantity_after >= 0),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX stock_movements_item_date_idx ON stock_movements(item_id, created_at DESC);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_data TEXT,
  new_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX audit_log_item_date_idx ON audit_log(item_id, created_at DESC);

CREATE TABLE bug_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (length(trim(description)) >= 5),
  page TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

INSERT INTO branches (id, label, sort_order) VALUES
  ('comune', 'Comune', 0),
  ('castorini', 'Castorini', 10),
  ('lc', 'L/C', 20),
  ('eg', 'E/G', 30),
  ('rs', 'R/S', 40);

INSERT INTO units (id, branch_id, label, is_common, sort_order) VALUES
  ('comune', 'comune', 'Comune', 1, 0),
  ('castorini-comune', 'castorini', 'Comune', 1, 0),
  ('terra-di-betula', 'castorini', 'Colonia Terra di Betula', 0, 10),
  ('lc-comune', 'lc', 'Comune', 1, 0),
  ('branco-seeonee', 'lc', 'Branco Seeonee', 0, 10),
  ('branco-san-domenico-savio', 'lc', 'Branco San Domenico Savio', 0, 20),
  ('eg-comune', 'eg', 'Comune', 1, 0),
  ('reparto-mulino', 'eg', 'Reparto Mulino', 0, 10),
  ('reparto-don-bosco', 'eg', 'Reparto Don Bosco', 0, 20),
  ('rs-comune', 'rs', 'Comune', 1, 0),
  ('noviziato', 'rs', 'Noviziato', 0, 10),
  ('clan-ad-navalia', 'rs', 'Clan Ad Navalia', 0, 20),
  ('clan-ingegner-novelli', 'rs', 'Clan Ingegner Novelli', 0, 30);

INSERT INTO squads (id, unit_id, label, sort_order) VALUES
  ('mulino-cobra', 'reparto-mulino', 'Cobra', 10),
  ('mulino-falchi', 'reparto-mulino', 'Falchi', 20),
  ('mulino-pantere', 'reparto-mulino', 'Pantere', 30),
  ('mulino-tigri', 'reparto-mulino', 'Tigri', 40),
  ('don-bosco-aquile', 'reparto-don-bosco', 'Aquile', 10),
  ('don-bosco-antilopi', 'reparto-don-bosco', 'Antilopi', 20),
  ('don-bosco-castori', 'reparto-don-bosco', 'Castori', 30),
  ('don-bosco-scoiattoli', 'reparto-don-bosco', 'Scoiattoli', 40);

INSERT INTO sites(id, name, sort_order) VALUES
  ('ragioneria', 'Ragioneria', 10),
  ('diga', 'Diga', 20);

INSERT INTO rooms(id, site_id, name) VALUES
  ('ragioneria-sede-rs', 'ragioneria', 'Sede RS'),
  ('ragioneria-sede-don-bosco', 'ragioneria', 'Sede Don Bosco'),
  ('ragioneria-sede-mulino', 'ragioneria', 'Sede Mulino'),
  ('ragioneria-tana-seeonee', 'ragioneria', 'Tana Seeonee'),
  ('ragioneria-tana-san-domenico-savio', 'ragioneria', 'Tana San Domenico Savio'),
  ('ragioneria-sottoscala', 'ragioneria', 'Sottoscala'),
  ('ragioneria-bagno', 'ragioneria', 'Bagno'),
  ('ragioneria-piano-superiore', 'ragioneria', 'Piano superiore'),
  ('diga-stanza-unica', 'diga', 'Stanza unica');
