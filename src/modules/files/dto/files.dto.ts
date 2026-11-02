import { IsIn, IsOptional } from 'class-validator';

import { FILE_VISIBILITIES, type FileVisibility } from '../../../infra/storage/file-storage';
import type { AllowedMimeType } from '../file-type';

/** The form fields sent with the file. */
export class UploadFileDto {
  /** `public` for product images, banners, brand logos and garage photos; `private` (the default) for the rest. */
  @IsOptional()
  @IsIn(FILE_VISIBILITIES)
  visibility: FileVisibility = 'private';
}

/** The `Attachment` shape in spareXAdmin/src/lib/types.ts, plus `visibility`. */
export class AttachmentView {
  id: string;
  name: string;
  /**
   * Public files: a stable URL that may be stored and cached. Private files: a signed link that works for
   * SIGNED_URL_TTL_SECONDS, so store the `id` and fetch a fresh link when showing it.
   */
  url: string;
  /** @example private */
  visibility: FileVisibility;
  /** @example image/jpeg */
  mimeType: AllowedMimeType;
  sizeBytes: number;
}
