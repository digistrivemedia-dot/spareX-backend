import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Injectable } from '@nestjs/common';

import { AppConfig } from '../../config/app-config.service';
import { FileStorage, isValidObjectKey } from './file-storage';

/** Path the API serves local files under (outside /v1, like /health). */
export const LOCAL_FILES_PATH = 'files';

/**
 * Development and tests: files go to LOCAL_UPLOADS_DIR and the API serves them itself. Private links carry an
 * expiry and an HMAC of the key, so they work like S3's signed URLs.
 */
@Injectable()
export class LocalDiskStorage extends FileStorage {
  private readonly root: string;
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly signedUrlSeconds: number;

  constructor(config: AppConfig) {
    super();
    this.root = resolve(config.get('LOCAL_UPLOADS_DIR'));
    this.baseUrl = `${config.get('PUBLIC_BASE_URL').replace(/\/$/, '')}/${LOCAL_FILES_PATH}`;
    this.secret = config.get('FILE_URL_SECRET');
    this.signedUrlSeconds = config.get('SIGNED_URL_TTL_SECONDS');
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { flag: 'wx' });
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  signedUrl(key: string, downloadName: string): Promise<string> {
    const expires = String(Math.floor(Date.now() / 1000) + this.signedUrlSeconds);
    const query = new URLSearchParams({
      expires,
      name: downloadName,
      signature: this.sign(key, expires, downloadName),
    });
    return Promise.resolve(`${this.baseUrl}/${key}?${query.toString()}`);
  }

  /** True when a private link is genuine and not yet expired. */
  verifySignedLink(key: string, expires: string, downloadName: string, signature: string): boolean {
    if (!/^\d+$/.test(expires) || Number(expires) < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(key, expires, downloadName), 'hex');
    const given = Buffer.from(signature, 'hex');
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  /** The file's place on disk. Keys are checked first, so a crafted key can't reach outside the uploads folder. */
  pathOf(key: string): string {
    if (!isValidObjectKey(key)) throw new RangeError(`Invalid object key: ${key}`);
    return resolve(this.root, key);
  }

  private sign(key: string, expires: string, downloadName: string): string {
    return createHmac('sha256', this.secret)
      .update(`${key}\n${expires}\n${downloadName}`)
      .digest('hex');
  }
}
