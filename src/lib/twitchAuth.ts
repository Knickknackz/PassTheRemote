// src/lib/twitchAuth.ts
import { getFromStorage, setInStorage } from './storage'; 

const clientId = 'cyp0e7eayowkqtbjji4fjqtiwg2qz0';
const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
const scope = 'user:read:email user:read:follows';
const supabaseUrl = 'https://gzloumyomschdfkyqwed.supabase.co/functions/v1/';

export async function handleTwitchLogin(showFeedback: (msg: string) => void): Promise<string | null> {
  const { user_id } = await getFromStorage('user_id');

  const authUrl = `https://id.twitch.tv/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${user_id}`;

  // ✅ Wrap in Promise
  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    }, async (redirectUrl) => {
      if (chrome.runtime.lastError || !redirectUrl) {
        console.error('❌ Twitch login failed:', chrome.runtime.lastError);
        showFeedback('❌ Twitch login failed');
        return resolve(null);
      }

      const url = new URL(redirectUrl);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code || !state) {
        console.error('❌ Missing code or state from redirect:', redirectUrl);
        showFeedback('❌ Twitch login failed');
        return resolve(null);
      }

      const response = await fetch(supabaseUrl + 'twitch-auth-callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-extension-auth': 'reactr-ftw-82364',
        },
        body: JSON.stringify({ code, state }),
      });

      if (response.ok) {
        const data = await response.json();

        await setInStorage({
          twitchUsername: data.twitch_username,
          twitchAccessToken: data.access_token,
          twitchRefreshToken: data.refresh_token,
          twitchTokenExpiresAt: data.token_expires_at,
        });

        showFeedback('✅ Twitch account linked');
        return resolve(data.twitch_username); // ✅ success return
      } else {
        const msg = await response.text();
        showFeedback(`❌ Supabase auth callback failed: ${msg}`);
        return resolve(null); // ✅ failure return
      }
    });
  });
}

export async function getValidTwitchAccessToken(): Promise<string | null> {
  const {
    twitchAccessToken,
    twitchRefreshToken,
    twitchTokenExpiresAt,
  } = await getFromStorage<{
    twitchAccessToken?: string;
    twitchRefreshToken?: string;
    twitchTokenExpiresAt?: number;
  }>([
    'twitchAccessToken',
    'twitchRefreshToken',
    'twitchTokenExpiresAt',
  ]);

  if (!twitchAccessToken || !twitchRefreshToken || !twitchTokenExpiresAt) {
    return null;
  }

  if (Date.now() < twitchTokenExpiresAt - 60000) {
    return twitchAccessToken;
  }

  try {
    const res = await fetch(supabaseUrl + 'refresh-twitch-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-extension-auth': 'reactr-ftw-82364',
      },
      body: JSON.stringify({ refresh_token: twitchRefreshToken }),
    });

    if (!res.ok) {
      console.error('❌ Failed to refresh Twitch token:', await res.text());
      return null;
    }

    const data = await res.json();

    await setInStorage({
      twitchAccessToken: data.access_token,
      twitchTokenExpiresAt: data.token_expires_at,
    });

    return data.access_token;
  } catch (err) {
    console.error('❌ Error refreshing Twitch token:', err);
    return null;
  }
}

export async function fetchLiveTwitchUsers(twitchUserIds: string[]): Promise<string[]> {
  if (!twitchUserIds.length) return [];

  const response = await fetch(supabaseUrl + 'get-live-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-extension-auth': 'reactr-ftw-82364', // Replace or import securely
    },
    body: JSON.stringify({ twitch_user_ids: twitchUserIds }),
  });

  if (!response.ok) {
    console.error('❌ Failed to fetch live Twitch users:', await response.text());
    return [];
  }

  const { live_user_ids } = await response.json();
  return Array.isArray(live_user_ids) ? live_user_ids : [];
}