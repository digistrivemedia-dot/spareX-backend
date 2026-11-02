import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import {
  baseSchemaOptions,
  integerValidator,
  newId,
  subSchemaOptions,
} from '../../common/database/base-schema';
import type { ActorRef } from '../../common/http/auth-decorators';
import { FILE_VISIBILITIES, type FileVisibility } from '../../infra/storage/file-storage';
import { ALLOWED_MIME_TYPES, type AllowedMimeType } from './file-type';

@Schema({ ...subSchemaOptions, _id: false })
export class Uploader {
  @Prop({ type: String, required: true })
  type: ActorRef['type'];

  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;
}

/** An uploaded file. The bytes are in object storage under a random key; this is what points at them. */
@Schema({ ...baseSchemaOptions, collection: 'files' })
export class StoredFile {
  @Prop({ type: String, default: () => newId('fil') })
  _id: string;

  /** Random, never derived from the uploader's file name. */
  @Prop({ required: true, unique: true })
  objectKey: string;

  /** Public files get a stable, cacheable URL; private ones only short-lived signed links (B-09). */
  @Prop({ type: String, enum: FILE_VISIBILITIES, required: true })
  visibility: FileVisibility;

  /** The uploader's file name, cleaned, for display and downloads only. */
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: ALLOWED_MIME_TYPES, required: true })
  mimeType: AllowedMimeType;

  @Prop({ required: true, min: 0, validate: integerValidator })
  sizeBytes: number;

  @Prop({ type: SchemaFactory.createForClass(Uploader), required: true })
  uploadedBy: Uploader;

  createdAt: Date;
  updatedAt: Date;
}

export const StoredFileSchema = SchemaFactory.createForClass(StoredFile);
