import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/** Only the console senders exist until B-02 (SMS) and B-03 (email) are answered. */
export const SMS_PROVIDERS = ['console'] as const;
export const EMAIL_PROVIDERS = ['console'] as const;

const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' ? true : value === false || value === 'false' ? false : value;

/** Every environment variable the app reads. The app refuses to start if any is missing or invalid. */
export class Env {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL: string;

  @IsString()
  @IsNotEmpty()
  TRUST_PROXY: string;

  @IsString()
  @IsNotEmpty()
  MONGO_URI: string;

  @Transform(toBoolean)
  @IsBoolean()
  MONGO_AUTO_INDEX: boolean;

  /** The API's own public address, for links to files on local disk. */
  @IsUrl({ require_tld: false })
  PUBLIC_BASE_URL: string;

  /** Where the local-disk storage keeps uploads (development and tests). Git-ignored. */
  @IsString()
  @IsNotEmpty()
  LOCAL_UPLOADS_DIR: string;

  /** Signs the short-lived links to private files on local disk. At least 32 characters. */
  @IsString()
  @MinLength(32)
  FILE_URL_SECRET: string;

  // S3 is used only when its bucket and keys are all set; otherwise uploads go to local disk.
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl({ require_tld: false })
  S3_ENDPOINT?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  S3_REGION?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  S3_BUCKET?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  S3_ACCESS_KEY_ID?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  S3_SECRET_ACCESS_KEY?: string;

  @Transform(toBoolean)
  @IsBoolean()
  S3_FORCE_PATH_STYLE: boolean;

  /** Where public objects are read from (a CDN or the bucket's public address), e.g. https://cdn.example.com. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl({ require_tld: false })
  S3_PUBLIC_BASE_URL?: string;

  @IsInt()
  @Min(1)
  UPLOAD_MAX_BYTES: number;

  @IsInt()
  @Min(1)
  SIGNED_URL_TTL_SECONDS: number;

  @IsIn(SMS_PROVIDERS)
  SMS_PROVIDER: (typeof SMS_PROVIDERS)[number];

  @IsIn(EMAIL_PROVIDERS)
  EMAIL_PROVIDER: (typeof EMAIL_PROVIDERS)[number];

  @IsEmail()
  EMAIL_FROM: string;

  @IsUrl({ require_tld: false })
  ADMIN_APP_URL: string;

  @IsInt()
  @Min(60)
  SESSION_TTL_ADMIN_SECONDS: number;

  @IsInt()
  @Min(60)
  SESSION_TTL_B2C_SECONDS: number;

  @IsInt()
  @Min(60)
  SESSION_TTL_B2B_SECONDS: number;

  @IsString()
  @MinLength(32)
  OTP_SECRET: string;

  @IsInt()
  @Min(4)
  @Max(10)
  OTP_LENGTH: number;

  @IsInt()
  @Min(1)
  OTP_TTL_SECONDS: number;

  /** 0 turns the gap off (used by tests of the hourly limit). */
  @IsInt()
  @Min(0)
  OTP_RESEND_SECONDS: number;

  @IsInt()
  @Min(1)
  OTP_MAX_SENDS_PER_HOUR: number;

  @IsInt()
  @Min(1)
  OTP_MAX_ATTEMPTS: number;

  @IsInt()
  @Min(1)
  SIGN_IN_MAX_FAILURES: number;

  @IsInt()
  @Min(1)
  SIGN_IN_LOCK_MINUTES: number;

  @IsInt()
  @Min(1)
  PASSWORD_RESET_TTL_MINUTES: number;

  @IsInt()
  @Min(1)
  RATE_LIMIT_PER_MINUTE: number;

  @IsInt()
  @Min(1)
  RATE_LIMIT_AUTH_PER_MINUTE: number;

  @IsInt()
  @Min(1)
  RATE_LIMIT_AUTH_PER_IDENTITY_PER_HOUR: number;
}

/** Used by ConfigModule: turns raw strings into a typed `Env`, or throws with every problem listed. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { enableImplicitConversion: true });
  const problems = validateSync(env, { whitelist: false }).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
  const s3Keys = [env.S3_BUCKET, env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY];
  const s3Configured = s3Keys.every(Boolean);
  if (s3Keys.some(Boolean) && !s3Configured) {
    problems.push('S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set together');
  }
  if (s3Configured && (!env.S3_REGION || !env.S3_PUBLIC_BASE_URL)) {
    problems.push('S3_REGION and S3_PUBLIC_BASE_URL are required when S3 is configured');
  }
  if (env.NODE_ENV === NodeEnv.Production) {
    if (env.SMS_PROVIDER === 'console')
      problems.push('SMS_PROVIDER=console is not allowed in production');
    if (env.EMAIL_PROVIDER === 'console')
      problems.push('EMAIL_PROVIDER=console is not allowed in production');
    if (!s3Configured) problems.push('S3 must be configured in production (no local disk)');
  }
  if (problems.length > 0) {
    throw new Error(`Invalid environment:\n- ${problems.join('\n- ')}`);
  }
  return env;
}
