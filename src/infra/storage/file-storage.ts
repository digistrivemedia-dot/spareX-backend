/**
 * `public` files (product images, banners, brand logos, garage photos) have a stable URL that browsers and CDNs
 * may cache. `private` files (GST and KYC documents, invoices, everything else) are only reachable through
 * short-lived signed links (B-09).
 */
export const FILE_VISIBILITIES = ['public', 'private'] as const;
export type FileVisibility = (typeof FILE_VISIBILITIES)[number];

/** Object keys start with the visibility, so a key alone says how its file may be served. */
const OBJECT_KEY = /^(public|private)(\/[A-Za-z0-9_-]+)+\.[a-z0-9]+$/;

export function isValidObjectKey(key: string): boolean {
  return OBJECT_KEY.test(key);
}

export function visibilityOf(key: string): FileVisibility {
  return key.startsWith('public/') ? 'public' : 'private';
}

/** Long cache for public files: their keys are random and never reused, so the bytes behind a URL never change. */
export const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Where uploaded bytes live: local disk in development and tests, S3 in staging and production. */
export abstract class FileStorage {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** The stable URL of a public file. */
  abstract publicUrl(key: string): string;
  /** A link to a private file that works for SIGNED_URL_TTL_SECONDS. */
  abstract signedUrl(key: string, downloadName: string): Promise<string>;
}
