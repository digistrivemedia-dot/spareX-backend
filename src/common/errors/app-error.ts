import { HttpStatus } from '@nestjs/common';

/** Stable codes the frontends branch on. Add new ones here; never rename one that has shipped. */
export const ErrorCode = {
  ValidationFailed: 'VALIDATION_FAILED',
  Unauthenticated: 'UNAUTHENTICATED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  PayloadTooLarge: 'PAYLOAD_TOO_LARGE',
  RateLimited: 'RATE_LIMITED',
  Internal: 'INTERNAL',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  AccountLocked: 'ACCOUNT_LOCKED',
  AccountInactive: 'ACCOUNT_INACTIVE',
  TwoStepRequired: 'TWO_STEP_REQUIRED',
  OtpInvalid: 'OTP_INVALID',
  OtpExpired: 'OTP_EXPIRED',
  OtpAttemptsExceeded: 'OTP_ATTEMPTS_EXCEEDED',
  OtpResendTooSoon: 'OTP_RESEND_TOO_SOON',
  OtpSendLimit: 'OTP_SEND_LIMIT',
  NameRequired: 'NAME_REQUIRED',
  ResetTokenInvalid: 'RESET_TOKEN_INVALID',
  AddressLimitReached: 'ADDRESS_LIMIT_REACHED',
  FileTypeNotAllowed: 'FILE_TYPE_NOT_ALLOWED',
  FileRequired: 'FILE_REQUIRED',
  LinkExpired: 'LINK_EXPIRED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type FieldErrors = Record<string, string[]>;

/** The one error type for every rule broken anywhere in the app. The global filter turns it into the response. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(message = 'We could not find that.'): AppError {
    return new AppError(ErrorCode.NotFound, message, HttpStatus.NOT_FOUND);
  }

  static unauthenticated(message = 'Your session has ended. Sign in again.'): AppError {
    return new AppError(ErrorCode.Unauthenticated, message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(message = "You don't have permission to do this."): AppError {
    return new AppError(ErrorCode.Forbidden, message, HttpStatus.FORBIDDEN);
  }

  static validation(fieldErrors: FieldErrors, message = 'Check the highlighted fields.'): AppError {
    return new AppError(ErrorCode.ValidationFailed, message, HttpStatus.BAD_REQUEST, fieldErrors);
  }
}
