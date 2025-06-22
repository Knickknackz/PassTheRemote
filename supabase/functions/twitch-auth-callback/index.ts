import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, handleCors, isAuthorized } from "../_shared/utils.ts";

const REACTR_EXTENSION_SECRET = Deno.env.get('REACTR_EXTENSION_SECRET');

serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  if (!isAuthorized(req, REACTR_EXTENSION_SECRET)) {
    console.error("❌ Unauthorized request - missing or invalid shared secret");
    return jsonResponse("❌ Unauthorized", 401);
  }

  if (req.method !== "POST") {
    console.warn("🚫 Invalid method:", req.method);
    return jsonResponse("Method Not Allowed", 405);
  }

  const body = await req.json();
  const { code, state } = body;

  if (!code || !state) {
    console.error("❌ Missing code or state in request body");
    return jsonResponse("❌ Missing code or state", 400);
  }

  const client_id = Deno.env.get("TWITCH_CLIENT_ID")!;
  const client_secret = Deno.env.get("TWITCH_CLIENT_SECRET")!;
  const redirect_uri = `https://${Deno.env.get("CHROME_EXTENSION_ID")}.chromiumapp.org/`;

  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id,
      client_secret,
      code,
      grant_type: "authorization_code",
      redirect_uri,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const tokens = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokens;

  if (!access_token || !refresh_token) {
    console.error("❌ Failed to retrieve Twitch tokens");
    return jsonResponse("❌ Failed to get tokens", 400);
  }

  const userRes = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Client-Id": client_id,
    },
  });

  const userData = await userRes.json();
  const user = userData.data?.[0];

  if (!user) {
    console.error("❌ Failed to fetch Twitch user");
    return jsonResponse("❌ Failed to fetch Twitch user", 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase.from("twitch_users")
  .upsert({
    local_user_id: state,
    twitch_user_id: user.id,
    twitch_username: user.login,
    display_name: user.display_name,
    profile_image_url: user.profile_image_url,
    offline_image_url: user.offline_image_url,
    broadcaster_type: user.broadcaster_type,
    access_token,
    refresh_token,
    token_expires_at: Date.now() + expires_in * 1000,
  }, {
    onConflict: 'twitch_user_id',
  });

  if (error) {
    console.error("❌ Supabase upsert error:", JSON.stringify(error, null, 2));
    return jsonResponse("❌ Failed to save user", 500);
  }

  return jsonResponse({
    message: "✅ Twitch linked!",
    twitch_username: user.login,
    access_token,
    refresh_token,
    expires_in, // in seconds
    token_set_at: Date.now(),
  });
});
