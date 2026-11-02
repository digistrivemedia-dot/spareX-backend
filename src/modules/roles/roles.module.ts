import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Role, RoleSchema } from './roles.schema';
import { RolesService } from './roles.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Role.name, schema: RoleSchema }])],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
