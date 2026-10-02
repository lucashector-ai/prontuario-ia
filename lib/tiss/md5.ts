/**
 * MD5 puro (RFC 1321) sobre bytes — roda no navegador e no servidor.
 * Usado no epílogo do XML TISS (o hash é calculado sobre os bytes ISO-8859-1).
 */

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0)

export function md5Bytes(bytes: Uint8Array): string {
  const len = bytes.length
  const totalLen = (((len + 8) >>> 6) + 1) << 6
  const buf = new Uint8Array(totalLen)
  buf.set(bytes)
  buf[len] = 0x80
  const bits = len * 8
  // comprimento em bits, little-endian, 64 bits
  for (let i = 0; i < 8; i++) buf[totalLen - 8 + i] = Math.floor(bits / 2 ** (8 * i)) & 0xff

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476
  const M = new Uint32Array(16)
  for (let off = 0; off < totalLen; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4
      M[i] = (buf[j] | (buf[j + 1] << 8) | (buf[j + 2] << 16) | (buf[j + 3] << 24)) >>> 0
    }
    let A = a0, B = b0, C = c0, D = d0
    for (let i = 0; i < 64; i++) {
      let F: number, g: number
      if (i < 16) { F = (B & C) | (~B & D); g = i }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16 }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16 }
      else { F = C ^ (B | ~D); g = (7 * i) % 16 }
      F = (F + A + K[i] + M[g]) >>> 0
      A = D; D = C; C = B
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0
  }
  return [a0, b0, c0, d0].map(w => {
    let h = ''
    for (let i = 0; i < 4; i++) h += ((w >>> (8 * i)) & 0xff).toString(16).padStart(2, '0')
    return h
  }).join('')
}

/** Texto → bytes ISO-8859-1 (o texto já deve estar restrito a Latin-1; ver `paraLatin1`). */
export function bytesLatin1(texto: string): Uint8Array {
  const out = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i)
    out[i] = c <= 0xff ? c : 0x3f // '?'
  }
  return out
}

export const md5Latin1 = (texto: string) => md5Bytes(bytesLatin1(texto))
