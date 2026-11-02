import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { AppConfig } from './app-config.service';
import { validateEnv } from './env';

@Global()
@Module({
  imports: [NestConfigModule.forRoot({ validate: validateEnv, cache: true })],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class ConfigModule {}
