// src/content/netflix.ts
import { VideoSyncController } from './VideoSyncController';

// Toast manager for Netflix content script
const TOAST_CONTAINER_ID = 'reactr-toast-container';
const TOAST_CLASS = 'reactr-toast';
const TOAST_STYLE_ID = 'reactr-toast-style';

function ensureToastContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    Object.assign(container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '99999',
    });
    document.body.appendChild(container);
  }
  // Inject style if not present
  if (!document.getElementById(TOAST_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = TOAST_STYLE_ID;
    style.textContent = `
      .${TOAST_CLASS} {
        min-width: 320px;
        max-width: 90vw;
        margin: 0 auto;
        background: #1fe374;
        color: #000;
        padding: 24px 36px;
        border-radius: 12px;
        font-size: 22px;
        font-family: Inter, sans-serif;
        text-align: center;
        font-weight: bold;
        box-shadow: 0 0 16px rgba(0,0,0,0.3);
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        pointer-events: auto;
        opacity: 0;
        animation: reactr-toast-in 0.2s forwards;
      }
      @keyframes reactr-toast-in {
        from { opacity: 0; transform: translate(-50%, -60%); }
        to { opacity: 1; transform: translate(-50%, -50%); }
      }
    `;
    document.head.appendChild(style);
  }
  return container;
}

function showToast(html: string, duration = 5000, onDone?: () => void) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = TOAST_CLASS;
  toast.innerHTML = html;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
      if (onDone) onDone();
    }, 300);
  }, duration);
  return toast;
}

function showRoomClosedToast() {
  showToast(`
    <div style="margin-bottom: 0.5em;">🚪 Room Closed</div>
    <div>The host has ended this session.</div>
  `);
}

function showCountdownToast(videoUrl: string) {
  let countdown = 3;
  const toast = showToast(`
    <div style="margin-bottom: 0.5em;">🎬 Host switched videos</div>
    <div>Following in <strong>3</strong>...</div>
  `, 4000);
  const countdownLine = () => toast.querySelector('div:nth-child(2) > strong');
  const interval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      const el = countdownLine();
      if (el) el.textContent = `${countdown}`;
    } else {
      clearInterval(interval);
      toast.innerHTML = `<div>🎬 Redirecting now...</div>`;
      setTimeout(() => {
        window.location.href = videoUrl;
      }, 400);
    }
  }, 1000);
}

function extractNetflixMetadata(): Promise<{
  videoId: string | null;
  showTitle: string | null;
  episodeTitle: string | null;
  episodeNumber: string | null;
}> {
  return new Promise((resolve) => {
    const container = document.querySelector('[data-uia="video-title"]');
    if (!container) return resolve({ videoId:null, showTitle: null, episodeTitle: null, episodeNumber: null });

    //let parsedVideoId: string | null = null;
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

    resolve({
      videoId: window.location.pathname,
      showTitle: parsedShowTitle,
      episodeTitle: parsedEpisodeTitle,
      episodeNumber: parsedEpisodeNumber,
    });
  });
}

function watchNetflixDOMForNavigation(triggerReload: () => void) {
  const container = document.querySelector('#appMountPoint') || document.body;
  if (!container) return;

  let lastPath = location.pathname;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver(() => {
    const newPath = location.pathname;
    if (newPath !== lastPath && newPath.startsWith('/watch')) {
      console.log('NEW VIDEO DETECTED');
      lastPath = newPath;
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        triggerReload();
      }, 300);
    }
  });

  observer.observe(container, { childList: true, subtree: true });
}

const controller = new VideoSyncController({
  getVideoId: () => new URL(location.href).pathname,
  getMetadata: extractNetflixMetadata,
  onRoomClosed: showRoomClosedToast,
  onInit: () => console.log("🌀 Netflix: Controller is starting..."),
  //onVideoFound: (video) => video.style.border = '2px solid lime',
  onMetadataReady: ({ showTitle }) => console.log("📺 Title:", showTitle),
  getProviderId: () => 'netflix',
  onSyncMismatch: (url) => {
    showCountdownToast(url);
  },
  generateUrlFromId: (videoId, time) => {
    const timestampParam = time && time > 0 ? `?t=${Math.floor(time)}` : '';
    return `https://www.netflix.com${videoId}${timestampParam}`;
  }
});

controller.init();

watchNetflixDOMForNavigation(() => {
  controller.reset();
});

