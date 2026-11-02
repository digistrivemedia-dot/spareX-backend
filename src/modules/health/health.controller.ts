import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  type HealthCheckResult,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../../common/http/auth-decorators';

const CHECK_TIMEOUT_MS = 1500;

/** `GET /health` (outside /v1, for load balancers): 200 when MongoDB answers, 503 otherwise. */
@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongo: MongooseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.mongo.pingCheck('mongodb').withTimeout(CHECK_TIMEOUT_MS)]);
  }
}
