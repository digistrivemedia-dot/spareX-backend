import { describeDevice } from './device';

describe('describeDevice', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      { kind: 'computer', name: 'Chrome on Windows' },
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      { kind: 'phone', name: 'Safari on iPhone' },
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      { kind: 'tablet', name: 'Chrome on Android tablet' },
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
      { kind: 'phone', name: 'Chrome on Android' },
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
      { kind: 'computer', name: 'Edge on Windows' },
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0',
      { kind: 'computer', name: 'Firefox on Mac' },
    ],
  ])('names %s', (userAgent, expected) => {
    expect(describeDevice(userAgent)).toEqual(expected);
  });

  it('falls back to an unknown computer when there is no User-Agent', () => {
    expect(describeDevice(undefined)).toEqual({ kind: 'computer', name: 'Unknown device' });
  });
});
