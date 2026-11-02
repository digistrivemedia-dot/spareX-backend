import type { DeviceKind } from './sessions.schema';

export type Device = { kind: DeviceKind; name: string };

// Order matters: Edge and Opera also say "Chrome", and Chrome also says "Safari".
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

function browserName(userAgent: string): string | null {
  return BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

function platform(userAgent: string): Device | null {
  if (/iPad/.test(userAgent)) return { kind: 'tablet', name: 'iPad' };
  if (/iPhone|iPod/.test(userAgent)) return { kind: 'phone', name: 'iPhone' };
  // Android phones say "Mobile"; Android tablets don't.
  if (/Android/.test(userAgent)) {
    return /Mobile/.test(userAgent)
      ? { kind: 'phone', name: 'Android' }
      : { kind: 'tablet', name: 'Android tablet' };
  }
  if (/Windows/.test(userAgent)) return { kind: 'computer', name: 'Windows' };
  if (/Macintosh|Mac OS X/.test(userAgent)) return { kind: 'computer', name: 'Mac' };
  if (/CrOS/.test(userAgent)) return { kind: 'computer', name: 'Chromebook' };
  if (/Linux/.test(userAgent)) return { kind: 'computer', name: 'Linux' };
  return null;
}

/** "Chrome on Windows", "Safari on iPhone"… from a browser's User-Agent header, for the devices list. */
export function describeDevice(userAgent: string | undefined): Device {
  const agent = userAgent ?? '';
  const browser = browserName(agent);
  const device = platform(agent);
  if (!device) return { kind: 'computer', name: browser ?? 'Unknown device' };
  return { kind: device.kind, name: browser ? `${browser} on ${device.name}` : device.name };
}
