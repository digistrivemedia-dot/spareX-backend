import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { S3Settings } from '../../config/app-config.service';
import { FileStorage, PUBLIC_CACHE_CONTROL, visibilityOf } from './file-storage';

/**
 * Staging and production. Public objects (keys under `public/`) are read through S3_PUBLIC_BASE_URL, which the
 * bucket policy or CDN opens for that prefix only; private objects are read through presigned URLs.
 */
export class S3Storage extends FileStorage {
  private readonly client: S3Client;

  constructor(
    private readonly settings: S3Settings,
    private readonly signedUrlSeconds: number,
  ) {
    super();
    this.client = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region,
      forcePathStyle: settings.forcePathStyle,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: visibilityOf(key) === 'public' ? PUBLIC_CACHE_CONTROL : 'private, no-store',
      }),
    );
  }

  publicUrl(key: string): string {
    return `${this.settings.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }

  signedUrl(key: string, downloadName: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.settings.bucket,
      Key: key,
      ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
    });
    return getSignedUrl(this.client, command, { expiresIn: this.signedUrlSeconds });
  }
}
