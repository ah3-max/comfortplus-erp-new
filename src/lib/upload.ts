/**
 * Centralized file upload validation utility.
 *
 * Validates file size, extension allowlist, and magic bytes (file signature)
 * to prevent extension spoofing (e.g. a .exe renamed to .jpg).
 */
import path from 'path'

// ── Magic-byte signatures ───────────────────────────────────────────────────
// Each entry maps a canonical MIME type to one or more byte signatures.
// `offset` = byte position in file where the pattern starts.
// `bytes`  = expected byte values at that position.
type Sig = { offset: number; bytes: number[] }

const MAGIC: Record<string, Sig[]> = {
  'image/jpeg':       [{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }],
  'image/png':        [{ offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  'image/gif':        [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }],
  // WebP = RIFF....WEBP
  'image/webp':       [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }],
  // HEIC/HEIF — ftyp box at offset 4 (brand bytes vary; just detect the box marker)
  'image/heic':       [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
  'image/heif':       [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
  // PDF
  'application/pdf':  [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
  // ZIP (covers .docx / .xlsx — Office Open XML)
  'application/zip':  [{ offset: 0, bytes: [0x50, 0x4B, 0x03, 0x04] }],
  // OLE2 compound (covers .doc / .xls)
  'application/ole':  [{ offset: 0, bytes: [0xD0, 0xCF, 0x11, 0xE0] }],
  // Audio: MP3 with ID3 tag
  'audio/id3':        [{ offset: 0, bytes: [0x49, 0x44, 0x33] }],
  // Audio: raw MP3 frame sync
  'audio/mpeg-sync':  [{ offset: 0, bytes: [0xFF, 0xFB] }],
  // WAV = RIFF....WAVE
  'audio/wav':        [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }],
  // WebM (also used for audio-only WebM)
  'audio/webm':       [{ offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] }],
  // M4A / MP4 — ftyp box at offset 4
  'audio/mp4':        [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
}

// Map file extension → accepted magic MIME keys (can be multiple, e.g. .doc accepts OLE)
const EXT_MAGIC: Record<string, string[]> = {
  '.jpg':  ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png':  ['image/png'],
  '.gif':  ['image/gif'],
  '.webp': ['image/webp'],
  '.heic': ['image/heic'],
  '.heif': ['image/heif'],
  '.pdf':  ['application/pdf'],
  '.docx': ['application/zip'],
  '.xlsx': ['application/zip'],
  '.doc':  ['application/ole'],
  '.xls':  ['application/ole'],
  '.mp3':  ['audio/id3', 'audio/mpeg-sync'],
  '.wav':  ['audio/wav'],
  '.webm': ['audio/webm'],
  '.m4a':  ['audio/mp4'],
}

// Preset extension lists by category
export type UploadCategory = 'image' | 'audio' | 'document' | 'complaint'

const CATEGORY_EXTS: Record<UploadCategory, string[]> = {
  image:     ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
  audio:     ['.mp3', '.wav', '.webm', '.m4a'],
  document:  ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
  complaint: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.pdf'],
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function matchesSig(buf: Buffer, sig: Sig): boolean {
  if (buf.length < sig.offset + sig.bytes.length) return false
  return sig.bytes.every((b, i) => buf[sig.offset + i] === b)
}

function detectMagicKeys(buf: Buffer): Set<string> {
  const found = new Set<string>()
  for (const [key, sigs] of Object.entries(MAGIC)) {
    if (sigs.some(s => matchesSig(buf, s))) found.add(key)
  }
  return found
}

// ── Public API ───────────────────────────────────────────────────────────────
export interface UploadError {
  code: 'TOO_LARGE' | 'BAD_EXTENSION' | 'MAGIC_MISMATCH' | 'NO_MAGIC'
  message: string
}

export interface ValidatedFile {
  buffer: Buffer
  ext: string         // e.g. '.jpg'
  safeName: string    // unique filename safe to write to disk
}

/**
 * Validate a File from FormData before writing to disk.
 *
 * @param file        - The File object from formData.get('file')
 * @param categories  - Which upload categories are allowed (extension sets)
 * @param maxBytes    - Maximum file size in bytes (default 10 MB)
 * @returns           - ValidatedFile on success, UploadError on failure
 */
export async function validateUpload(
  file: File,
  categories: UploadCategory[],
  maxBytes = 10 * 1024 * 1024,
): Promise<ValidatedFile | UploadError> {
  // 1. Size check
  if (file.size > maxBytes) {
    const limit = (maxBytes / 1024 / 1024).toFixed(0)
    const actual = (file.size / 1024 / 1024).toFixed(1)
    return { code: 'TOO_LARGE', message: `檔案過大，上限 ${limit}MB（目前 ${actual}MB）` }
  }

  // 2. Extension check
  const ext = path.extname(file.name).toLowerCase()
  const allowed = Array.from(new Set(categories.flatMap(c => CATEGORY_EXTS[c])))
  if (!ext || !allowed.includes(ext)) {
    return {
      code: 'BAD_EXTENSION',
      message: `不支援的檔案格式（${ext || '無副檔名'}）。支援：${allowed.join('、')}`,
    }
  }

  // 3. Read file bytes and check magic
  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = detectMagicKeys(buffer)
  const expectedKeys = EXT_MAGIC[ext]

  if (expectedKeys) {
    // HEIC/HEIF magic detection is unreliable across devices — skip hard failure
    const isHeic = ext === '.heic' || ext === '.heif'

    if (!isHeic && detected.size > 0) {
      // We detected some magic bytes — check for mismatch
      const matched = expectedKeys.some(k => detected.has(k))
      if (!matched) {
        // Special case: WebP files also have RIFF header — ensure WEBP marker at offset 8
        if (ext === '.webp') {
          const hasWebpMarker =
            buffer.length >= 12 &&
            buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
          if (!hasWebpMarker) {
            return { code: 'MAGIC_MISMATCH', message: '檔案內容與副檔名 .webp 不符' }
          }
        } else {
          return {
            code: 'MAGIC_MISMATCH',
            message: `檔案內容與副檔名（${ext}）不符，疑似偽造`,
          }
        }
      }
    } else if (!isHeic && ext !== '.gif' && ['image/jpeg', 'image/png'].includes(expectedKeys[0] ?? '')) {
      // For common image types — require magic bytes to be present
      return { code: 'NO_MAGIC', message: `無法識別 ${ext} 格式的檔案特徵碼` }
    }
  }

  // 4. Generate safe unique filename
  const { randomBytes } = await import('crypto')
  const safeName = `${Date.now()}_${randomBytes(8).toString('hex')}${ext}`

  return { buffer, ext, safeName }
}

/** Convenience: extract the error message from a validateUpload result */
export function isUploadError(result: ValidatedFile | UploadError): result is UploadError {
  return 'code' in result
}
