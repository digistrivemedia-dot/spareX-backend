import { Body, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';

import {
  type Actor,
  CurrentActor,
  CurrentSessionId,
  Public,
} from '../../common/http/auth-decorators';
import { AuthRateLimit } from '../../common/http/rate-limit';
import { AdminController } from '../../common/http/surfaces';
import { AdminUserView } from '../admin-users/dto/admin-user.view';
import type { ClientInfo } from '../sessions/sessions.service';
import { AdminAccountService } from './admin-account.service';
import { AdminAuthService } from './admin-auth.service';
import { Client } from './client-info.decorator';
import {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  PasswordResetRequestView,
  RequestPasswordResetDto,
  SetTwoStepDto,
  SignInDto,
  SignInResultView,
  TwoStepChallengeView,
  UpdateAdminProfileDto,
  VerifyTwoStepDto,
} from './dto/admin-auth.dto';

/** Paths follow spareXAdmin/src/features/auth/api.ts: `auth/…` for signing in, `me/…` for the own account. */
@AdminController('', { tag: 'auth' })
export class AuthAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly account: AdminAccountService,
  ) {}

  /** Email and password. Answers with a session token, or a 2-step challenge to complete first. */
  @Public()
  @AuthRateLimit()
  @Post('auth/sign-in')
  @HttpCode(HttpStatus.OK)
  signIn(@Body() body: SignInDto, @Client() client: ClientInfo): Promise<SignInResultView> {
    return this.auth.signIn(body.email, body.password, client);
  }

  @Public()
  @Get('auth/two-step/:challengeId')
  getTwoStepChallenge(@Param('challengeId') challengeId: string): Promise<TwoStepChallengeView> {
    return this.auth.getTwoStepChallenge(challengeId);
  }

  @Public()
  @AuthRateLimit()
  @Post('auth/two-step/verify')
  @HttpCode(HttpStatus.OK)
  verifyTwoStep(
    @Body() body: VerifyTwoStepDto,
    @Client() client: ClientInfo,
  ): Promise<SignInResultView> {
    return this.auth.verifyTwoStep(body.challengeId, body.code, client);
  }

  @Get('auth/me')
  me(@CurrentActor() actor: Actor): Promise<AdminUserView> {
    return this.account.me(actor);
  }

  @Post('auth/sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  signOut(@CurrentActor() actor: Actor, @CurrentSessionId() sessionId: string): Promise<void> {
    return this.auth.signOut(actor, sessionId);
  }

  /** Always answers the same way, so it can't be used to find out which emails have accounts. */
  @Public()
  @AuthRateLimit()
  @Post('auth/password-reset')
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(@Body() body: RequestPasswordResetDto): Promise<PasswordResetRequestView> {
    return this.auth.requestPasswordReset(body.email);
  }

  @Public()
  @AuthRateLimit()
  @Post('auth/password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmPasswordReset(@Body() body: ConfirmPasswordResetDto): Promise<void> {
    return this.auth.confirmPasswordReset(body.token, body.password);
  }

  @Patch('me')
  updateProfile(
    @CurrentActor() actor: Actor,
    @Body() body: UpdateAdminProfileDto,
  ): Promise<AdminUserView> {
    return this.account.updateProfile(actor, body);
  }

  /** Signs out every other device. */
  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentActor() actor: Actor,
    @CurrentSessionId() sessionId: string,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    return this.account.changePassword(actor, sessionId, body.currentPassword, body.newPassword);
  }

  @Patch('me/two-step')
  setTwoStep(@CurrentActor() actor: Actor, @Body() body: SetTwoStepDto): Promise<AdminUserView> {
    return this.account.setTwoStep(actor, body.enabled);
  }
}
