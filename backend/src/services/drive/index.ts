import type { Secrets } from '../../lib/crypto.js';
import { AppError, badRequest } from '../../lib/errors.js';
import type { GoogleOAuth } from '../google.js';
import { GoogleDriveSource } from './google.js';
import type { MockDriveSource } from './mock.js';
import type { DriveSource } from './types.js';

export type { DriveFolderInfo, DriveImage, DriveSource } from './types.js';

type Connection = { userId: string; provider: string; refreshTokenEnc: string | null };

/** Hands out the right Drive (Google or the mock) for a connection and keeps access tokens fresh. */
export class DriveService {
  private readonly tokens = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    private readonly secrets: Secrets,
    readonly oauth: GoogleOAuth,
    /** Present only when DEV_MOCKS is on. */
    readonly mock: MockDriveSource | null,
  ) {}

  sourceFor(conn: Connection): DriveSource {
    if (conn.provider === 'mock') {
      if (!this.mock) throw badRequest('drive_reconnect', 'Please connect your Google Drive again.');
      return this.mock;
    }
    return new GoogleDriveSource(() => this.accessToken(conn));
  }

  private async accessToken(conn: Connection): Promise<string> {
    const cached = this.tokens.get(conn.userId);
    if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
    if (!conn.refreshTokenEnc) throw new AppError(409, 'drive_reconnect', 'Please connect your Google Drive again.');
    let refreshToken: string;
    try {
      refreshToken = this.secrets.decrypt(conn.refreshTokenEnc);
    } catch {
      throw new AppError(409, 'drive_reconnect', 'Please connect your Google Drive again.');
    }
    try {
      const fresh = await this.oauth.refresh(refreshToken);
      this.tokens.set(conn.userId, { token: fresh.accessToken, expiresAt: fresh.expiresAt });
      return fresh.accessToken;
    } catch (e) {
      if (e instanceof AppError && e.code === 'drive_auth_failed') throw new AppError(409, 'drive_reconnect', 'DriveFlow lost access to your Google Drive. Please connect it again.');
      throw e;
    }
  }

  /** Drops a cached access token (disconnect / account deletion). */
  forget(userId: string) {
    this.tokens.delete(userId);
  }
}
