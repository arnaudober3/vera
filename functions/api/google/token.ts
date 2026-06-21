import {
  exchangeCode,
  fetchEvents,
  json,
  type RequestContext,
} from "./_shared.ts";

interface TokenBody {
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
}

// POST /api/google/token — exchanges the OAuth authorization code (+ PKCE
// verifier) for tokens, then fetches the upcoming-events window in the same
// round-trip. Returns the refresh token (persisted client-side for silent daily
// refresh) plus the normalized events.
export const onRequestPost = async ({
  request,
  env,
}: RequestContext): Promise<Response> => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ error: "Google OAuth is not configured." }, 500);
  }

  let body: TokenBody;
  try {
    body = (await request.json()) as TokenBody;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const { code, codeVerifier, redirectUri } = body;
  if (!code || !codeVerifier || !redirectUri) {
    return json(
      { error: "Missing code, codeVerifier or redirectUri." },
      400,
    );
  }

  try {
    const tokens = await exchangeCode({ code, codeVerifier, redirectUri, env });
    if (!tokens.refresh_token) {
      // No refresh token means a prior grant is still active; the client should
      // disconnect and reconnect (prompt=consent) to force a fresh one.
      return json(
        { error: "No refresh token returned. Disconnect and reconnect." },
        409,
      );
    }
    const events = await fetchEvents(tokens.access_token);
    return json({ refreshToken: tokens.refresh_token, events });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
};
