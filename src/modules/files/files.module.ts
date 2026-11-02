import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';

import { AppConfig } from '../../config/app-config.service';
import { FilesAdminController } from './admin.controller';
import { StoredFile, StoredFileSchema } from './files.schema';
import { FilesService } from './files.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: StoredFile.name, schema: StoredFileSchema }]),
    // Files are held in memory (at most UPLOAD_MAX_BYTES) so their bytes can be checked before storing.
    MulterModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        limits: { fileSize: config.get('UPLOAD_MAX_BYTES'), files: 1 },
      }),
    }),
  ],
  controllers: [FilesAdminController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
