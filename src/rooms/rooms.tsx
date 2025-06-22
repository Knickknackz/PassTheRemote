// src/rooms/rooms.tsx
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from '../lib/supabaseClient';
import './rooms.css'; // <-- Add the styles from below
import { fetchShowMetadata } from '../lib/showMetadata';
import { getFromStorage, setInStorage } from '../lib/storage'; 


function getVideoUrl(provider: string, video_id: string, current_time: number): string | null {
  const t = Math.floor(current_time || 0);
  switch (provider) {
    case 'Netflix':
      return `https://www.netflix.com${video_id}?t=${t}`;
    case 'Crunchyroll':
      return `https://www.crunchyroll.com${video_id}`;
    default:
      return null;
  }
}

function formatViewers(count: number): string {
  if (count >= 1000) {
    return `${(Math.round(count / 100) / 10).toFixed(1)}k`;
  }
  return count.toLocaleString();
}

function RoomCard({ room, joinRoom }: { room: any; joinRoom: (room: any) => void }) {

  const thumb = room.thumbnail_url
    ? room.thumbnail_url.replace('{width}', '320').replace('{height}', '180')
    : 'https://placehold.co/320x180/1a1a1a/888888?text=Offline';

  return (
    <div className="roomCard">
      {thumb && (
        <div
          className="previewWrapper"
          //Can remove related variables/functions if we remove this. Temp commenting for now
          /*onMouseEnter={() => setPreviewHovered(true)}
          onMouseLeave={() => setPreviewHovered(false)}*/
        >
          <img src={thumb} alt="preview" title={`Watch ${room.twitch_users?.display_name || room.streamer_username || 'Anonymous'} on Twitch!`} className="thumbnail" />
          {room.isLive && <span className="liveBadge">LIVE</span>}
          {room.viewer_count && (
            <span className="viewerBadge">
              {formatViewers(room.viewer_count)} viewers
            </span>
          )}
        </div>
      )}

      <div className="roomContent">
        <div className="streamMeta" title={`Watch ${room.twitch_users?.display_name || room.streamer_username || 'Anonymous'} on Twitch!`}>
          <a
            href={`https://twitch.tv/${room.streamer_username}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="linkMeta"
          >
            <img
              src={room.twitch_users?.profile_image_url || 'https://placehold.co/36x36?text=%3F'}
              alt="avatar"
              className="streamAvatar"
            />
            <div className="streamText" title={room.title || (room.isLive ? 'Untitled Stream' : 'Streamer Offline')}>
              <span className="streamTitle" >
                {room.title || (room.isLive ? 'Untitled Stream' : 'Streamer Offline')}
              </span>
              <span className="streamName">
                {room.twitch_users?.display_name || room.streamer_username || 'Anonymous'}
              </span>
            </div>
          </a>
        </div>
        {(room.show_title || room.episode_title) && (
        <div 
          className="showMeta" 
          onClick={() => joinRoom(room)} 
          title={`Watch ${room.show_title || 'Unknown Show'}${room.episode_title ? ` – ${room.episode_title}` : ''} ${room.provider ? ` on ${room.provider}`: ''}`}
        >
          {room.metadata?.posters?.horizontal?.w360 ? (
            <div className="showMetaPosterWrapper">
              <img
                src={room.metadata.posters.horizontal.w360}
                alt={`${room.show_title} poster`}
                className="showMetaPoster"
              />
              <div className="showMetaOverlay">
                {room.show_title && (
                  <div className="showTitle"><strong>{room.show_title}</strong></div>
                )}
                {(room.episode_title || room.episode_number) ? (
                  <div className="episodeInfo">
                    {room.episode_title}
                    {room.episode_number ? ` — Ep. ${room.episode_number}` : ''}
                  </div>
                ) : (
                  <span className="invisible">Ep. 00</span>
                )}
              </div>
            </div>
          ):(
            <div className="showMetaText">
              {room.show_title && (
                <div className="showTitle">
                  <strong>{room.show_title}</strong>
                </div>
              )}

              <div className="episodeInfo">
                {room.episode_title || room.episode_number ? (
                  <>
                    {room.episode_title}
                    {room.episode_number ? ` — Ep. ${room.episode_number}` : ''}
                  </>
                ) : (
                  <span className="invisible">Ep. 00</span>
                )}
              </div>
            </div>
          )}
        </div>
        )}
        {room.tags && room.tags.length > 0 && (
          <div className="tagsRow">
            {room.provider && (
              <span className={`tag pill ${room.provider.toLowerCase()}`}>
                {room.provider.charAt(0).toUpperCase() + room.provider.slice(1)}
              </span>
            )}

            {room.tags
              .filter(
                (tag) =>
                  tag.toLowerCase() !== room.provider?.toLowerCase()
              )
              .map((tag: string) => (
                <span key={tag} className="tag pill" title={tag}>
                  {tag}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendedRoomsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [platformFilters, setPlatformFilters] = useState<string[]>(['netflix', 'crunchyroll']);

useEffect(() => {
  const fetchRooms = async () => {
    const {
      showLiveOnly,
      platformFilters
    } = await getFromStorage<{
      showLiveOnly?: boolean;
      platformFilters?: string[];
    }>(['showLiveOnly', 'platformFilters']);

    if (typeof showLiveOnly === 'boolean') setShowLiveOnly(showLiveOnly);
    if (Array.isArray(platformFilters)) setPlatformFilters(platformFilters);

    const { data, error } = await supabase
      .from('reactr_rooms')
      .select(`
        host_id,
        room_id,
        provider,
        video_id,
        current_time,
        streamer_username,
        twitch_user_id,
        twitch_users (profile_image_url, display_name),
        show_title,
        episode_title,
        episode_number
      `)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (!data || error) return;

    const twitchIds = data.map(r => r.twitch_user_id).filter(Boolean);

    const liveRes = await fetch('https://gzloumyomschdfkyqwed.supabase.co/functions/v1/get-live-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-extension-auth': 'reactr-ftw-82364',
      },
      body: JSON.stringify({ twitch_user_ids: twitchIds }),
    });

    const { live_streams } = await liveRes.json();
    const liveMap = new Map((live_streams || []).map((stream: any) => [stream.twitch_user_id, stream]));

    const enrichedRooms = await Promise.all(
      data.map(async (room) => {
        if (!room.show_title) return room;

        const meta = await fetchShowMetadata(room.show_title);
        const stream = liveMap.get(room.twitch_user_id);

        return {
          ...room,
          provider: room.provider ? room.provider.charAt(0).toUpperCase() + room.provider.slice(1) : '',
          isLive: !!stream,
          title: stream?.title || null,
          thumbnail_url: stream?.thumbnail_url || null,
          viewer_count: stream?.viewer_count || null,
          tags: stream?.tags || [],
          is_mature: stream?.is_mature || false,
          preview_hover: false,
          metadata: meta,
        };
      })
    );

    enrichedRooms.sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));
    setRooms(enrichedRooms);
  };

  fetchRooms();
}, []);



  const joinRoom = async (room: any) => {
    const roomId = room.room_id;
    if (!roomId) return;

    const { user_id } = await getFromStorage(['user_id']);
    const role = room.host_id === user_id ? 'host' : 'audience';

    await setInStorage({
      roomId,
      role,
      videoId: room.video_id,
      provider: room.provider,
      visible: role !== 'host',
      channelId: room.streamer_username,
    });

    const targetTime = room.current_time || 0;
    const videoUrl = getVideoUrl(room.provider, room.video_id, targetTime);
    if (videoUrl) window.location.href = videoUrl;
  };

  const toggleLiveOnly = () => {
    setShowLiveOnly((prev) => {
      const next = !prev;
      setInStorage({ showLiveOnly: next });
      return next;
    });
  };

  const togglePlatform = (platform: string) => {
    setPlatformFilters((prev) => {
      const next = prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform];
      setInStorage({ platformFilters: next });
      return next;
    });
  };
  
  return (
    <div>
      <div className="filterSection">
        <strong className="filterLabel">🎛 Filters</strong>
        <div className="filterControls">
          <label className="filterToggle">
            <input
              type="checkbox"
              checked={showLiveOnly}
              onChange={toggleLiveOnly}
            />
            Live Only
          </label>
          {['netflix', 'crunchyroll'].map((platform) => (
            <label
              key={platform}
              className={`filterToggle platform-${platform}`}
            >
              <input
                type="checkbox"
                checked={platformFilters.includes(platform)}
                onChange={() => togglePlatform(platform)}
              />
              {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </label>
          ))}
        </div>
      </div>
      <div className="gridContainer">
        {rooms
          .filter((room) =>
            (!showLiveOnly || room.isLive) &&
            platformFilters.includes(room.provider?.toLowerCase())
          )
          .map((room) => (
            <RoomCard key={room.room_id} room={room} joinRoom={joinRoom} />
          ))}
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<RecommendedRoomsPage />);
