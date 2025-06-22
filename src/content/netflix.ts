// src/content/netflix.ts
import { VideoSyncController } from './VideoSyncController';

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
      videoId: null,
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

