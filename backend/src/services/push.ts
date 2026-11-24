import { eq, inArray } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { pushTokens } from '../db/schema.js';

export type PushMessage = { to: string; title: string; body: string; data?: Record<string, unknown> };

/** Result per message: ok, or the device is gone (uninstalled / token revoked). */
export type PushResult = { to: string; ok: boolean; deviceGone?: boolean };

export interface PushSender {
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

/** Expo push tokens look like ExponentPushToken[xxxx] (or ExpoPushToken[xxxx]). */
export function isExpoPushToken(token: string) {
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/.test(token);
}

type ExpoTicket = { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } };

/**
 * Sends through Expo's push service (https://docs.expo.dev/push-notifications/sending-notifications/),
 * which delivers to Apple and Google. No key is needed; an Expo access token is optional.
 */
export class ExpoPush implements PushSender {
  constructor(private readonly accessToken?: string) {}

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(chunk.map((m) => ({ ...m, sound: 'default', priority: 'high', channelId: 'default' }))),
      });
      if (!res.ok) throw new Error(`Expo push error ${res.status}`);
      const { data } = (await res.json()) as { data: ExpoTicket[] };
      chunk.forEach((m, j) => {
        const t = data[j];
        results.push({ to: m.to, ok: t?.status === 'ok', deviceGone: t?.details?.error === 'DeviceNotRegistered' });
      });
    }
    return results;
  }
}

/** Sends to every device of a user and forgets devices that are gone. Never throws. */
export async function pushToUser(db: Db, push: PushSender, userId: string, msg: Omit<PushMessage, 'to'>, log?: { warn: (o: object, m: string) => void }) {
  try {
    const devices = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.userId, userId));
    if (devices.length === 0) return;
    const results = await push.send(devices.map((d) => ({ ...msg, to: d.token })));
    const gone = results.filter((r) => r.deviceGone).map((r) => r.to);
    if (gone.length) await db.delete(pushTokens).where(inArray(pushTokens.token, gone));
  } catch (err) {
    log?.warn({ err }, 'Push notification failed');
  }
}
