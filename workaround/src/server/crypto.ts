import { env } from './env'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

let keyPromise: Promise<CryptoKey> | null = null

function getKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle
    .digest('SHA-256', encoder.encode(env.SESSION_SECRET))
    .then((digest) => crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']))
  return keyPromise
}

/**
 * AES-GCM seal/unseal keyed off SESSION_SECRET — used so the GitHub token
 * inside queued sweep messages is never stored in plaintext.
 */
export async function seal(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(), encoder.encode(plaintext)),
  )
  const packed = new Uint8Array(iv.length + ciphertext.length)
  packed.set(iv)
  packed.set(ciphertext, iv.length)
  let binary = ''
  for (const byte of packed) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export async function unseal(sealed: string): Promise<string> {
  const packed = Uint8Array.from(atob(sealed), (c) => c.charCodeAt(0))
  const iv = packed.slice(0, 12)
  const ciphertext = packed.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await getKey(), ciphertext)
  return decoder.decode(plaintext)
}
