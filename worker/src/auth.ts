export type RequestedRole = 'capo' | 'rs' | 'eg'

const PASSWORD_ITERATIONS = 210_000
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
