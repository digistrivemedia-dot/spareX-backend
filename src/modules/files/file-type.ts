/** The only file types anyone may upload (B-07). */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const EXTENSION_BY_TYPE: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function startsWith(bytes: Buffer, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0));

/**
 * The file's real type from its first bytes. The type the client claims is ignored: a renamed .exe must not be
 * stored as an image.
 */
export function detectFileType(bytes: Buffer): AllowedMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  if (startsWith(bytes, ascii('%PDF-'))) return 'application/pdf';
  return null;
}
