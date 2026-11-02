import { Body, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

import { type Actor, CurrentActor } from '../../common/http/auth-decorators';
import { AdminController } from '../../common/http/surfaces';
import { AttachmentView, UploadFileDto } from './dto/files.dto';
import { FilesService } from './files.service';

/** `POST /uploads` is the path spareXAdmin/src/features/uploads/api.ts already calls. */
@AdminController('', { tag: 'files' })
export class FilesAdminController {
  constructor(private readonly files: FilesService) {}

  /** Uploads one image (JPEG, PNG, WebP) or PDF as multipart field `file`, with an optional `visibility`. */
  @Post('uploads')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        visibility: { type: 'string', enum: ['public', 'private'], default: 'private' },
      },
    },
  })
  upload(
    @CurrentActor() actor: Actor,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadFileDto,
  ): Promise<AttachmentView> {
    return this.files.upload(actor, file, body.visibility);
  }

  /** The file with its link: stable for a public file, freshly signed for a private one. */
  @Get('files/:id')
  get(@Param('id') id: string): Promise<AttachmentView> {
    return this.files.get(id);
  }
}
