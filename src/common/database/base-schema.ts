import { randomBytes } from 'node:crypto';

import type { SchemaOptions } from '@nestjs/mongoose';

/**
 * Ids are prefixed strings ("adm_…", "cus_…") rather than ObjectIds, so the seed can keep the ids the frontends'
 * demo data links to, and an id says what it points at in logs and the audit log.
 */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(10).toString('hex')}`;
}

type JsonRecord = Record<string, unknown>;

/** Records leave the API with `id`, never `_id` or `__v`. */
function toJsonTransform(_doc: unknown, ret: JsonRecord): JsonRecord {
  const { _id, __v, ...rest } = ret;
  return { id: _id, ...rest };
}

/** Every schema uses these options (§8.5 of CLAUDE.md). */
export const baseSchemaOptions = {
  strict: true,
  timestamps: true,
  toJSON: { transform: toJsonTransform },
} satisfies SchemaOptions;

/** For embedded sub-documents: same rules, but no timestamps of their own. */
export const subSchemaOptions = {
  strict: true,
  timestamps: false,
  toJSON: { transform: toJsonTransform },
} satisfies SchemaOptions;

/** Mongoose validator for money and quantities: whole numbers only. */
export const integerValidator = {
  validator: Number.isInteger,
  message: '{PATH} must be a whole number',
};
