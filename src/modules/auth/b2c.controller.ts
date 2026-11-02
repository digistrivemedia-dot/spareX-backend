import { Body, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import {
  type Actor,
  CurrentActor,
  CurrentSessionId,
  Public,
} from '../../common/http/auth-decorators';
import { AuthRateLimit } from '../../common/http/rate-limit';
import { B2cController } from '../../common/http/surfaces';
import type { ClientInfo } from '../sessions/sessions.service';
import { B2cAuthService } from './b2c-auth.service';
import { Client } from './client-info.decorator';
import {
  B2cSessionView,
  OtpRequestView,
  OtpVerificationView,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/b2c-auth.dto';

/** Paths follow spareXB2C/src/features/auth/api.ts and session.ts. */
@B2cController('auth')
export class AuthB2cController {
  constructor(private readonly auth: B2cAuthService) {}

  /** Sends a one-time code by SMS to this 10-digit mobile number. */
  @Public()
  @AuthRateLimit()
  @Post('otp')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() body: RequestOtpDto): Promise<OtpRequestView> {
    return this.auth.requestOtp(body.mobile);
  }

  /** Checks the code. A new number also needs a name, which creates the account. */
  @Public()
  @AuthRateLimit()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(
    @Body() body: VerifyOtpDto,
    @Client() client: ClientInfo,
  ): Promise<OtpVerificationView> {
    return this.auth.verifyOtp(body.mobile, body.otp, body.name, client);
  }

  @Get('session')
  session(@CurrentActor() actor: Actor): Promise<B2cSessionView> {
    return this.auth.session(actor);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentActor() actor: Actor, @CurrentSessionId() sessionId: string): Promise<void> {
    return this.auth.logout(actor, sessionId);
  }
}
