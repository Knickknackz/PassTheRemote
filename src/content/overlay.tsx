import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getFromStorage } from '../lib/storage';
import HostTimeStatus from './HostTimeStatus';
import React from 'react';

console.log("✅ OVERLAY loaded on: " + location.hostname);

function LiveStatusBadge() {
  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      left: '12px',
      backgroundColor: 'rgba(255,0,0,0.8)',
      color: 'white',
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: 'bold',
      zIndex: 9999,
      pointerEvents: 'none',
    }}>
      🔴 Live on PassTheRemote
    </div>
  );
}

function DraggableResizable(
  { customLayout, unlocked, iframeSrc, title, docked, streamEnabled = false}: 
  { customLayout: boolean; unlocked: boolean; iframeSrc: string; title: string; docked: boolean; streamEnabled?: boolean; }
){
  const [position, setPosition] = useState({ x: 0.8, y: (title === 'Twitch Chat' ? .28 : 0)});
  const [size, setSize] = useState({ width: .2 , height: (title === 'Twitch Chat' ? .6 : .28)});
  const [opacity, setOpacity] = useState(1);
  const savedOverlayRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const resizeDirection = useRef<string | null>(null);
  const wasDragging = useRef(false);
  const wasResizing = useRef(false);
  const livePosition = useRef(position);
  const liveSize = useRef(size);

  if(!customLayout) unlocked = false;

  useEffect(() => { livePosition.current = position; }, [position]);
  useEffect(() => { liveSize.current = size; }, [size]);
  
  useEffect(() => {
    if (!customLayout) {
      return;
    }
    const el = ref.current;
    if (!el) return;

    let isDragging = false;
    let isResizing = false;
    let startX = 0;
    let startY = 0;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const edge = target.dataset.edge || null;

      if (edge && unlocked) {
        isResizing = true;
        resizeDirection.current = edge;
        wasResizing.current = true;
      } else if (target.classList.contains('drag-handle') && unlocked) {
        isDragging = true;
        wasDragging.current = true;
      }

      if (isDragging || isResizing) {
        startX = e.clientX;
        startY = e.clientY;
        target.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const root = document.getElementById('reactsync-root');
      const rect = root?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;

      if (isDragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        setPosition((prev) => ({
          x: Math.max(0, Math.min(1, prev.x + dx / rect.width)),
          y: Math.max(0, Math.min(1, prev.y + dy / rect.height))
        }));
        startX = e.clientX;
        startY = e.clientY;
      } else if (isResizing && resizeDirection.current) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        setSize((prev) => {
          let newWidth = prev.width;
          let newHeight = prev.height;

          const dir = resizeDirection.current;
          const isStream = title === 'Twitch Stream';

          if (isStream) {
            // Maintain 16:9 aspect ratio for stream overlay
            if (dir?.includes('right') || dir?.includes('left')) {
              newWidth = dir.includes('right')
                ? Math.max(0.05, prev.width + dx / rect.width)
                : Math.max(0.05, prev.width - dx / rect.width);
              newWidth = Math.min(newWidth, 1); // Clamp to 100% width
              newHeight = newWidth * 9 / 16;
              if (newHeight > 1) {
                newHeight = 1;
                newWidth = newHeight * 16 / 9;
              }
              if (dir?.includes('left')) {
                setPosition((prevPos) => ({
                  ...prevPos,
                  x: Math.max(0, Math.min(1, prevPos.x + dx / rect.width))
                }));
              }
            } else if (dir?.includes('top') || dir?.includes('bottom')) {
              newHeight = dir.includes('bottom')
                ? Math.max(0.05, prev.height + dy / rect.height)
                : Math.max(0.05, prev.height - dy / rect.height);
              newHeight = Math.min(newHeight, 1); // Clamp to 100% height
              newWidth = newHeight * 16 / 9;
              if (newWidth > 1) {
                newWidth = 1;
                newHeight = newWidth * 9 / 16;
              }
              if (dir?.includes('top')) {
                setPosition((prevPos) => ({
                  ...prevPos,
                  y: Math.max(0, Math.min(1, prevPos.y + dy / rect.height))
                }));
              }
            }
          } else {
            // Chat or other overlays: free resize
            if (dir?.includes('right')) newWidth = Math.max(0.05, prev.width + dx / rect.width);
            if (dir?.includes('bottom')) newHeight = Math.max(0.05, prev.height + dy / rect.height);
            if (dir?.includes('left')) {
              newWidth = Math.max(0.05, prev.width - dx / rect.width);
              setPosition((prevPos) => ({
                ...prevPos,
                x: Math.max(0, Math.min(1, prevPos.x + dx / rect.width))
              }));
            }
            if (dir?.includes('top')) {
              newHeight = Math.max(0.05, prev.height - dy / rect.height);
              setPosition((prevPos) => ({
                ...prevPos,
                y: Math.max(0, Math.min(1, prevPos.y + dy / rect.height))
              }));
            }
            // Clamp to 100% of container
            newWidth = Math.min(newWidth, 1);
            newHeight = Math.min(newHeight, 1);
          }

          return { width: newWidth, height: newHeight };
        });
        startX = e.clientX;
        startY = e.clientY;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      isResizing = false;
      wasDragging.current = false;
      wasResizing.current = false;
      resizeDirection.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
    };
  }, [unlocked, customLayout]);

  useEffect(() => {
    (async () => {const {overlays,streamOpacity,chatOpacity
        } = await getFromStorage<{
          overlays?: Record<string, any>;
          streamOpacity?: number;
          chatOpacity?: number;
        }>(['overlays', 'streamOpacity', 'chatOpacity']);
        console.log(overlays);
        const key = title === 'Twitch Chat' ? 'chat' : 'stream';
        const saved = overlays?.[key];
        const stored = title === 'Twitch Chat' ? chatOpacity : streamOpacity;

        console.log(saved);
        console.log('saved');

        if (saved) {
          setPosition({ x: saved.x, y: saved.y });
          setSize({
            width: saved.width,
            height: saved.height
          });
        }

        if (typeof stored === 'number') {
          setOpacity(stored);
        }
      })();

    const handleOpacityChange = (changes: any, areaName: string) => {
      if (areaName !== 'local') return;
      if (changes.streamOpacity && title === 'Twitch Stream') setOpacity(changes.streamOpacity.newValue);
      if (changes.chatOpacity && title === 'Twitch Chat') setOpacity(changes.chatOpacity.newValue);
    };

    chrome.storage.onChanged.addListener(handleOpacityChange);
    return () => chrome.storage.onChanged.removeListener(handleOpacityChange);
  }, []);

  useEffect(() => {
    if (!customLayout) {
      return;
    }
    
    // customLayout is true — apply saved position if available
    const saved = savedOverlayRef.current;

    if (saved) {
      setPosition({ x: saved.x, y: saved.y });
      setSize({
        width: saved.width,
        height: saved.height
      });
    }
  }, [customLayout]);
  
  const isChat = title === 'Twitch Chat';
  // For stream overlay, use vw/vh for true 16:9 aspect ratio
  const overlayStyle: React.CSSProperties = {
      position: docked ? 'relative' : 'absolute',
      ...(docked
        ? {
            height: isChat ? '' : '11.25vw',
            width: '20vw',
            flex: isChat ? '1' : '',
            borderRadius: '0px'
          }
        : customLayout
          ? {
              top: `${position.y * 100}%`,
              left: `${position.x * 100}%`,
              width: `${size.width * 100}vw`,
              borderRadius: '12px',
              height: isChat
                ? `${size.height * 100}%`
                : `${size.width * 100 * 9 / 16}vw`, // 16:9 aspect ratio for stream
            }
          : {
              top: (isChat && streamEnabled) ? '11.25vw' : '0%',
              height: isChat ? (streamEnabled ? '55%' : '83%')  : '11.25vw',
              right: '0%',
              width: '20vw',
              borderRadius: isChat ? '0px 0px 0px 12px' : '12px 0px 0px 0px',
            }
      ),
      background: 'black',
      border: unlocked ? '2px dashed lime' : 'none',
      boxShadow: unlocked ? '0 0 8px lime' : 'none',
      zIndex: 10,
      overflow: 'hidden',
      opacity,
      transition: 'opacity 0.2s ease',
  };

  return (
    <div
      ref={ref}
      style={overlayStyle}
    >
      <iframe
        src={iframeSrc}
        width="100%"
        height="100%"
        allowFullScreen
        frameBorder="0"
        title={title}
        style={{
          opacity,
          transition: 'opacity 0.2s ease',
          pointerEvents: unlocked ? 'none' : 'auto',
        }}
      />

      {unlocked && (
        <>
          <div className="drag-handle" style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            cursor: 'move', zIndex: 8, pointerEvents: 'auto',
          }} />

          {['top', 'right', 'bottom', 'left'].map((edge) => (
            <div
              key={`edge-${edge}`}
              data-edge={edge}
              style={{
                position: 'absolute',
                ...(edge === 'top' && { top: 0, left: 10, right: 10, height: 10 }),
                ...(edge === 'bottom' && { bottom: 0, left: 10, right: 10, height: 10 }),
                ...(edge === 'left' && { top: 10, bottom: 10, left: 0, width: 10 }),
                ...(edge === 'right' && { top: 10, bottom: 10, right: 0, width: 10 }),
                cursor: edge === 'top' || edge === 'bottom' ? 'ns-resize' : 'ew-resize',
                zIndex: 9, pointerEvents: 'auto',
              }}
            />
          ))}

          {[
            ['top-left', 'nwse-resize'],
            ['top-right', 'nesw-resize'],
            ['bottom-left', 'nesw-resize'],
            ['bottom-right', 'nwse-resize']
          ].map(([edge, cursor]) => (
            <div
              key={`corner-${edge}`}
              data-edge={edge}
              style={{
                position: 'absolute',
                ...(edge.includes('top') && { top: 0 }),
                ...(edge.includes('bottom') && { bottom: 0 }),
                ...(edge.includes('left') && { left: 0 }),
                ...(edge.includes('right') && { right: 0 }),
                width: 16,
                height: 16,
                cursor,
                backgroundColor: 'rgba(0,0,0,0.05)',
                zIndex: 10,
                pointerEvents: 'auto',
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

function Overlay() {
  const [channel, setChannel] = useState<string>('');
  const [showChat, setShowChat] = useState<boolean>(true);
  const [showStreamer, setShowStreamer] = useState<boolean>(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [useCustomLayout, setUseCustomLayout] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [showDocked, setShowDocked] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomId, setRoomId] = useState<string | null>('');
  const [showHostTimeStatus, setShowHostTimeStatus] = useState(false);
  const fadeTimer = useRef<NodeJS.Timeout | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  
  //
  useEffect(() => {
    const checkUrl = (videoIdToCheck: string) => {
      if (!videoIdToCheck) return;
      const isMatch = location.href.includes(videoIdToCheck);
      console.log('checkUrl', isMatch);

      const container = document.getElementById('reactsync-root');
      if (!container) return;

      if (isMatch) {
        container.style.display = 'block';
        void container.offsetWidth;
        container.style.opacity = '1';
      } else {
        container.style.opacity = '0';
        setTimeout(() => {
          if (parseFloat(container.style.opacity) === 0) {
            container.style.display = 'none';
          }
        }, 1000);
      }
    };

    (async () => {const { channelId, showStreamer, showChat, unlocked, visible, docked, customLayout, videoId, role, roomId} 
    = await getFromStorage<{
        channelId?: string;
        showStreamer?: boolean;
        showChat?: boolean;
        unlocked?: boolean;
        visible?: boolean;
        docked?: boolean;
        customLayout?: boolean;
        videoId?: string;
        role?: string;
        roomId?: string;
      }>([
        'channelId', 'showStreamer', 'showChat', 'unlocked', 'visible', 'docked',
        'customLayout', 'videoId', 'role', 'roomId'
      ]);

      setChannel(channelId || '');
      setShowChat(!!showChat);
      setShowStreamer(!!showStreamer);
      setIsUnlocked(!!unlocked);
      setUseCustomLayout(!!customLayout);
      setIsVisible(!!visible);
      setIsDocked(!!docked);
      setIsHost(role === 'host');
      setRoomId(roomId || '');
      checkUrl(videoId || '');
    })();

    const handleStorageChangeInOverlay = (changes: any, areaName: string) => {
      if (areaName !== 'local') return;
      if (changes.unlocked) setIsUnlocked(!!changes.unlocked.newValue);
      if (changes.visible) setIsVisible(!!changes.visible.newValue);
      if (changes.docked) setIsDocked(!!changes.docked.newValue);
      if (changes.customLayout) setUseCustomLayout(!!changes.customLayout.newValue);
      if (changes.showStreamer) setShowStreamer(!!changes.showStreamer.newValue);
      if (changes.showChat) setShowChat(!!changes.showChat.newValue);
      if (changes.channelId) setChannel(changes.channelId.newValue);
      if (changes.role) setIsHost(changes.role.newValue === 'host');
      if (changes.roomId) setRoomId(changes.roomId.newValue);
      if (changes.videoId) {
        const newId = changes.videoId.newValue;
        checkUrl(newId); // ✅ use local value
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChangeInOverlay);

    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        console.log('Overlay Change Detected');
        lastUrl = location.href;
        getFromStorage<{ videoId: string }>(['videoId']).then(({ videoId }) => checkUrl(videoId));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChangeInOverlay);
      observer.disconnect();
    };
  }, []);


  //Handles "Docking" (ONLY WORKS IN CRUNCHYROLL ATM)
  useEffect(() => {
    const wrapper = document.querySelector('.video-player-wrapper');
    const player = document.querySelector('.video-player');
    if (!wrapper || !player){
      setShowDocked(false);
      return;
    } 

    // Save previous styles
    const prevWrapperDisplay = wrapper.style.display;
    const prevPlayerHeight = player.style.height;

    wrapper.style.display = isDocked && isVisible ? 'flex' : '';
    player.style.height = isDocked && isVisible ? 'auto' : '100%';
    setShowDocked(isDocked);
    return () => {
      // Restore previous styles on cleanup
      wrapper.style.display = prevWrapperDisplay;
      player.style.height = prevPlayerHeight;
    };
  }, [isDocked, isVisible]);

  return (
    <div
      ref={rootRef}
      style={{
        width:'100%',
        height:'100%',
        pointerEvents: 'none', // allows interaction with underlying UI
      }}
      onMouseMove={() => {
        setShowHostTimeStatus(true);
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
        fadeTimer.current = setTimeout(() => {
          setShowHostTimeStatus(false);
        }, 3000);
      }}
    >
      <div id='ptr-stats'
        style={{
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          position: 'absolute', // or 'fixed' if you want it to always cover the viewport
          top: 0,
          left: 0,
          zIndex: 9999,
        }}
      >
        {!isHost && roomId && (<HostTimeStatus isVisible={showHostTimeStatus}/>)}
        {(isHost) && (<LiveStatusBadge />)}
      </div>
      <div style={{ 
        visibility: isVisible ? 'visible' : 'hidden', 
        width: '100%',
        height: '100%',
        ...((showDocked && isVisible) ? { display: 'flex', flexDirection: 'column'} : { display:'block'}),
        }}>
        {(channel && showStreamer)&& (
          <DraggableResizable
            customLayout={useCustomLayout}
            unlocked={isUnlocked}
            docked={showDocked}
            iframeSrc={`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`}
            title="Twitch Stream"
          />
        )}
        {(channel && showChat) && (
          <DraggableResizable 
            streamEnabled={showStreamer}
            customLayout={useCustomLayout}
            unlocked={isUnlocked} 
            docked={showDocked}
            iframeSrc={`https://www.twitch.tv/embed/${channel}/chat?parent=${window.location.hostname}`} 
            title="Twitch Chat" />
        )}
      </div>
    </div>
  );
}

function waitForElement(selector: string, timeout = 10000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout: ${selector} not found after ${timeout}ms`));
    }, timeout);
  });
}

export function mountOverlayTo(target: HTMLElement) {
  const rootId = 'reactsync-root';
  const existing = document.getElementById(rootId);
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = rootId;
  container.style.transition = 'opacity 1s ease';
  container.style.pointerEvents = 'none';
  target.appendChild(container);
  createRoot(container).render(<Overlay />);
}

function safeMountOverlay() {
  const tryMount = async () => {
    const isCrunchyroll = location.hostname.includes('crunchyroll.com');
    const isNetflix = location.hostname.includes('netflix.com');
    try {
      let target: Element | null;
      if (isCrunchyroll) {
        target = await waitForElement('.video-player-wrapper', 10000);
      } else if (isNetflix) {
        target = await waitForElement('.watch-video', 10000);
      }else{
        target = document.fullscreenElement || document.body;
        if (!target) {
          requestAnimationFrame(tryMount); // Wait and retry on next frame
          return;
        }
      }

      console.log(`✅ Mounting overlay to:`, target);
      mountOverlayTo(target as HTMLElement);
    } catch (e) {
      console.warn('⚠️ Could not mount overlay, falling back to <body>:', e);
      mountOverlayTo(document.body);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(tryMount, 0));
  } else {
    setTimeout(tryMount, 0);
  }
}

safeMountOverlay();

export function getCurrentOverlayStates() {
  const root = document.getElementById('reactsync-root');
  if (!root) {
    console.warn('⚠️ getCurrentOverlayStates: #reactsync-root not found');
    return {};
  }

  const overlayRect = root.getBoundingClientRect();
  if (overlayRect.width === 0 || overlayRect.height === 0) {
    console.warn('⚠️ #reactsync-root has zero size');
    return {};
  }

  const elements = document.querySelectorAll('[title^="Twitch"]');
  const overlays: Record<string, any> = {};

  elements.forEach((el) => {
    const elRect = el.getBoundingClientRect();
    const title = el.getAttribute('title');
    if (!title || elRect.width === 0 || elRect.height === 0) return;

    const key = title === 'Twitch Chat' ? 'chat' : 'stream';

    overlays[key] = {
      x: (elRect.left - overlayRect.left) / overlayRect.width,
      y: (elRect.top - overlayRect.top) / overlayRect.height,
      width: elRect.width / overlayRect.width,
      height: elRect.height / overlayRect.height,
    };
  });

  return overlays;
}
(window as any).ReactSync_getCurrentOverlayStates = getCurrentOverlayStates;