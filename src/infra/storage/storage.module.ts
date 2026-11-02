import { Global, Module } from '@nestjs/common';

import { AppConfig } from '../../config/app-config.service';
import { FileStorage } from './file-storage';
import { LocalDiskStorage } from './local-disk.storage';
import { LocalFilesController } from './local-files.controller';
import { S3Storage } from './s3.storage';

/** S3 when its keys are configured, otherwise local disk; no other code knows which. */
@Global()
@Module({
  controllers: [LocalFilesController],
  providers: [
    {
      provide: FileStorage,
      inject: [AppConfig],
      useFactory: (config: AppConfig): FileStorage => {
        const s3 = config.s3;
        return s3
          ? new S3Storage(s3, config.get('SIGNED_URL_TTL_SECONDS'))
          : new LocalDiskStorage(config);
      },
    },
  ],
  exports: [FileStorage],
})
export class StorageModule {}
