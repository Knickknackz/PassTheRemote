// @ts-nocheck
import { supabase } from '../lib/supabaseClient';
import { getFromStorage, setInStorage } from '../lib/storage'; 
import * as React from 'react';
import { createRoot } from 'react-dom/client';

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

async function handleJoinClick(e, room, twitchUsername, targetUrl) {
          e.preventDefault();
          await switchToRoom(room.room_id, twitchUsername, room.video_id, room.provider);
          window.location.href = targetUrl;
}

function ReactrBanner({ room, twitchUsername, targetUrl, onClose }: {
  room: any;
  twitchUsername: string;
  targetUrl: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#18181b',
        color: '#fff',
        padding: '24px 36px',
        borderRadius: '16px',
        zIndex: 999999,
        fontSize: '18px',
        fontFamily: 'Inter, sans-serif',
        boxShadow: '0 0 24px rgba(0,0,0,0.4)',
        maxWidth: '440px',
        textAlign: 'center',
        transition: 'opacity 0.3s ease',
        opacity: 1,
      }}
    >
      <div
        style={{ position: 'absolute', top: 8, right: 12, cursor: 'pointer', fontSize: 16 }}
        onClick={onClose}
      >
        ❌
      </div>
      <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
        🎬 {room.provider.toUpperCase()} Room Active
      </div>
      <a
        href="#"
        style={{ color: '#00ffa3', fontWeight: 'bold', textDecoration: 'underline', fontSize: 16 }}
        onClick={(e) => handleJoinClick(e, room, twitchUsername, targetUrl)}
      >
        Click to join →
      </a>
    </div>
  );
}

function showReactrBanner(room: {
  room_id: string;
  provider: string;
  video_id: string;
  current_time: number;
}, twitchUsername: string, targetUrl: string) {
  const id = `reactr-banner-${room.provider}`;
  if (document.getElementById(id)) return;

  const container = document.createElement('div');
  container.id = id;
  document.body.appendChild(container);

  function handleClose() {
    root.unmount();
    container.remove();
  }

  const root = createRoot(container);
  root.render(
    React.createElement(ReactrBanner, {
      room,
      twitchUsername,
      targetUrl,
      onClose: handleClose
    })
  );
}

async function switchToRoom(newRoomId: string, twitchUsername: string, videoId : string, provider: string) {
  if (currentRole === 'host' && currentRoomId && (newRoomId !== currentRoomId)) {
    await supabase.from('reactr_rooms').delete().eq('room_id', currentRoomId);
  }

  await setInStorage({
    roomId: newRoomId,
    role: 'audience',
    channelId: twitchUsername,
    showChat: true,
    showStream: true,
    videoId,
    provider
  });

  currentRoomId = newRoomId;
  currentRole = 'audience';
}

async function initializeTwitchReactionBanner() {
  const twitchUser = getTwitchUsernameFromUrl();
  if (!twitchUser) return;

  const storage = await getFromStorage<{ roomId?: string; role?: string }>(['roomId', 'role']);
  currentRoomId = storage.roomId;
  currentRole = storage.role;

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
}

(async () => {
  await initializeTwitchReactionBanner();
})();