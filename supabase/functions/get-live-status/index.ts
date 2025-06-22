import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { jsonResponse, handleCors, isAuthorized } from "../_shared/utils.ts";

const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID');
const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET');
const REACTR_EXTENSION_SECRET = Deno.env.get('REACTR_EXTENSION_SECRET');

let cachedAppToken: { token: string; expires: number } | null = null;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (!isAuthorized(req, REACTR_EXTENSION_SECRET)) {
    console.error("❌ Unauthorized request");
    return jsonResponse("Unauthorized", 403);
  }

  let body: { twitch_user_ids: string[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse("❌ Invalid JSON", 400);
  }

  const { twitch_user_ids } = body;
  if (!Array.isArray(twitch_user_ids) || twitch_user_ids.length === 0) {
    return jsonResponse("❌ Missing twitch_user_ids", 400);
  }

  const token = await getAppAccessToken();
  const enriched: any[] = [];

  const chunks = chunkArray(twitch_user_ids, 100);
  for (const chunk of chunks) {
    const params = new URLSearchParams();
    chunk.forEach(id => params.append('user_id', id));
    params.append('first', '100');
    console.log(params);
    const res = await fetch(`https://api.twitch.tv/helix/streams?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': TWITCH_CLIENT_ID!,
      },
    });

    if (!res.ok) {
      console.error(`❌ Twitch error: ${res.status} ${await res.text()}`);
      continue;
    }

    const { data } = await res.json();
    for (const stream of data) {
      enriched.push({
        twitch_user_id: stream.user_id,
        title: stream.title,
        language: stream.language,
        viewer_count: stream.viewer_count,
        thumbnail_url: stream.thumbnail_url,
        tags: stream.tags || [], // fallback if no tag labels
        is_mature: stream.is_mature ?? false,
      });
    }
  }

  return jsonResponse({ live_streams: enriched });
});

function chunkArray(arr: string[], size: number): string[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

async function getAppAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAppToken && cachedAppToken.expires > now + 60000) {
    return cachedAppToken.token;
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID!,
      client_secret: TWITCH_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    }),
  });

  const json = await res.json();
  cachedAppToken = {
    token: json.access_token,
    expires: now + json.expires_in * 1000,
  };
  return cachedAppToken.token;
}
