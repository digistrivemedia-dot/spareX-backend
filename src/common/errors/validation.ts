import { ValidationPipe, type ValidationError } from '@nestjs/common';

import { AppError, type FieldErrors } from './app-error';

/** Flattens nested DTO errors into `{ "address.pin": ["…"] }`. */
function toFieldErrors(errors: ValidationError[], parent = ''): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) fieldErrors[path] = Object.values(error.constraints);
    Object.assign(fieldErrors, toFieldErrors(error.children ?? [], path));
  }
  return fieldErrors;
}

/** The global pipe: every body, query and param is checked against its DTO, and unknown fields are rejected. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => AppError.validation(toFieldErrors(errors)),
  });
}
