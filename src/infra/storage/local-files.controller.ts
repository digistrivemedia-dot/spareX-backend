import { stat } from 'node:fs/promises';

import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { AppError, ErrorCode } from '../../common/errors/app-error';
import { Public } from '../../common/http/auth-decorators';
import { FileStorage, isValidObjectKey, PUBLIC_CACHE_CONTROL } from './file-storage';
import { LOCAL_FILES_PATH, LocalDiskStorage } from './local-disk.storage';

/**
 * Serves files from local disk, standing in for S3 in development and tests. Public files need nothing; private
 * files need a signed link from the API. With S3 configured this answers 404 for everything.
 */
@ApiExcludeController()
@Public()
@Controller(LOCAL_FILES_PATH)
export class LocalFilesController {
  constructor(private readonly storage: FileStorage) {}

  @Get(':visibility/:year/:month/:name')
  async serve(
    @Param('visibility') visibility: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @Param('name') name: string,
    @Query() query: Record<string, string | undefined>,
    @Res() response: Response,
  ): Promise<void> {
    const storage = this.storage;
    const key = `${visibility}/${year}/${month}/${name}`;
    if (!(storage instanceof LocalDiskStorage) || !isValidObjectKey(key)) throw AppError.notFound();
    const path = storage.pathOf(key);
    if (!(await stat(path).catch(() => null))?.isFile()) throw AppError.notFound();

    if (visibility === 'public') {
      response.sendFile(path, { headers: { 'Cache-Control': PUBLIC_CACHE_CONTROL } });
      return;
    }
    const { expires = '', name: downloadName = '', signature = '' } = query;
    if (
      visibility !== 'private' ||
      !storage.verifySignedLink(key, expires, downloadName, signature)
    ) {
      throw new AppError(
        ErrorCode.LinkExpired,
        'This link has expired. Open the file again from the app.',
        HttpStatus.FORBIDDEN,
      );
    }
    response.sendFile(path, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      },
    });
  }
}
