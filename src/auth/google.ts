import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  sub: string;
  email?: string;
  name?: string;
}

/** Verifies Google ID tokens against the OAuth web client ID used for sign-in. */
export class GoogleVerifier {
  private client: OAuth2Client;
  readonly audiences: string[];

  constructor(clientIds: string[]) {
    this.client = new OAuth2Client();
    this.audiences = clientIds.filter(Boolean);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    const ticket = await this.client.verifyIdToken({ idToken, audience: this.audiences });
    const p = ticket.getPayload();
    if (!p?.sub) throw new Error('invalid token payload');
    return { sub: p.sub, email: p.email ?? undefined, name: p.name ?? undefined };
  }
}

/** Wealth Wave web client ID from lib/services/auth_service.dart */
export const DEFAULT_GOOGLE_CLIENT_IDS = [
  '176187083398-lhfjmlkq87rld56n6bpu50nqddv3pi0h.apps.googleusercontent.com',
];
