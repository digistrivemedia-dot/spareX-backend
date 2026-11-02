import { applyDecorators } from '@nestjs/common';
import argon2 from 'argon2';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Same rule as the admin panel (spareXAdmin/src/lib/validation.ts). */
export const PASSWORD_MIN_LENGTH = 8;
// argon2 hashes anything, but a cap stops a megabyte "password" from being used to burn CPU.
const PASSWORD_MAX_LENGTH = 128;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real check when the email is unknown, so response times don't reveal which emails
 * have accounts.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword('not-a-real-password-0');
  await argon2.verify(await dummyHash, password);
  return false;
}

/** A new password: at least 8 characters with a letter and a number. */
export const NewPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH, { message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` }),
    MaxLength(PASSWORD_MAX_LENGTH, { message: `Use at most ${PASSWORD_MAX_LENGTH} characters.` }),
    Matches(/[A-Za-z]/, { message: 'Include at least one letter.' }),
    Matches(/\d/, { message: 'Include at least one number.' }),
  );
