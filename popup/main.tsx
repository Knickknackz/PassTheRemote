/// <reference types="chrome" />
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from '../src/lib/supabaseClient';
import { nanoid } from 'nanoid';
import styles from './popup.module.css';
import { handleTwitchLogin } from '../src/lib/twitchAuth';
import { getFromStorage, setInStorage, removeFromStorage } from '../src/lib/storage';

function Popup() {
  const [streamOpacity, setStreamOpacity] = useState(1);
  const [chatOpacity, setChatOpacity] = useState(1);
  const [isHost, setIsHost] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [showStreamer, setShowStreamer] = useState(true);
  const [useCustomLayout, setUseCustomLayout] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [skipSeconds, setSkipSeconds] = useState('30');
  const [currentTab, setCurrentTab] = useState<'Room' | 'Streams' | 'Settings' | 'Developer Tools'>('Room');
  const tabs = ['Room', 'Streams', 'Settings', 'Developer Tools'] as const;
  const [enableUnlock, setEnableUnlock] = useState(false);
  const [linkedTwitchUsername, setLinkedTwitchUsername] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  
  const toggleUnlock = () => {
    if(!useCustomLayout){
      showFeedback("❌ Can't Unlock Without Custom Layout Enabled");
      return;
    }
    const newVal = !isUnlocked;
    setIsUnlocked(newVal);
    setEnableUnlock(newVal);
    setInStorage({ unlocked: newVal });

    if(!newVal){
      saveOverlayPositions();
    }
  };
    
  function getVideoUrl(provider: string, video_id: string, current_time: number): string | null {
    const t = Math.floor(current_time || 0);
    console.log(video_id);
    switch (provider) {
      case 'netflix':
        return `https://www.netflix.com${video_id}?t=${t}`;
      case 'crunchyroll':
        return `https://www.crunchyroll.com${video_id}?t=${t}`;
      default:
        return null;
    }
  }

  function getTimeWithDelta(current_time: number, updated_at: string): number{
    if(!current_time) return 0
    if(!updated_at) return current_time;

    // Convert to ISO 8601 format (replace space with "T")
    const isoTimestamp = updated_at.replace(' ', 'T');

    // Create Date objects
    const past = new Date(isoTimestamp);
    const now = new Date();

    // Difference in seconds
    const diffSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    
    return diffSeconds + current_time;
  }

  const toggleCustomLayout = () =>{
    const newVal = !useCustomLayout;
    setUseCustomLayout(newVal);
    setEnableUnlock(newVal && isUnlocked);
    setInStorage({ customLayout: newVal });
  };

  const toggleChatVisibility = () => {
    if (!channelId.trim()) return;

    const newVal = !showChat;
    setShowChat(newVal);
    setInStorage({ showChat: newVal });
  };

  function updateChannel(channelId: string) {
    setChannelId(channelId.trim());
    setInStorage({ channelId: channelId.trim() });
  }

  const toggleStreamerVisibility = () => {
    if (!channelId.trim()) return;

    const newVal = !showStreamer;
    setShowStreamer(newVal);
    setInStorage({ showStreamer: newVal });
  };

  const updateOpacity = (target: 'stream' | 'chat', value: number) => {
    const setter = target === 'stream' ? setStreamOpacity : setChatOpacity;
    const storageKey = target === 'stream' ? 'streamOpacity' : 'chatOpacity';

    setter(value);
    setInStorage({ [storageKey]: value });
  };

  const setVisibility = (newVal : boolean) => {
    setIsVisible(newVal);
    setInStorage({ visible: newVal });
  }

  const saveOverlayPositions= () =>{
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            const overlays = (window as any).ReactSync_getCurrentOverlayStates?.();
            console.log(overlays);
            if (overlays) {
              chrome.storage.local.set({ overlays });
            }
          },
        });
        showFeedback('✅ Overlay positions saved!');
      }
    });
  }

  useEffect(() => {
    (async () => {
      const {
        twitchUsername = '',
        role,
        channelId = '',
        showStreamer,
        showChat,
        customLayout,
        unlocked,
        visible,
        user_id,
        roomId = '',
        streamOpacity = 1,
        chatOpacity = 1
      } = await getFromStorage<{
        twitchUsername?: string;
        role?: string;
        channelId?: string;
        showStreamer?: boolean;
        showChat?: boolean;
        customLayout?: boolean;
        unlocked?: boolean;
        visible?: boolean;
        user_id?: string;
        roomId?: string;
        streamOpacity?: number;
        chatOpacity?: number;
      }>([
        'twitchUsername', 'role', 'channelId', 'showStreamer', 'showChat',
        'customLayout', 'unlocked', 'visible', 'user_id', 'roomId',
        'streamOpacity', 'chatOpacity'
      ]);

      console.log('custom layout', !!customLayout);

      setIsHost(role === 'host');
      setChannelId(channelId);
      setShowChat(!!showChat);
      setShowStreamer(!!showStreamer);
      setIsUnlocked(!!unlocked);
      setUseCustomLayout(!!customLayout);
      setEnableUnlock(customLayout ? !!unlocked : !!customLayout);
      setIsVisible(!!visible);
      setJoinRoomId(roomId);
      setStreamOpacity(streamOpacity);
      setChatOpacity(chatOpacity);
      setLinkedTwitchUsername(twitchUsername);

      if (!user_id) {
        const newId = crypto.randomUUID();
        await setInStorage({ user_id: newId });
        console.log(newId);
      }
    })();
  }, []);


  const handleLeaveRoom = async () => {
    await removeFromStorage(['roomId', 'role','videoId','provider']);
    setJoinRoomId('');
    setIsHost(false);
    showFeedback('👋 Left the room!');
  };

  const handleCloseRoom = async () => {
    const { roomId } = await getFromStorage(['roomId']);
    console.log(roomId);
    if (!roomId) {
      showFeedback('⚠️ No room to close.');
      return;
    }
    // Delete room from Supabase
    const { error } = await supabase.from('reactr_rooms').delete().eq('room_id', roomId);
    if (error) {
      console.error('Error closing room:', error.message);
      if(!isLinking) showFeedback('❌ Failed to close room');
      return;
    }
    // Clear local storage
    await removeFromStorage(['roomId', 'role','videoId','provider']);
    setJoinRoomId('');
    setIsHost(false);
    if(!isLinking) showFeedback('❌ Room closed!');
  };

  const handleHostToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;

    const storage = await getFromStorage(['user_id','roomId']);
    const userId = storage.user_id;
    const roomId = storage.roomId;

    if (!userId || !roomId) return;

    if (checked) {
      const { data: existingRoom, error: checkError } = await supabase
        .from('reactr_rooms')
        .select('host_id')
        .eq('room_id', roomId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing host:', checkError.message);
        return;
      }

      if (existingRoom && existingRoom.host_id && existingRoom.host_id !== userId) {
        showFeedback('❌ A host already exists for this room.'); 
        return;
      }

      const { error: updateError } = await supabase
        .from('reactr_rooms')
        .update({ host_id: userId })
        .eq('room_id', roomId);

      if (updateError) {
        console.error('Error updating host:', updateError.message);
        return;
      }
    }else {
      // 🔻 Clear host_id from the room
      const { error: clearHostError } = await supabase
        .from('reactr_rooms')
        .update({ room_id: roomId, host_id: null })
        .eq('room_id', roomId);

      if (clearHostError) {
        console.error('Error clearing host:', clearHostError.message);
        return;
      }
    }

    sendHostUpdate(checked);
  };

  const sendHostUpdate = async (checked) => {
    setIsHost(checked);
    await setInStorage({ role: checked ? 'host' : 'audience' });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'role-update',
          role: checked ? 'host' : 'audience',
        });
      }
    });
  }
  
  const handleGenerateRoom = async () => {
    const roomId = nanoid(6);
    const { user_id, twitchUsername, role, roomId : oldRoomId } = await getFromStorage(['user_id', 'twitchUsername', 'role', 'roomId']);

    let verifiedTwitchUserId: string | null = null;
    let isVerified = false;
    if (twitchUsername) {
      const { data: match, error } = await supabase
        .from('twitch_users')
        .select('twitch_user_id')
        .eq('twitch_username', twitchUsername)
        .eq('local_user_id', user_id)
        .maybeSingle();

      if (match && !error) {
        verifiedTwitchUserId = match.twitch_user_id;
        isVerified = true;
      }
    }
    
    const { error } = await supabase.from('reactr_rooms').insert({
      room_id: roomId,
      host_id: user_id,
      streamer_username:isVerified ? twitchUsername : null,
      twitch_user_id: isVerified ? verifiedTwitchUserId : null,
    });

    if (error) {
      console.error('Error creating room:', error.message);
      showFeedback('❌ Failed to create room');
      return;
    }

    if(role == 'host' && oldRoomId) await handleCloseRoom();
    await setInStorage({ roomId: roomId, role: 'host'});
    setVisibility(false);
    setJoinRoomId(roomId);
    sendHostUpdate(true);//tells other components that "i'm a host now"
    //Force a status check on the rooms if there.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log(tabs[0]);
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'request-state'}, (response) => {
          if (chrome.runtime.lastError || !response?.videoFound) {
            showFeedback('⚠️ Room created, but no video detected. Start playback to begin syncing.', 10000);
            return;
          }
        });
      }else{
        showFeedback('⚠️ Room created, but no video detected. Start playback to begin syncing.', 10000);
        return;
      }
    });
    showFeedback((!twitchUsername || (!!twitchUsername && isVerified))? '✅ Room Created and Linked with Twitch!': '✅ Room Created!');
  };

  const handleGoToVideo = async () => {
    const { roomId } = await getFromStorage(['roomId']);
    if (!roomId) return;

    const { data, error } = await supabase
      .from('reactr_rooms')
      .select('provider, video_id, current_time, updated_at, play_state')
      .eq('room_id', roomId)
      .maybeSingle();

    if (error || !data) {
      showFeedback('❌ Could not fetch video info');
      return;
    }

    const { provider, video_id, current_time, updated_at, play_state } = data;

    const targetTime = play_state == 'playing' ? getTimeWithDelta(current_time, updated_at) : current_time;
    console.log('target time', targetTime);
    const url = getVideoUrl(provider, video_id, targetTime);
    console.log(url);
    if (url) chrome.tabs.update({ url });
  };

  const submitJoinRoom = async () => {
    const roomId = pendingRoomId.trim();
    if (!roomId) return;

    const { data, error } = await supabase
      .from('reactr_rooms')
      .select('room_id, host_id, video_id, provider, current_time, streamer_username, updated_at, play_state')
      .eq('room_id', roomId)
      .maybeSingle();

    if (error || !data) {
      showFeedback('❌ Error joining room.');
      return;
    }

    const { user_id } = await getFromStorage(['user_id']);
    const role = data.host_id === user_id ? 'host' : 'audience';

    await setInStorage({ roomId, role, videoId: data.video_id, provider: data.provider, visible: true, channelId: data.streamer_username });
    setJoinRoomId(roomId);
    setVisibility(true);
    setIsHost(role === 'host');
    setShowJoinInput(false);

    const { provider, video_id, current_time, updated_at, play_state } = data;
    if (provider && video_id) {
      setFeedback('✅ Successfully Joined Room: ' + roomId);
      const targetTime = play_state == 'playing' ? getTimeWithDelta(current_time, updated_at) : current_time;
      console.log('target time', targetTime);
      const videoUrl = getVideoUrl(provider, video_id, targetTime);
      
      setPendingRoomId('');
      if (videoUrl) chrome.tabs.update({ url: videoUrl });
    }else{
      setFeedback("✅ You're in! After the host starts a video, click 'Go to Video' to sync playback."); 
    }
  };

  const handleChannelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setChannelId(value);
  };

  const showFeedback = (msg: string, duration = 3000) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), duration);
  };

  const postDebugCommand = (state: 'playing' | 'paused' | 'skip') => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'sync-update',
          video_id: 'debug',
          state,
          time: state === 'skip' ? parseFloat(skipSeconds) : undefined,
        });
      }
    });
  };

  const ToggleSlider = ({
    label,
    checked,
    onChange,
    trueLabel = 'On',
    falseLabel = 'Off',
  }: {
    label: string;
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    trueLabel?: string;
    falseLabel?: string;
  }) => (
    <div className={styles.toggleWrapper}>
      <label className={styles.toggleLabel}>
        <span>{label}</span>
        <div className={styles.toggle} onClick={() => {
          const syntheticEvent = {
            target: { checked: !checked },
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }}>
          <div className={`${styles.track} ${checked ? styles.on : styles.off}`} />
          <div className={styles.thumb} style={{ left: checked ? '34px' : '4px' }} />
          <span className={styles.toggleText} style={{ left: checked ? '8px' : '34px' }}>
            {checked ? trueLabel : falseLabel}
          </span>
        </div>
        <input type="checkbox" checked={checked} onChange={onChange} className={styles.hiddenInput} />
      </label>
    </div>
  );

  async function handleTwitchUnlink(showFeedback: (msg: string) => void) {
    if (linkedTwitchUsername) {
      const { error } = await supabase
        .from('twitch_users')
        .delete()
        .eq('twitch_username', linkedTwitchUsername);

      if (error) {
        showFeedback('⚠️ Twitch deletion failed:' + error.message);
      } else {
        await removeFromStorage([
          'twitchUsername',
          'twitchAccessToken',
          'twitchRefreshToken',
          'twitchTokenExpiresAt',
        ]);

        setLinkedTwitchUsername('');
        handleCloseRoom();
        showFeedback('❌ Twitch account unlinked');
      }
    }
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.header}>⚛️ PassTheRemote Control Panel</h2>

      {feedback && (
        <div className={styles.feedback}>
          {feedback}
        </div>
      )}

      {/* Tab buttons */}
      <div className={styles.tabRow}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setCurrentTab(tab)}
            className={`${styles.tabButton} ${currentTab === tab ? styles.activeTab : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {currentTab === 'Room' && (
        <div className={styles.tabContent}>
          <h3>Room Settings</h3>

          <div className={styles.roomRow}>
            <label htmlFor="roomInput"><strong>Current Room:</strong></label>
            <input
              id="roomInput"
              type="text"
              value={joinRoomId}
              readOnly
              className={`${styles.input} ${joinRoomId ? styles.readOnlyInput : ''}`}
            />
            {joinRoomId && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(joinRoomId);
                  showFeedback('📋 Room ID copied!');
                }}
                className={styles.copyButton}
              >
                Copy
              </button>
            )}
          </div>
          {joinRoomId && (
            <div className={styles.buttonRow}>
              {!isHost && (
                <>
                  <button onClick={handleLeaveRoom} className={styles.button}>
                    👋 Leave Room
                  </button>
                  <button onClick={handleGoToVideo} className={styles.button}>
                    🎬 Go to Video
                  </button>
                </>
              )}
              {isHost && (
                <button onClick={handleCloseRoom} className={styles.button}>
                  🛑 Close Room
                </button>
              )}
            </div>
          )}
          <div className={styles.buttonRow}>
            <button onClick={handleGenerateRoom} className={styles.button}>
              ➕ Create New Room
            </button>
          </div>
          {showJoinInput ? (
            <div style={{ marginTop: '1rem' }}>
              <label htmlFor="joinRoomInput">Enter Room ID:</label>
              <input
                id="joinRoomInput"
                type="text"
                value={pendingRoomId}
                onChange={(e) => setPendingRoomId(e.target.value)}
                placeholder="e.g. a1b2c3"
                className={styles.input}
              />
              <div className={styles.buttonRow}>
                <button onClick={submitJoinRoom} className={styles.button}>✅ Join</button>
                <button onClick={() => setShowJoinInput(false)} className={styles.button}>❌ Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowJoinInput(true)} className={styles.button}>
              🔗 Join Room
            </button>
          )}
          <div style={{ marginTop: '1rem' }}>
            <h4>🔥 Recommended</h4>
            <button className={styles.button} onClick={() => {
              const url = chrome.runtime.getURL('src/rooms/index.html');
              window.open(url, '_blank');
              }}>
              View All Rooms
            </button>
          </div>
        </div>
      )}

      {currentTab === 'Streams' && (
        <div className={styles.tabContent}>
          <h3>Stream Settings</h3>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <label style={{ minWidth: '110px' }}>Twitch Streamer:</label>
              <input
                type="text"
                value={channelId}
                onChange={handleChannelChange}
                placeholder="e.g. pikabooirl"
                className={styles.input}
                style={{ flexGrow: 1 }}
              />
              <button
                onClick={() => updateChannel(channelId)}
                className={styles.button}
                style={{ whiteSpace: 'nowrap', padding: '0.5em 0.8em' }}
              >
                🔁 Reload
              </button>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
              <div style={{ flex: 1 }}>
                <ToggleSlider
                  label="Show Stream"
                  checked={showStreamer}
                  onChange={() => toggleStreamerVisibility()}
                  trueLabel="On"
                  falseLabel="Off"
                />
              </div>
              <div style={{ flex: 1 }}>
                <ToggleSlider
                  label="Show Chat"
                  checked={showChat}
                  onChange={() => toggleChatVisibility()}
                  trueLabel="On"
                  falseLabel="Off"
                />
              </div>
            </div>
            {/* Opacity Controls Inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
              <label style={{ minWidth: '100px' }}>Stream Opacity</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={streamOpacity}
                onChange={(e) => updateOpacity('stream', parseFloat(e.target.value))}
                className={styles.slider}
                style={{ flexGrow: 1 }}
              />
              <span style={{ width: '40px' }}>{Math.round(streamOpacity * 100)}%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <label style={{ minWidth: '100px' }}>Chat Opacity</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={chatOpacity}
                onChange={(e) => updateOpacity('chat', parseFloat(e.target.value))}
                className={styles.slider}
                style={{ flexGrow: 1 }}
              />
              <span style={{ width: '40px' }}>{Math.round(chatOpacity * 100)}%</span>
            </div>
          </div>

          {/* Twitch Auth Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            {linkedTwitchUsername ? (
              <>
                <p style={{ fontSize: '1em', margin: 0 }}>
                  ✅ Linked as <strong>{linkedTwitchUsername}</strong>
                </p>
                <button
                  className={styles.button}
                  style={{ backgroundColor: '#ff6666', padding: '0.4em 0.6em', fontSize: '0.9em' }}
                  onClick={() => handleTwitchUnlink(showFeedback)}
                >
                  ❌ Unlink
                </button>
              </>
            ) : (
              <button
                onClick={async () => {
                  setIsLinking(true);
                  handleCloseRoom();
                  const username = await handleTwitchLogin(showFeedback);
                  if (username) setLinkedTwitchUsername(username);
                  setIsLinking(false);
                }}
                className={styles.button}
                disabled={isLinking}
              >
                {isLinking ? 'Linking...' : '🔗 Link Twitch Account'}
              </button>
            )}
          </div>
        </div>
      )}

      {currentTab === 'Settings' && (
        <div className={styles.tabContent}>
          <h3>Overlay Controls</h3>
          <ToggleSlider
            label="Use Custom Layout"
            checked={useCustomLayout}
            onChange={() => toggleCustomLayout()}
          />
          <ToggleSlider
            label="Unlock Position Controls"
            checked={enableUnlock}
            onChange={() => toggleUnlock()}
          />
          <ToggleSlider
            label="Show Overlay"
            checked={isVisible}
            onChange={() => setVisibility(!isVisible)}
          />
          <button
            className={styles.button}
            onClick={() => saveOverlayPositions()}
          >
            💾 Save Overlay Positions
          </button>
       </div>
      )}

      {currentTab === 'Developer Tools' && (
        <div className={styles.tabContent}>
          <h3>Developer Tools</h3>
          <button className={styles.button} onClick={() => postDebugCommand('playing')}>▶️ Play</button>
          <button className={styles.button} onClick={() => postDebugCommand('paused')}>⏸ Pause</button>
          <div style={{ marginTop: '10px' }}>
            <label>Skip Seconds:</label>
            <input
              type="number"
              value={skipSeconds}
              onChange={(e) => setSkipSeconds(e.target.value)}
              className={styles.input}
              style={{ width: '60px', marginRight: '5px' }}
            />
            <button className={styles.button} onClick={() => postDebugCommand('skip')}>⏩ Skip</button>
          </div>
          {joinRoomId && (
            <ToggleSlider
              label="Host Current Room"
              checked={isHost}
              onChange={handleHostToggle}
              trueLabel="On"
              falseLabel="Off"
            />
          )}
        </div>
      )}
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
      <Popup />
  );
}
