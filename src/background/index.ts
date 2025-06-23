import { createClient } from '@supabase/supabase-js';
import { getFromStorage, removeFromStorage } from '../lib/storage';

// 🛠 Supabase config
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let channel: ReturnType<typeof supabase.channel> | null = null;
const registeredTabIds = new Set<number>();

// 🔁 Broadcast helper
function broadcastToAllTabs(message: any) {
  for (const tabId of registeredTabIds) {
    chrome.tabs.sendMessage(tabId, message, () => {
      if (chrome.runtime.lastError) {
        console.warn(`⚠️ Could not send to tab ${tabId}:`, chrome.runtime.lastError.message);
        registeredTabIds.delete(tabId); // clean up dead tab
      }
    });
  }
}

// 🚀 Subscribe to updates for a room
async function resubscribeToRoom(roomId: string) {
  if (channel) {
    console.log('🔌 Unsubscribing from old channel');
    await supabase.removeChannel(channel);
    channel = null;
  }

  if (!roomId) return;
  console.groupCollapsed('🔗 Subscribing to room:', roomId);

  //Variables for ViewCount Updates
  let lastCount = -1; 
  let lastRun = 0;
  const throttleDelay = 500;  


  const {userId} = await getFromStorage<{ userId: string }>('user_id');

  channel = supabase.channel(`room-${roomId}`, {
    config: { presence: { key: userId  } }
  });

  channel
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'reactr_rooms',
      filter: `room_id=eq.${roomId}`,
    }, (payload: any) => {
      const changedFields = Object.keys(payload.new).filter(
        key => payload.new[key] !== payload.old[key]
      );

      // Skip if the only change was to viewer_count
      if (changedFields.length == 1 && changedFields[0] === 'viewer_count') {
        console.log('Only View Count Updated, Skipping Video Sync');
        return;
      }

      const session = payload.new;
      console.log('🗃 DB update BROADCASTED:', session);
      broadcastToAllTabs({
        type: 'sync-update',
        state: session.play_state,
        time: session.current_time,
        video_id: session.video_id,
        provider: session.provider,
        show_title: session.show_title,
        episode_title: session.episode_title,
        episode_number: session.episode_number,
        updated_at: session.updated_at,
        viewer_count: session.viewer_count
      });
    })
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'reactr_rooms',
      filter: `room_id=eq.${roomId}`,
    }, (payload: any) => {
      console.log('🗃 DB delete:', payload);
      const deletedRoomId = payload.old.room_id;
    
      // Only notify tabs if this user was in that room
      getFromStorage<{ roomId: string }>('roomId').then(({ roomId }) => {
        if (roomId === deletedRoomId) {
          removeFromStorage(['roomId','role','videoId','provider']);
          broadcastToAllTabs({ type: 'room-closed', roomId });
        }
      });
    }).on('presence', { event: 'sync' }, () => {
      getFromStorage<{ role: string }>('role').then(({ role }) => {
        if (role !== 'host' || !channel) return;
        const now = Date.now();
        if (now - lastRun >= throttleDelay) {
          const count = Object.keys(channel.presenceState()).length;
          if (count !== lastCount) {
            supabase.from('reactr_rooms').update({ viewer_count: count }).eq('room_id', roomId);
            lastRun = now;
            lastCount = count;
          }
        }
      });
    });


  await channel.subscribe((status) => {
    console.log(`📶 Supabase channel status: ${status}`);
  });

  console.groupEnd();
}

// 📝 Push playback updates from host to Supabase
async function updateRoomPlayback(playState: string, currentTime: number, videoId: string, provider: string, episode_title: string, show_title: string, episode_number: string) {
  const { roomId } = await getFromStorage<{ roomId: string }>('roomId');
  if (!roomId) {
    console.log('no room id, Room Playback Failed');
    return;
  }

  const { error } = await supabase
    .from('reactr_rooms')
    .upsert([{
      room_id: roomId,
      play_state: playState,
      current_time: currentTime,
      video_id: videoId,
      provider,
      episode_title,
      show_title,
      episode_number,
      updated_at: new Date().toISOString(),
    }]);

  if (error) {
    console.error("❌ Error updating session:", error);
  } else {
    console.log("📡 DB updated:", { playState, currentTime });
  }
}


// 🧩 Main initialization logic
function init() {
  console.log("📦 ReactSync background service worker loaded.");

  // Extension installed
  chrome.runtime.onInstalled.addListener(() => {
    console.log('✅ Extension installed – background initialized!');
  });

  // Boot channel on startup
  getFromStorage<{ roomId: string }>('roomId').then(({ roomId }) => {
    if (roomId) {
      resubscribeToRoom(roomId).catch(console.error);
    }
  });

  // Runtime message handler
  chrome.runtime.onMessage.addListener(async (message, sender) => {
    if (message.type === 'register-content' && sender.tab?.id) {
      registeredTabIds.add(sender.tab.id);
      console.log("✅ Registered tab:", sender.tab.id);
      getFromStorage<{ roomId: string }>('roomId').then(({ roomId }) => {
        if(roomId){ 
          supabase
          .from('reactr_rooms')
          .select('provider, video_id, current_time, updated_at, play_state, show_title, episode_title, episode_number, viewer_count')
          .eq('room_id', roomId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error || !data) {
              broadcastToAllTabs({
                type: 'room-closed',
                roomId: roomId,
              });
              removeFromStorage(['roomId','role','videoId','provider']);
              console.log('Invalid Room, Probably Delteted, Clearing Local Values');
              return;
            }

            // ✅ valid room — broadcast sync-update
            console.log('📥 Syncing playing info after registering');
            broadcastToAllTabs({
              type: 'sync-update',
              state: data.play_state,
              time: data.current_time,
              video_id: data.video_id,
              provider: data.provider,
              show_title: data.show_title,
              episode_title: data.episode_title,
              episode_number: data.episode_number,
              updated_at: data.updated_at,
              viewer_count: data.viewer_count
            });
          });
        }
      });
      const filters = [];
      if (message.videoId) filters.push(`video_id.eq.${message.videoId}`);
      if (message.showTitle) filters.push(`show_title.ilike.${message.showTitle}`);
      if (filters.length === 0) return; // Prevent querying all rooms
      try {
        const { data: matchingRooms, error } = await supabase
          .from('reactr_rooms')
          .select('room_id, video_id, show_title, episode_title, episode_number, provider')
          .or(filters.join(','));
        
        if (!error && matchingRooms && matchingRooms.length > 0) {
          const exactMatches = matchingRooms.filter(r => r.video_id === message.videoId);
          const showMatches = matchingRooms.filter(r =>
            r.show_title?.toLowerCase() === message.showTitle?.toLowerCase() 
          );
          if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: 'room-match',
              exactMatches,
              showMatches,
            });
          }
        }
      } catch (err) {
        console.error('Error checking for matching rooms:', err);
      }
    }
    if (message.type === "video-update") {
      console.log("📤 Syncing video state:", message);
      updateRoomPlayback(message.play_state, message.current_time, message.video_id, message.provider, message.episode_title, message.show_title, message.episode_number);
    }
    if (message.type === 'unregister-content' && sender.tab?.id) {
      registeredTabIds.delete(sender.tab.id);
    }
  });

  // React to room ID changes in storage
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.roomId) {
      const newRoomId = changes.roomId.newValue;
      console.log('🆕 Detected roomId change:', newRoomId);
      resubscribeToRoom(newRoomId);
    }
  });
}

init();

// Optional named export
export { updateRoomPlayback };
