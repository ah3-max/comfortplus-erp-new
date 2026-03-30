/**
 * 敏感欄位加解密工具（AES-256-GCM）
 *
 * 設計鏡像玉米筍 ERP 的 Fernet 加密模式：
 *   - 寫入 DB 前加密，讀取後解密
 *   - ENCRYPTION_KEY 未設定時以明文儲存（開發環境相容）
 *   - 舊有明文資料解密失敗時直接回傳原文（不拋錯）
 *
 * 設定：
 *   .env 中加入 ENCRYPTION_KEY（64 字元 hex = 32 bytes）
 *   產生方式: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12       // GCM recommended IV length
const TAG_LENGTH = 16      // Auth tag length
const ENCODING = 'base64'  // Stored format in DB

let _key: Buffer | null = null
let _initialized = false

function getKey(): Buffer | null {
  if (_initialized) return _key
  _initialized = true

  const envKey = process.env.ENCRYPTION_KEY
  if (!envKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[SECURITY] ENCRYPTION_KEY not set — sensitive fields stored in plaintext')
    }
    return null
  }

  if (envKey.length !== 64) {
    console.warn('[SECURITY] ENCRYPTION_KEY must be 64 hex chars (32 bytes). Encryption disabled.')
    return null
  }

  _key = Buffer.from(envKey, 'hex')
  return _key
}

/**
 * Encrypt a plaintext string. Returns base64-encoded `iv:tag:ciphertext`.
 * If ENCRYPTION_KEY is not set, returns plaintext unchanged.
 */
export function encrypt(plaintext: string | null): string | null {
  if (plaintext === null || plaintext === undefined) return null
  const key = getKey()
  if (!key) return plaintext

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString(ENCODING)}:${tag.toString(ENCODING)}:${encrypted.toString(ENCODING)}`
}

/**
 * Decrypt a ciphertext string. Returns plaintext.
 * If decryption fails (legacy plaintext data), returns the original string.
 * If ENCRYPTION_KEY is not set, returns ciphertext unchanged.
 */
export function decrypt(ciphertext: string | null): string | null {
  if (ciphertext === null || ciphertext === undefined) return null
  const key = getKey()
  if (!key) return ciphertext

  try {
    const parts = ciphertext.split(':')
    if (parts.length !== 3) return ciphertext // Legacy plaintext

    const [ivB64, tagB64, dataB64] = parts
    const iv = Buffer.from(ivB64, ENCODING)
    const tag = Buffer.from(tagB64, ENCODING)
    const encrypted = Buffer.from(dataB64, ENCODING)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    // Decryption failed — likely legacy plaintext data, return as-is
    return ciphertext
  }
}

/**
 * Check if a value looks like it's already encrypted (iv:tag:data format).
 */
export function isEncrypted(value: string | null): boolean {
  if (!value) return false
  const parts = value.split(':')
  return parts.length === 3 && parts.every(p => p.length > 0)
}
