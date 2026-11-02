import { Delete, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';

import { type Actor, CurrentActor, CurrentSessionId } from '../../common/http/auth-decorators';
import { B2cController } from '../../common/http/surfaces';
import { DeviceSessionView } from './dto/device-session.view';
import { SessionsService } from './sessions.service';

@B2cController('me/sessions', { tag: 'account' })
export class SessionsB2cController {
  constructor(private readonly sessions: SessionsService) {}

  /** Devices the customer is logged in on, this one first. */
  @Get()
  list(
    @CurrentActor() actor: Actor,
    @CurrentSessionId() sessionId: string,
  ): Promise<DeviceSessionView[]> {
    return this.sessions.listDevices('b2c', actor.id, sessionId);
  }

  /** Logs out every device except this one. Declared before `:id` so "others" isn't read as an id. */
  @Delete('others')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeOthers(@CurrentActor() actor: Actor, @CurrentSessionId() sessionId: string): Promise<void> {
    return this.sessions.revokeOthers('b2c', actor.id, sessionId);
  }

  /** Logs out one device. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<void> {
    return this.sessions.revoke('b2c', actor.id, id);
  }
}
