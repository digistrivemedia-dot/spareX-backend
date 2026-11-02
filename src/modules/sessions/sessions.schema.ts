import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { baseSchemaOptions, newId } from '../../common/database/base-schema';
import { SURFACES, type Surface } from '../../common/http/surfaces';

export const DEVICE_KINDS = ['phone', 'tablet', 'computer'] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

/** One signed-in device. Only the SHA-256 of the token is stored, so a database leak can't be replayed. */
@Schema({ ...baseSchemaOptions, collection: 'sessions' })
export class Session {
  @Prop({ type: String, default: () => newId('ses') })
  _id: string;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ type: String, enum: SURFACES, required: true })
  surface: Surface;

  /** An admin user, customer or business user id, depending on the surface. */
  @Prop({ required: true })
  userId: string;

  @Prop({ type: String, enum: DEVICE_KINDS, required: true })
  deviceKind: DeviceKind;

  /** "Chrome on Windows" */
  @Prop({ required: true })
  deviceName: string;

  @Prop({ required: true })
  ip: string;

  @Prop({ required: true })
  lastUsedAt: Date;

  /** MongoDB's TTL monitor deletes the session once this passes. */
  @Prop({ required: true, expires: 0 })
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ surface: 1, userId: 1, lastUsedAt: -1 });
