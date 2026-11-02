import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type Env, NodeEnv } from './env';

export type S3Settings = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
};

/** Typed, read-only access to the validated environment. Inject this instead of `ConfigService`. */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === NodeEnv.Production;
  }

  /** SMS codes may be echoed back in responses only when no SMS is really sent (local demo and tests). */
  get exposesDemoCodes(): boolean {
    return !this.isProduction && this.get('SMS_PROVIDER') === 'console';
  }

  /** Same rule for password reset tokens, which are otherwise only emailed. */
  get exposesDemoResetTokens(): boolean {
    return !this.isProduction && this.get('EMAIL_PROVIDER') === 'console';
  }

  /** The S3 settings when its bucket and keys are configured, otherwise null (uploads go to local disk). */
  get s3(): S3Settings | null {
    const bucket = this.get('S3_BUCKET');
    const accessKeyId = this.get('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.get('S3_SECRET_ACCESS_KEY');
    const region = this.get('S3_REGION');
    const publicBaseUrl = this.get('S3_PUBLIC_BASE_URL');
    // validateEnv guarantees region and public URL whenever the bucket and keys are set.
    if (!bucket || !accessKeyId || !secretAccessKey || !region || !publicBaseUrl) return null;
    return {
      endpoint: this.get('S3_ENDPOINT'),
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      forcePathStyle: this.get('S3_FORCE_PATH_STYLE'),
      publicBaseUrl,
    };
  }
}
