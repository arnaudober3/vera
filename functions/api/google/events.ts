import {
  fetchEvents,
  json,
  refreshAccess,
  type RequestContext,
} from "./_shared.ts";

interface EventsBody {
  refreshToken?: string;
}

// POST /api/google/events — silent daily refresh. Trades the client's stored
// refresh token for a fresh access token and returns the upcoming-events window.
export const onRequestPost = async ({
  request,
  env,
}: RequestContext): Promise<Response> => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ error: "Google OAuth is not configured." }, 500);
  }

  let body: EventsBody;
  try {
    body = (await request.json()) as EventsBody;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (!body.refreshToken) {
    return json({ error: "Missing refreshToken." }, 400);
  }

  try {
    const { access_token } = await refreshAccess({
      refreshToken: body.refreshToken,
      env,
    });
    const events = await fetchEvents(access_token);
    return json({ events });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
};
