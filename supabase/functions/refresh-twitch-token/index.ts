import { serve } from "https://deno.land/std/http/server.ts";
import { jsonResponse, handleCors, isAuthorized } from "../_shared/utils.ts";

const REACTR_EXTENSION_SECRET = Deno.env.get('REACTR_EXTENSION_SECRET');

serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  if (!isAuthorized(req, REACTR_EXTENSION_SECRET)) {
    console.error("Unauthorized request received.");
    return jsonResponse("Unauthorized", 401);
  }

  const { refresh_token } = await req.json();
  if (!refresh_token) {
    console.warn("Request missing refresh_token.");
    return jsonResponse("Bad Request", 400);
  }

  const client_id = Deno.env.get("TWITCH_CLIENT_ID")!;
  const client_secret = Deno.env.get("TWITCH_CLIENT_SECRET")!;

  try {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
      client_id,
      client_secret,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const data = await res.json();

  if (!data.access_token || !data.expires_in) {
      console.error("Failed to refresh token:", data);
      return jsonResponse("Failed to refresh token", 400);
  }

  return jsonResponse({
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_expires_at: Date.now() + data.expires_in * 1000,
  });
  } catch (error) {
    console.error("Token refresh encountered an error:", error);
    return jsonResponse("Internal Server Error", 500);
  }
});

