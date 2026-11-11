import { createSessionToken, hashPassword, hashToken, isRequestedRole, normalizeEmail, verifyPassword } from './auth'

interface Env {
  DB: D1Database
  APP_ENV: string
  FRONTEND_ORIGIN: string
}

type RegistrationBody = {
  email?: unknown
  password?: unknown
  full_name?: unknown
  requested_role?: unknown
  request_note?: unknown
}

function corsHeaders(origin: string | null, env: Env) {
  const allowed = origin === env.FRONTEND_ORIGIN ? origin : env.FRONTEND_ORIGIN
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Vary': 'Origin',
  }
}

function json(data: unknown, init: ResponseInit = {}, origin: string | null = null, env?: Env) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  if (env) {
    for (const [key, value] of Object.entries(corsHeaders(origin, env))) headers.set(key, value)
  }
  return new Response(JSON.stringify(data), { ...init, headers })
}

async function register(request: Request, env: Env, origin: string | null) {
  let body: RegistrationBody
  try {
    body = await request.json<RegistrationBody>()
  } catch {
    return json({ error: 'JSON non valido.' }, { status: 400 }, origin, env)
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
  const requestNote = typeof body.request_note === 'string' ? body.request_note.trim() : ''

  if (!email || !email.includes('@')) {
    return json({ error: 'Email non valida.' }, { status: 400 }, origin, env)
  }
  if (password.length < 8) {
    return json({ error: 'La password deve contenere almeno 8 caratteri.' }, { status: 400 }, origin, env)
  }
  if (!fullName) {
    return json({ error: 'Nome e cognome sono obbligatori.' }, { status: 400 }, origin, env)
  }
  if (!isRequestedRole(body.requested_role)) {
    return json({ error: 'Ruolo richiesto non valido.' }, { status: 400 }, origin, env)
  }

  const existing = await env.DB.prepare(
    'SELECT id FROM accounts WHERE email = ? COLLATE NOCASE LIMIT 1',
  ).bind(email).first<{ id: string }>()

  if (existing) {
    return json(
      { error: 'Esiste già un account o una richiesta associata a questa email.' },
      { status: 409 },
      origin,
      env,
    )
  }

  const userId = crypto.randomUUID()
  const requestId = crypto.randomUUID()
  const passwordData = await hashPassword(password)

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO accounts
          (id, email, full_name, password_hash, password_salt, password_iterations)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(
        userId,
        email,
        fullName,
        passwordData.hash,
        passwordData.salt,
        passwordData.iterations,
      ),
      env.DB.prepare(
        `INSERT INTO registration_requests
          (id, user_id, email, full_name, requested_role, request_note, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      ).bind(
        requestId,
        userId,
        email,
        fullName,
        body.requested_role,
        requestNote || null,
      ),
    ])
  } catch (error) {
    console.error('Registration failed', error)
    return json({ error: 'Impossibile completare la registrazione.' }, { status: 500 }, origin, env)
  }

  return json(
    {
      ok: true,
      status: 'pending',
      message: 'Richiesta inviata. Un Admin deve approvare l’account prima dell’accesso.',
    },
    { status: 201 },
    origin,
    env,
  )
}


type LoginAccount = {
  id: string
  email: string
  full_name: string
  password_hash: string
  password_salt: string
  password_iterations: number
  role: string | null
  unit_id: string | null
  squad_id: string | null
  active: number | null
}

function bearerToken(request: Request) {
  const match = /^Bearer ([A-Za-z0-9_-]{40,128})$/.exec(request.headers.get('Authorization') ?? '')
  return match?.[1] ?? null
}

async function authenticatedUser(request: Request, env: Env) {
  const token = bearerToken(request)
  if (!token) return null
  const tokenHash = await hashToken(token)
  return env.DB.prepare(
    `SELECT a.id, a.email, a.full_name, p.role, p.unit_id, p.squad_id
     FROM sessions s
     JOIN accounts a ON a.id = s.account_id
     JOIN profiles p ON p.id = a.id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND p.active = 1`,
  ).bind(tokenHash).first<{
    id: string; email: string; full_name: string; role: string
    unit_id: string | null; squad_id: string | null
  }>()
}

async function login(request: Request, env: Env, origin: string | null) {
  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'JSON non valido.' }, { status: 400 }, origin, env)
  }
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) {
    return json({ error: 'Email e password obbligatorie.' }, { status: 400 }, origin, env)
  }
  const account = await env.DB.prepare(
    `SELECT a.id, a.email, a.full_name, a.password_hash, a.password_salt,
            a.password_iterations, p.role, p.unit_id, p.squad_id, p.active
     FROM accounts a LEFT JOIN profiles p ON p.id = a.id
     WHERE a.email = ? COLLATE NOCASE`,
  ).bind(email).first<LoginAccount>()

  let valid = false
  if (account) {
    try {
      valid = await verifyPassword(
        password, account.password_hash, account.password_salt, account.password_iterations,
      )
    } catch {
      valid = false
    }
  }
  if (!account || !valid) {
    return json({ error: 'Credenziali non valide.' }, { status: 401 }, origin, env)
  }
  if (!account.role || account.active !== 1) {
    return json({ error: 'Account non approvato o disattivato.' }, { status: 403 }, origin, env)
  }
  if (account.role === 'eg' && !account.squad_id) {
    return json({ error: 'Assegnazione alla squadriglia mancante.' }, { status: 403 }, origin, env)
  }

  const token = createSessionToken()
  await env.DB.prepare(
    `INSERT INTO sessions (id, account_id, token_hash, expires_at)
     VALUES (?, ?, ?, datetime('now', '+7 days'))`,
  ).bind(crypto.randomUUID(), account.id, await hashToken(token)).run()

  return json({
    ok: true,
    token,
    token_type: 'Bearer',
    expires_in: 604800,
    user: {
      id: account.id, email: account.email, full_name: account.full_name,
      role: account.role, unit_id: account.unit_id, squad_id: account.squad_id,
    },
  }, { status: 200, headers: { 'Cache-Control': 'no-store' } }, origin, env)
}

async function logout(request: Request, env: Env, origin: string | null) {
  const token = bearerToken(request)
  if (!token) return json({ error: 'Non autenticato.' }, { status: 401 }, origin, env)
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
    .bind(await hashToken(token)).run()
  return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } }, origin, env)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) })
    }

    if (request.method === 'GET' && url.pathname === '/api/v2/health') {
      const database = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()
      return json(
        {
          ok: database?.ok === 1,
          service: 'vrz1-materiale-api',
          version: '2.0.0-dev.0',
          environment: env.APP_ENV,
          database: database?.ok === 1 ? 'ok' : 'unavailable',
        },
        { status: database?.ok === 1 ? 200 : 503 },
        origin,
        env,
      )
    }

    if (request.method === 'POST' && url.pathname === '/api/v2/auth/register') {
      return register(request, env, origin)
    }

    if (request.method === 'POST' && url.pathname === '/api/v2/auth/login') {
      return login(request, env, origin)
    }
    if (request.method === 'POST' && url.pathname === '/api/v2/auth/logout') {
      return logout(request, env, origin)
    }
    if (request.method === 'GET' && url.pathname === '/api/v2/auth/me') {
      const user = await authenticatedUser(request, env)
      return user
        ? json({ user }, { headers: { 'Cache-Control': 'no-store' } }, origin, env)
        : json({ error: 'Non autenticato.' }, { status: 401 }, origin, env)
    }

    return json({ error: 'Not found' }, { status: 404 }, origin, env)
  },
} satisfies ExportedHandler<Env>
