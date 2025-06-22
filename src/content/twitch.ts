import { supabase } from '../lib/supabaseClient';

let currentRoomId: string | undefined = undefined;
let currentRole: string | undefined = undefined;

function getTwitchUsernameFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/([^/?#]+)/);
  return match?.[1] || null;
}

async function fetchAllRoomsForStreamer(streamerUsername: string) {
  const { data, error } = await supabase
    .from('reactr_rooms')
    .select('room_id, provider, video_id, current_time')
    .eq('streamer_username', streamerUsername);

  return error ? [] : data || [];
}

function getRoomUrl(provider: string, video_id: string, current_time: number) {
  const t = Math.floor(current_time || 0);
  switch (provider) {
    case 'netflix':
      return `https://www.netflix.com${video_id}?t=${t}`;
    case 'crunchyroll':
      return `https://www.crunchyroll.com${video_id}?t=${t}`;
    default:
      return null;
  }
}

function showReactrBanner(room: {
  room_id: string;
  provider: string;
  video_id: string;
  current_time: number;
}, twitchUsername: string, targetUrl: string) {
  const id = `reactr-banner-${room.provider}`;
  if (document.getElementById(id)) return;

  const banner = document.createElement('div');
  banner.id = id;
  banner.innerHTML = `
    <div style="position: absolute; top: 8px; right: 12px; cursor: pointer; font-size: 16px;" id="${id}-close">❌</div>
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">🎬 ${room.provider.toUpperCase()} Room Active</div>
    <a href="#" id="${id}-join" style="color: #00ffa3; font-weight: bold; text-decoration: underline; font-size: 16px;">
      Click to join →
    </a>
  `;

  Object.assign(banner.style, {
    position: 'fixed',
    top: '40%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#18181b',
    color: '#fff',
    padding: '24px 36px',
    borderRadius: '16px',
    zIndex: '999999',
    fontSize: '18px',
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 0 24px rgba(0,0,0,0.4)',
    maxWidth: '440px',
    textAlign: 'center',
    transition: 'opacity 0.3s ease',
    opacity: '0',
  });

  document.body.appendChild(banner);

  // Fade in
  setTimeout(() => {
    banner.style.opacity = '1';
  }, 10);

  // Close button
  const closeBtn = document.getElementById(`${id}-close`);
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      banner.style.opacity = '0';
      setTimeout(() => banner.remove(), 300);
    });
  }

  // Join click
  const joinBtn = document.getElementById(`${id}-join`);
  if (joinBtn) {
    joinBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await switchToRoom(room.room_id, twitchUsername, room.video_id, room.provider);
      window.location.href = targetUrl;
    });
  }
}

function getFromStorage<T>(keys: string[]): Promise<T> {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

async function switchToRoom(newRoomId: string, twitchUsername: string, videoId : string, provider: string) {
  //Was there to prevent duplicates. Likely unreachable now
  if (currentRole === 'host' && currentRoomId && (newRoomId !== currentRoomId)) {
    await supabase.from('reactr_rooms').delete().eq('room_id', currentRoomId);
  }

  //Currently Unneeded. Only necessary if we want hosts to swap rooms.
  //const newRole = (currentRole === 'host' && newRoomId === currentRoomId) ? 'host' : 'audience';

  await chrome.storage.local.set({
    roomId: newRoomId,
    role: 'audience',
    channelId: twitchUsername,
    showChat: true,
    showStream: true,
    videoId,
    provider
  });

  // ✅ Update globals to reflect change
  currentRoomId = newRoomId;
  currentRole = 'audience';
}

// 🔁 Run on Twitch load
(async () => {
  const twitchUser = getTwitchUsernameFromUrl();
  if (!twitchUser) return;

  const storage = await getFromStorage<{ roomId?: string; role?: string }>(['roomId', 'role']);
  currentRoomId = storage.roomId;
  currentRole = storage.role;

  // ✅ Early exit: already host and have a room
  if (currentRole === 'host' && currentRoomId) {
    console.log('🟢 Already host with an active room. Skipping Reactr banner injection.');
    return;
  }

  const rooms = await fetchAllRoomsForStreamer(twitchUser);
  for (const room of rooms) {
    const url = getRoomUrl(room.provider, room.video_id, room.current_time);
    if (url) {
      showReactrBanner(room, twitchUser, url);
      return;
    }
  }
})();