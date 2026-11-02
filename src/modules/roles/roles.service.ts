import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { Role } from './roles.schema';

@Injectable()
export class RolesService {
  constructor(@InjectModel(Role.name) private readonly roles: Model<Role>) {}

  /** The role, or null when no role has this id. */
  findById(id: string): Promise<Role | null> {
    return this.roles.findById(id).lean<Role>();
  }
}
