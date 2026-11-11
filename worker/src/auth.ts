export type RequestedRole = 'capo' | 'rs' | 'eg'

// Cloudflare Workers WebCrypto currently limits PBKDF2 to 100,000 iterations.
const PASSWORD_ITERATIONS = 100_000
const encoder = new TextEncoder()

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PASSWORD_ITERATIONS,
    },
    keyMaterial,
    256,
  )

  return {
    hash: bytesToBase64(new Uint8Array(bits)),
    salt: bytesToBase64(salt),
    iterations: PASSWORD_ITERATIONS,
  }
}

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase('en-US')
}

export function isRequestedRole(value: unknown): value is RequestedRole {
  return value === 'capo' || value === 'rs' || value === 'eg'
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export async function verifyPassword(
  password: string,
  expectedHash: string,
  saltBase64: string,
  iterations: number,
) {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100_000) return false
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(saltBase64), iterations },
    key,
    256,
  )
  const actual = new Uint8Array(bits)
  const expected = base64ToBytes(expectedHash)
  let diff = actual.length ^ expected.length
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ (expected[i] ?? 0)
  return diff === 0
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createSessionToken() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
}
