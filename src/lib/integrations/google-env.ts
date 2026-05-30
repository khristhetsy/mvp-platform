export type GoogleOAuthEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionSecret: string;
};

export function getGoogleOAuthEnv(): GoogleOAuthEnv | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  const encryptionSecret = process.env.TOKEN_ENCRYPTION_SECRET?.trim();

  if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) {
    return null;
  }

  return { clientId, clientSecret, redirectUri, encryptionSecret };
}

export function assertGoogleOAuthEnv(): GoogleOAuthEnv {
  const env = getGoogleOAuthEnv();
  if (!env) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and TOKEN_ENCRYPTION_SECRET.",
    );
  }
  return env;
}

export function isGoogleOAuthConfigured() {
  return getGoogleOAuthEnv() !== null;
}
