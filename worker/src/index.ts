import { hashPassword, isRequestedRole, normalizeEmail } from './auth'

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
    'Access-Control-Allow-Headers': 'Content-Type',
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

    return json({ error: 'Not found' }, { status: 404 }, origin, env)
  },
} satisfies ExportedHandler<Env>
