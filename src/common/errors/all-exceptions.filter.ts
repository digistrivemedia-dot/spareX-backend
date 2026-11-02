import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

import { AppError, ErrorCode, type FieldErrors } from './app-error';

export type ErrorBody = { message: string; code: ErrorCode; fieldErrors?: FieldErrors };

const DUPLICATE_KEY = 11000;

/** Codes for errors Nest or Express raise before our code runs (unknown route, body too large…). */
const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.ValidationFailed,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.Unauthenticated,
  [HttpStatus.FORBIDDEN]: ErrorCode.Forbidden,
  [HttpStatus.NOT_FOUND]: ErrorCode.NotFound,
  [HttpStatus.CONFLICT]: ErrorCode.Conflict,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PayloadTooLarge,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RateLimited,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.ServiceUnavailable,
};

const MESSAGE_BY_CODE: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.ValidationFailed]: 'The request is not valid.',
  [ErrorCode.NotFound]: 'We could not find that.',
  [ErrorCode.PayloadTooLarge]: 'The file or request is too large.',
  [ErrorCode.RateLimited]: 'Too many requests. Wait a minute and try again.',
  [ErrorCode.ServiceUnavailable]: 'The service is temporarily unavailable. Try again shortly.',
};

/** Every error leaves the API through here, as `{ message, code, fieldErrors? }`. Details stay in the logs. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.toResponse(exception);
    response.status(status).json(body);
  }

  private toResponse(exception: unknown): [number, ErrorBody] {
    if (exception instanceof AppError) {
      return [
        exception.status,
        { message: exception.message, code: exception.code, fieldErrors: exception.fieldErrors },
      ];
    }
    if (exception instanceof ThrottlerException) {
      return [HttpStatus.TOO_MANY_REQUESTS, this.bodyFor(ErrorCode.RateLimited)];
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = CODE_BY_STATUS[status];
      if (code) return [status, this.bodyFor(code)];
    }
    if (exception instanceof MongoServerError && exception.code === DUPLICATE_KEY) {
      return [HttpStatus.CONFLICT, { message: 'This already exists.', code: ErrorCode.Conflict }];
    }
    if (exception instanceof MongooseError.VersionError) {
      return [
        HttpStatus.CONFLICT,
        {
          message: 'This was changed by someone else. Reload and try again.',
          code: ErrorCode.Conflict,
        },
      ];
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return [
      HttpStatus.INTERNAL_SERVER_ERROR,
      { message: 'Something went wrong on our side. Try again.', code: ErrorCode.Internal },
    ];
  }

  private bodyFor(code: ErrorCode): ErrorBody {
    return { message: MESSAGE_BY_CODE[code] ?? 'The request could not be completed.', code };
  }
}
