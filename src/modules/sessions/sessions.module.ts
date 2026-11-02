import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SessionsB2cController } from './b2c.controller';
import { Session, SessionSchema } from './sessions.schema';
import { SessionsService } from './sessions.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }])],
  controllers: [SessionsB2cController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
