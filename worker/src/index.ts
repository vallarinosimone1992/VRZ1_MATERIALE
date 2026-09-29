interface Env {
  DB: D1Database
  APP_ENV: string
  FRONTEND_ORIGIN: string
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

    return json({ error: 'Not found' }, { status: 404 }, origin, env)
  },
} satisfies ExportedHandler<Env>
