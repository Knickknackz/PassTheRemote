/*console.log("✅ Netflix:ReactSync content script loaded on:", location.hostname);

if (!location.hostname.includes("www.netflix.com")) {
  console.log("🚫 Not inside Netflix context — skipping script.");
  throw new Error("Not in Netflix Netflix context — skip video control.");
}

let video: HTMLVideoElement | null = null;
let userRole: 'host' | 'audience' = 'audience';
let suppressEvents = false; //Controls Delay on API calls, has a timeout
let videoReady = false;
let videoId: string | null = null; // no longer nullable
let showTitle: string | null = null;
let episodeTitle: string | null = null;
let episodeNumber: string | null = null;
let currentBoundVideo: HTMLVideoElement | null = null;
let currentMessageHandler: ((msg: any, sender: any, sendResponse: any) => void) | null = null;
let netflixOverlayObserver: MutationObserver | null = null;


function resolveVideoId(): string | null {

  videoId = new URL(location.href).pathname; // e.g. "/watch/81215567"
}

function registerIfNeeded() {
  const video = document.querySelector('video');
  if (video) {
    chrome.runtime.sendMessage({ type: 'register-content' });
    window.addEventListener('unload', () => {
      chrome.runtime.sendMessage({ type: 'unregister-content' });
    });
  } else {
    console.log("📭 Skipped registration — no video element found.");
  }
}

function loadUserRole(): Promise<'host' | 'audience'> {
  return new Promise((resolve) => {
    chrome.storage.local.get('role', ({ role }) => {
      const resolvedRole = role === 'host' ? 'host' : 'audience';
      console.log("🎭 Role detected:", resolvedRole);
      resolve(resolvedRole);
    });
  });
}

function detectProvider(): string {
  if (location.hostname.includes('crunchyroll')) return 'crunchyroll';
  if (location.hostname.includes('netflix')) return 'netflix';
  return 'unknown';
}

function sendState(video: HTMLVideoElement){
  console.log('send state check');
  if (suppressEvents || userRole !== 'host') return;
  console.log('send state confirmed');
  const provider = detectProvider();
  chrome.runtime.sendMessage({
    type: "video-update",
    play_state: video.paused ? "paused" : "playing",
    current_time: video.currentTime,
    video_id: videoId,
    provider: provider,
    show_title: showTitle,
    episode_title: episodeTitle,
    episode_number: episodeNumber
  });
};

function setupVideoSync(video: HTMLVideoElement) {
    const handler = () => sendState(video);
    if (currentBoundVideo) {
      currentBoundVideo.removeEventListener('play', handler);
      currentBoundVideo.removeEventListener('pause', handler);
      currentBoundVideo.removeEventListener('seeked', handler);
    }

    video.addEventListener("pause", handler);
    video.addEventListener("play", handler);
    video.addEventListener("seeked", handler);
    setupMessageListener(video);
    currentBoundVideo = video;
    if(userRole == 'host') sendState(video);//send update on load if host
    console.log("🎬 Netflix: Playback event listeners registered");
}

function setupMessageListener(video: HTMLVideoElement) {
  if (currentMessageHandler) {
    chrome.runtime.onMessage.removeListener(currentMessageHandler);
    console.log("🧹 Removed old message listener");
  }

  const handler = (msg: any, _sender: any, sendResponse: any) => {
    if (!video) return;
    console.log(msg);

    switch (msg.type) {
      case 'role-update':
        userRole = msg.role;
        console.log("🎭 Netflix role updated:", userRole);
        break;

      case 'sync-update':
        if ((detectProvider() !== msg.provider || videoId !== msg.video_id) &&
            userRole === 'audience' &&
            msg.video_id != null &&
            msg.video_id !== 'debug') {
          chrome.storage.local.set({ videoId: msg.video_id, provider: msg.provider });
          const videoUrl = generateUrlFromVideoId(msg.provider, msg.video_id, msg.time);
          showCountdownToast(videoUrl);
          return;
        }

        suppressEvents = true;

        if (msg.state === 'playing') {
          video.play();
        } else if (msg.state === 'paused') {
          video.pause();
        } else if (msg.state === 'skip') {
          const skipSeconds = typeof msg.time === 'number' ? Math.floor(msg.time) : 0;
          const url = new URL(location.href);
          url.searchParams.set('t', skipSeconds.toString());
          location.href = url.toString();
          console.log(`⏩ Reloading with ?t=${skipSeconds}`);
        }

        setTimeout(() => (suppressEvents = false), 1000);
        break;
      case 'request-state':
        sendState(video);
        break;
      case 'room-closed':
        showRoomClosedToast();
        break;
      default:
        console.log("❓ Unknown message type:", msg.type);
    }

    sendResponse?.();
  };

  chrome.runtime.onMessage.addListener(handler);
  currentMessageHandler = handler;
}

function showRoomClosedToast() {
  const toast = document.createElement('div');
  toast.innerHTML = `
    <div style="margin-bottom: 0.5em;">🚪 Room Closed</div>
    <div>The host has ended this session.</div>
  `;
  Object.assign(toast.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#1fe374',
    color: '#000',
    padding: '24px 36px',
    borderRadius: '12px',
    zIndex: '99999',
    fontSize: '22px',
    fontFamily: 'Inter, sans-serif',
    textAlign: 'center',
    fontWeight: 'bold',
    boxShadow: '0 0 16px rgba(0,0,0,0.3)',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function showCountdownToast(videoUrl: string) {
  const toast = document.createElement('div');
  toast.innerHTML = `
    <div style="margin-bottom: 0.5em;">🎬 Host switched videos</div>
    <div>Following in <strong>3</strong>...</div>
  `;

  Object.assign(toast.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#1fe374',
    color: '#000',
    padding: '24px 36px',
    borderRadius: '12px',
    zIndex: '99999',
    fontSize: '22px',
    fontFamily: 'Inter, sans-serif',
    textAlign: 'center',
    fontWeight: 'bold',
    boxShadow: '0 0 16px rgba(0,0,0,0.3)',
  });

  document.body.appendChild(toast);

  let countdown = 3;
  const countdownLine = toast.querySelector('div:nth-child(2) > strong');

  const interval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      if (countdownLine) countdownLine.textContent = `${countdown}`;
    } else {
      clearInterval(interval);
      toast.innerHTML = `<div>🎬 Redirecting now...</div>`;
      setTimeout(() => {
        window.location.href = videoUrl;
      }, 400);
    }
  }, 1000);
}

function generateUrlFromVideoId(provider: string, videoId: string, time?: number | null): string {
  const timestampParam = time && time > 0 ? `?t=${Math.floor(time)}` : '';

  switch (provider) {
    case 'crunchyroll':
      return `https://www.crunchyroll.com${videoId}${timestampParam}`;
    case 'netflix':
      return `https://www.netflix.com${videoId}${timestampParam}`;
    default:
      return location.href;
  }
}

  function setupEpisodeWatch() {
    const player = document.querySelector('[data-uia="player"]') as HTMLElement | null;
    if (!player) {
      console.warn('🚫 Netflix player container not found');
      return;
    }

    // Always clear existing observer first
    if (netflixOverlayObserver) {
      netflixOverlayObserver.disconnect();
      netflixOverlayObserver = null;
    }

    const extractAndLogMetadata = (): boolean => {
      const container = document.querySelector('[data-uia="video-title"]');
      if (!container) return false;

      let parsedShowTitle: string | null = null;
      let parsedEpisodeNumber: string | null = null;
      let parsedEpisodeTitle: string | null = null;

      const h4 = container.querySelector('h4');
      const spans = container.querySelectorAll('span');

      if (h4 && spans.length >= 2) {
        parsedShowTitle = h4.textContent?.trim() || null;
        parsedEpisodeNumber = spans[0]?.textContent?.trim() || null;
        parsedEpisodeTitle = spans[1]?.textContent?.trim() || null;
      } else {
        parsedShowTitle = container.textContent?.trim() || null;
      }

      if (parsedShowTitle) {
        // ✅ Update globals
        showTitle = parsedShowTitle;
        episodeNumber = parsedEpisodeNumber;
        episodeTitle = parsedEpisodeTitle;

        console.log('🎬 Netflix metadata:', {
          showTitle,
          episodeNumber,
          episodeTitle,
        });

        return true;
      }

      return false;
    };

    // ✅ Try immediately if player is already active
    if (player.classList.contains('active')) {
      const found = extractAndLogMetadata();
      if (found) return; // Skip observer — data already handled
    }

    // 🔁 Start observer only if data not already found
    netflixOverlayObserver = new MutationObserver(() => {
      const className = player.className;

      if (className.includes('active')) {
        const found = extractAndLogMetadata();
        if (found) {
          netflixOverlayObserver?.disconnect();
          netflixOverlayObserver = null;
          console.log('🛑 Metadata found via observer — observer disconnected.');
        }
      }
    });

    netflixOverlayObserver.observe(player, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

function tryFindVideo() {
  if(videoReady) return;

  const found = document.querySelector('video') as HTMLVideoElement | null;
  
  if (!found) {
    console.log("⏳ Netflix: Waiting for video element...");
    setTimeout(tryFindVideo, 1000);
    return;
  }

  video = found;
  videoReady = true;

  console.log("🎬 Netflix: Found video", video.currentTime);
  setupEpisodeWatch();
  setupVideoSync(video);
  registerIfNeeded();
}

async function init() {
  userRole = await loadUserRole();
  resolveVideoId();
  console.log("📡 Netflix: Using video ID:", videoId);

  if(videoId?.startsWith('/watch')) tryFindVideo();
  watchNetflixDOMForNavigation();
}

function watchNetflixDOMForNavigation() {
  const container = document.querySelector('#appMountPoint') || document.body;
  if (!container) {
    console.warn("❌ Couldn't find Netflix root container");
    return;
  }

  let lastPath = location.pathname;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver(() => {
    const newPath = location.pathname;

    if (newPath !== lastPath) {
      console.log("🧬 Netflix DOM mutation → possible route change:", newPath);
      lastPath = newPath;

      if (newPath.startsWith('/watch')) {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          console.log("🎬 Triggering tryFindVideo() from MutationObserver");
          resolveVideoId();
          videoReady = false;
          tryFindVideo();
        }, 300);
      }
    }
  });

  observer.observe(container, { childList: true, subtree: true });

  console.log("👁️ Watching Netflix DOM for changes");
}

init();
*/