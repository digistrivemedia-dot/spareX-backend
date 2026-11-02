import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { baseSchemaOptions, newId, subSchemaOptions } from '../../common/database/base-schema';

/** Every kind of record whose changes are audited (spareXAdmin/src/features/audit/types.ts). */
export const AUDIT_ENTITIES = [
  'product',
  'price',
  'fitment',
  'stock',
  'order',
  'return',
  'payment',
  'credit',
  'credit_note',
  'quotation',
  'business',
  'application',
  'garage',
  'booking',
  'customer',
  'vehicle',
  'master',
  'content',
  'coupon',
  'enquiry',
  'review',
  'admin_user',
  'settings',
  'report',
] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'status_change',
  'approve',
  'reject',
  'export',
  'import',
  'sign_in',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ACTOR_TYPES = ['admin', 'customer', 'business', 'garage', 'system'] as const;

@Schema({ ...subSchemaOptions, _id: false })
export class AuditActor {
  @Prop({ type: String, enum: ACTOR_TYPES, required: true })
  type: (typeof ACTOR_TYPES)[number];

  @Prop({ required: true })
  id: string;

  /** Frozen at the time of the action, so the log still reads right after a rename. */
  @Prop({ required: true })
  name: string;
}

@Schema({ ...subSchemaOptions, _id: false })
export class AuditChange {
  @Prop({ required: true })
  field: string;

  @Prop({ type: String, default: null })
  before: string | null;

  @Prop({ type: String, default: null })
  after: string | null;
}

/** One entry in the audit log. Append-only: entries are never edited or deleted. */
@Schema({ ...baseSchemaOptions, collection: 'auditEntries' })
export class AuditEntry {
  @Prop({ type: String, default: () => newId('aud') })
  _id: string;

  @Prop({ required: true, default: () => new Date() })
  at: Date;

  @Prop({ type: SchemaFactory.createForClass(AuditActor), required: true })
  actor: AuditActor;

  @Prop({ type: String, enum: AUDIT_ACTIONS, required: true })
  action: AuditAction;

  @Prop({ type: String, enum: AUDIT_ENTITIES, required: true })
  entity: AuditEntity;

  /** Empty for actions that are not about one record, such as an export. */
  @Prop({ type: String, default: '' })
  entityId: string;

  @Prop({ required: true })
  entityLabel: string;

  @Prop({ required: true })
  summary: string;

  @Prop({ type: [SchemaFactory.createForClass(AuditChange)], default: [] })
  changes: AuditChange[];
}

export const AuditEntrySchema = SchemaFactory.createForClass(AuditEntry);
// One index per filter and sort the admin audit list offers, each ending in `at` for the default sort.
AuditEntrySchema.index({ at: -1 });
AuditEntrySchema.index({ entity: 1, at: -1 });
AuditEntrySchema.index({ action: 1, at: -1 });
AuditEntrySchema.index({ 'actor.id': 1, at: -1 });
AuditEntrySchema.index({ 'actor.name': 1, at: -1 });
AuditEntrySchema.index({ entityId: 1, at: -1 });
