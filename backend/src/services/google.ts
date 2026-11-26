import { createRemoteJWKSet, jwtVerify } from 'jose';

import { badRequest, unauthorized } from '../lib/errors.js';

export type GoogleIdentity = { sub: string; email: string; name: string };

export interface GoogleAuth {
  /** Checks a Google ID token from the app's Google sign-in and returns who it is. */
  verifyIdToken(idToken: string): Promise<GoogleIdentity>;
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** Real Google sign-in: verifies the token's signature, issuer, audience and expiry. */
export class RealGoogleAuth implements GoogleAuth {
  constructor(private readonly clientIds: readonly string[]) {}

  async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    if (this.clientIds.length === 0) throw badRequest('google_not_configured', 'Google sign-in isn’t set up on the server yet.');
    try {
      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: [...this.clientIds],
      });
      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
      if (!payload.sub || !email || payload.email_verified !== true) throw new Error('missing claims');
      const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : email.split('@')[0]!;
      return { sub: payload.sub, email, name };
    } catch {
      throw unauthorized('Google sign-in didn’t work. Please try again.');
    }
  }
}

/**
 * Development stand-in. Accepts "dev:<email>:<Name>" (e.g. "dev:aisha@example.com:Aisha Khan"),
 * so the app's Google button works without Google keys. Only used when DEV_MOCKS is on.
 */
export class MockGoogleAuth implements GoogleAuth {
  constructor(private readonly real?: GoogleAuth) {}

  async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    const m = /^dev:([^\s:@]+@[^\s:@]+\.[^\s:@]+):(.{1,80})$/.exec(idToken);
    if (m) return { sub: `dev-${m[1]!.toLowerCase()}`, email: m[1]!.toLowerCase(), name: m[2]!.trim() };
    if (this.real) return this.real.verifyIdToken(idToken);
    throw unauthorized('Google sign-in didn’t work. Please try again.');
  }
}

/* ---------------------------------------------------------- Drive OAuth */

export type GoogleTokens = { accessToken: string; expiresAt: number; refreshToken?: string; scope: string };

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

type TokenResponse = { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string; error?: string; error_description?: string };

/** Server-side OAuth for Drive: swaps the app's authorization code for tokens and refreshes them. */
export class GoogleOAuth {
  constructor(
    private readonly clientId?: string,
    private readonly clientSecret?: string,
  ) {}

  get configured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  private async token(params: Record<string, string>): Promise<GoogleTokens> {
    if (!this.configured) throw badRequest('drive_not_configured', 'Google Drive isn’t set up on the server yet.');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId!, client_secret: this.clientSecret!, ...params }),
    });
    const data = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok || !data.access_token) {
      throw badRequest('drive_auth_failed', 'Google didn’t accept the Drive connection. Please try connecting again.', { google: data.error });
    }
    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
      refreshToken: data.refresh_token,
      scope: data.scope ?? '',
    };
  }

  /**
   * Authorization code → tokens. The app's native Google sign-in gives a "server auth code" issued for
   * the Web client, which has no redirect URI (Google expects an empty one); browser flows send theirs.
   */
  exchangeCode(input: { code: string; redirectUri?: string; codeVerifier?: string }) {
    return this.token({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri ?? '',
      ...(input.codeVerifier ? { code_verifier: input.codeVerifier } : {}),
    });
  }

  refresh(refreshToken: string) {
    return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  /** Best effort: tells Google to forget the grant when Drive is disconnected or the account is deleted. */
  async revoke(token: string) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => undefined);
  }
}
