import { randomBytes } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AppError, ErrorCode } from '../../common/errors/app-error';
import type { ActorRef } from '../../common/http/auth-decorators';
import { FileStorage, type FileVisibility } from '../../infra/storage/file-storage';
import { AttachmentView } from './dto/files.dto';
import { detectFileType, EXTENSION_BY_TYPE } from './file-type';
import { StoredFile } from './files.schema';

const OBJECT_KEY_BYTES = 16;
const MAX_NAME_LENGTH = 200;
// eslint-disable-next-line no-control-regex -- matching control characters is the point.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

/** Keeps the uploader's name readable for display, without paths or control characters. */
function cleanName(originalName: string, extension: string): string {
  const base = originalName.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(CONTROL_CHARACTERS, '').trim().slice(0, MAX_NAME_LENGTH);
  return cleaned || `file.${extension}`;
}

@Injectable()
export class FilesService {
  constructor(
    @InjectModel(StoredFile.name) private readonly files: Model<StoredFile>,
    private readonly storage: FileStorage,
  ) {}

  /** Stores an upload under a random key, after checking its real type from its bytes. */
  async upload(
    actor: ActorRef,
    file: Express.Multer.File | undefined,
    visibility: FileVisibility,
  ): Promise<AttachmentView> {
    if (!file) {
      throw new AppError(
        ErrorCode.FileRequired,
        'Choose a file to upload.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const mimeType = detectFileType(file.buffer);
    if (!mimeType) {
      throw new AppError(
        ErrorCode.FileTypeNotAllowed,
        'Upload a JPEG, PNG or WebP image, or a PDF.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const extension = EXTENSION_BY_TYPE[mimeType];
    const now = new Date();
    const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const objectKey = `${visibility}/${month}/${randomBytes(OBJECT_KEY_BYTES).toString('hex')}.${extension}`;

    await this.storage.put(objectKey, file.buffer, mimeType);
    const stored = await this.files.create({
      objectKey,
      visibility,
      name: cleanName(file.originalname, extension),
      mimeType,
      sizeBytes: file.size,
      uploadedBy: { type: actor.type, id: actor.id, name: actor.name },
    });
    return this.toView(stored);
  }

  /** The file with its link: the stable URL of a public file, or a fresh signed link to a private one. */
  async get(id: string): Promise<AttachmentView> {
    const file = await this.files.findById(id).lean<StoredFile>();
    if (!file) throw AppError.notFound('We could not find that file.');
    return this.toView(file);
  }

  private async toView(file: StoredFile): Promise<AttachmentView> {
    return {
      id: file._id,
      name: file.name,
      visibility: file.visibility,
      url:
        file.visibility === 'public'
          ? this.storage.publicUrl(file.objectKey)
          : await this.storage.signedUrl(file.objectKey, file.name),
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    };
  }
}
