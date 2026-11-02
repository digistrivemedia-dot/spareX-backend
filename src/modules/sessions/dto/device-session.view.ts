import type { DeviceKind, Session } from '../sessions.schema';

/** The `DeviceSession` shape in spareXB2C/src/features/account/types.ts. */
export class DeviceSessionView {
  id: string;
  /** @example computer */
  kind: DeviceKind;
  /** @example Chrome on Windows */
  name: string;
  /** Approximate, from the network. Empty until a location lookup is chosen (B-08). */
  location: string;
  signedInAt: string;
  lastActiveAt: string;
  /** The device this request came from. */
  isCurrent: boolean;

  static from(session: Session, currentSessionId: string): DeviceSessionView {
    return {
      id: session._id,
      kind: session.deviceKind,
      name: session.deviceName,
      location: '',
      signedInAt: session.createdAt.toISOString(),
      lastActiveAt: session.lastUsedAt.toISOString(),
      isCurrent: session._id === currentSessionId,
    };
  }
}
