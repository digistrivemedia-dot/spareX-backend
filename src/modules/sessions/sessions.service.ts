import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AppError } from '../../common/errors/app-error';
import type { Surface } from '../../common/http/surfaces';
import { AppConfig } from '../../config/app-config.service';
import { describeDevice } from './device';
import { DeviceSessionView } from './dto/device-session.view';
import { Session } from './sessions.schema';

const TOKEN_BYTES = 32;

/** "Last active" only needs minute precision, so a busy session isn't written on every request. */
const TOUCH_INTERVAL_MS = 60_000;

/** Where a sign-in came from, for the devices list. */
export type ClientInfo = { ip: string; userAgent?: string };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<Session>,
    private readonly config: AppConfig,
  ) {}

  private lifetimeMs(surface: Surface): number {
    const seconds = {
      admin: this.config.get('SESSION_TTL_ADMIN_SECONDS'),
      b2c: this.config.get('SESSION_TTL_B2C_SECONDS'),
      b2b: this.config.get('SESSION_TTL_B2B_SECONDS'),
    }[surface];
    return seconds * 1000;
  }

  /** Opens a session and returns the token. The token itself is never stored, only its hash. */
  async create(surface: Surface, userId: string, client: ClientInfo): Promise<string> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const device = describeDevice(client.userAgent);
    const now = new Date();
    await this.sessions.create({
      tokenHash: hashToken(token),
      surface,
      userId,
      deviceKind: device.kind,
      deviceName: device.name,
      ip: client.ip,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + this.lifetimeMs(surface)),
    });
    return token;
  }

  /**
   * The unexpired session for this token, or null. Expired sessions are also filtered here because the TTL
   * monitor only runs once a minute.
   */
  findActiveByToken(token: string): Promise<Session | null> {
    return this.sessions
      .findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } })
      .lean<Session>();
  }

  /** Records that the session was just used, at most once a minute. */
  async touch(session: Session): Promise<void> {
    const now = Date.now();
    if (now - session.lastUsedAt.getTime() < TOUCH_INTERVAL_MS) return;
    await this.sessions.updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date(now) } });
  }

  /** A user's signed-in devices on one surface: the current one first, then the most recently used. */
  async listDevices(
    surface: Surface,
    userId: string,
    currentSessionId: string,
  ): Promise<DeviceSessionView[]> {
    const sessions = await this.sessions
      .find({ surface, userId, expiresAt: { $gt: new Date() } })
      .sort({ lastUsedAt: -1 })
      .lean<Session[]>();
    return sessions
      .map((session) => DeviceSessionView.from(session, currentSessionId))
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  }

  /** Ends one of the user's own sessions. Someone else's session is "not found", never "forbidden". */
  async revoke(surface: Surface, userId: string, sessionId: string): Promise<void> {
    const { deletedCount } = await this.sessions.deleteOne({ _id: sessionId, surface, userId });
    if (deletedCount === 0) throw AppError.notFound('That device is not signed in.');
  }

  /** "Log out other devices": ends every session of the user except this one. */
  async revokeOthers(surface: Surface, userId: string, keepSessionId: string): Promise<void> {
    await this.sessions.deleteMany({ surface, userId, _id: { $ne: keepSessionId } });
  }

  /** Ends every session of the user, e.g. after a password reset. */
  async revokeAll(surface: Surface, userId: string): Promise<void> {
    await this.sessions.deleteMany({ surface, userId });
  }
}
