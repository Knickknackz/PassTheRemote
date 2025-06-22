/*console.log("✅ Crunchyroll:ReactSync content script loaded on: " + location.hostname);

if (!location.hostname.includes("static.crunchyroll.com")) {
  console.log("🚫 Not inside video iframe — skipping script.");
  throw new Error("Not in iframe context — skip video control.");
}

let video: HTMLVideoElement | null = null;
let userRole: 'host' | 'audience' = 'audience';
let suppressEvents = false;
let videoReady = false;
let videoId: string | null = null;
let showTitle: string | null = null;
let episodeTitle: string | null = null;
let episodeNumber: string | null = null;
let currentBoundVideo: HTMLVideoElement | null = null;
let currentMessageHandler: ((msg: any, sender: any, sendResponse: any) => void) | null = null;
let metadataReceived = false;
let pendingResolvers: ((data: {
    videoId: string | null,
    showTitle: string | null,
    episodeTitle: string | null,
    episodeNumber: string | null,
  }) => void)[] = [];

function registerIfNeeded() {
  const video = document.querySelector('video');
  if (video) {
    chrome.runtime.sendMessage({ type: 'register-content' });
    window.addEventListener('unload', () => {
      chrome.runtime.sendMessage({ type: 'unregister-content' });
    });
  } else {
    console.log("📭 Skipped registration — no video element in this frame.");
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
  if(userRole == 'host') sendState(video);
  console.log("🎬 Playback event listeners registered Test1");
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
        console.log("🎭 Role updated via popup:", userRole);
        break;
      case 'sync-update':
        if ((detectProvider() !== msg.provider || videoId !== msg.video_id) && userRole == 'audience' && msg.video_id != null && msg.video_id !== 'debug') {
            chrome.storage.local.set({ videoId: msg.video_id, provider: msg.provider });
            window.parent.postMessage({
              type: 'reactsync:navigate',
              videoUrl: generateUrlFromVideoId(msg.provider, msg.video_id, msg.time),
              videoId: videoId,
            }, '*');
            return;
        }

        suppressEvents = true;

        if (Math.abs(video.currentTime - msg.time) > 5) {
          video.currentTime = msg.time;
        }

        if (msg.state === 'playing') {
          video.play();
        }else if(msg.state === 'paused'){
          video.pause();
        }else if(msg.state === 'skip'){
          video.currentTime = msg.time;
        }

        setTimeout(() => { suppressEvents = false; }, 1000);
        break;
      case 'room-closed':
        window.parent.postMessage({ type: "parent:room-closed" }, "*");
        break;
      case 'request-state':
        sendState(video);
        break;
      default:
        console.log("❓ Unknown message type:", msg.type);
    }

    sendResponse?.();
  };

    chrome.runtime.onMessage.addListener(handler);
    currentMessageHandler = handler;
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

function handleMetadataMessage(event: MessageEvent) {
  if (event.data?.type === 'video-id') {
    videoId = event.data.videoId;
    showTitle = event.data.showTitle;
    episodeTitle = event.data.episodeTitle;
    episodeNumber = event.data.episodeNumber;
    metadataReceived = true;

    // Resolve all pending promises
    pendingResolvers.forEach(resolve =>
      resolve({ videoId, showTitle, episodeTitle, episodeNumber })
    );
    pendingResolvers = [];
  }
}

function requestVideoIdFromParent(): Promise<{
  videoId: string | null;
  showTitle: string | null;
  episodeTitle: string | null;
  episodeNumber: string | null;
}> {
  if (metadataReceived) {
    return Promise.resolve({ videoId, showTitle, episodeTitle, episodeNumber});
  }

  return new Promise((resolve) => {
    pendingResolvers.push(resolve);
    window.parent.postMessage({ type: 'request-video-id' }, '*');
  });
}

async function tryFindVideo() {
  if (videoReady) return;
  
  const found = document.querySelector('video') as HTMLVideoElement | null;
  if (!found) {
    console.log("⏳ Still waiting for video element...");
    setTimeout(tryFindVideo, 1000);
    return;
  }

  await requestVideoIdFromParent();
  video = found;
  videoReady = true;

  console.log("🎬 Found video element. Current time:", video.currentTime);

  setupVideoSync(video);
  registerIfNeeded(); 
}

async function init() {
  userRole = await loadUserRole();

  tryFindVideo();
}

if (!(window as any)._reactsync_metadata_listener_set) {
  window.addEventListener('message', handleMetadataMessage);
  (window as any)._reactsync_metadata_listener_set = true;
}

init();

*/