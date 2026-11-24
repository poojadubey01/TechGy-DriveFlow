export type Device = 'phone' | 'laptop' | 'tablet';

/** Rough device class from a browser's user agent (good enough for "opened on a phone"). */
export function deviceFromUserAgent(ua: string | undefined): Device {
  const s = (ua ?? '').toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook/.test(s) || (/android/.test(s) && !/mobile/.test(s))) return 'tablet';
  if (/mobi|iphone|ipod|android|phone/.test(s)) return 'phone';
  return 'laptop';
}
