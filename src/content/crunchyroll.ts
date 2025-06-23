// src/content/crunchyroll.ts
import { VideoSyncController } from './VideoSyncController';

// Crunchyroll requires iframe-only execution
if (!location.hostname.includes("static.crunchyroll.com")) {
  console.log("🚫 Not inside video iframe — skipping Crunchyroll sync script.");
  throw new Error("Not in Crunchyroll iframe context — skip video control.");
}

let videoId: string | null = null;
let showTitle: string | null = null;
let episodeTitle: string | null = null;
let episodeNumber: string | null = null;
let metadataReceived = false;
const pendingResolvers: ((data: {
  videoId: string | null,
  showTitle: string | null,
  episodeTitle: string | null,
  episodeNumber: string | null,
}) => void)[] = [];

function requestMetadataFromParent(): Promise<{
  videoId: string | null;
  showTitle: string | null;
  episodeTitle: string | null;
  episodeNumber: string | null;
}> {
  if (metadataReceived) {
    return Promise.resolve({ videoId, showTitle, episodeTitle, episodeNumber });
  }

  return new Promise((resolve) => {
    pendingResolvers.push((data) => resolve({
      videoId: data.videoId,
      showTitle: data.showTitle,
      episodeTitle: data.episodeTitle,
      episodeNumber: data.episodeNumber,
    }));
    window.parent.postMessage({ type: 'request-video-id' }, '*');
  });
}

function getCrunchyrollVideoId(): string | null {
  return videoId;
}

function setupMetadataListener() {
  if ((window as any)._reactsync_metadata_listener_set) return;
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type === 'video-id') {
      videoId = event.data.videoId;
      showTitle = event.data.showTitle;
      episodeTitle = event.data.episodeTitle;
      episodeNumber = event.data.episodeNumber;
      metadataReceived = true;

      while (pendingResolvers.length > 0) {
        const resolve = pendingResolvers.shift();
        resolve?.({ videoId, showTitle, episodeTitle, episodeNumber });
      }
    }

    if(event.data?.type === 'reset-crunchyroll-controller') {
      controller.reset();
    }

    //listener for marking vilos as relative
    if (event.data?.type === 'reactr-mark-vilos-relative') {
      const enable = !!event.data.payload?.enable;
      const vilos = document.getElementById('vilos');
      if (vilos) {
        if(enable){
          vilos.style.position = 'absolute';
          vilos.style.top = '50%';
          vilos.style.left = '50%';
          vilos.style.transform = 'translate(-50%, -50%)';
          vilos.style.width = '100vw';
          //vilos.style.height = '56.25vw'; // 16:9
          console.log(`📌 #vilos marked position: ${vilos.style.position}`);
        }else{
          vilos.removeAttribute('style');
        }
      }
    }
  });
  (window as any)._reactsync_metadata_listener_set = true;
}

setupMetadataListener();

const controller = new VideoSyncController({
  getProviderId: () => 'crunchyroll',
  getVideoId: getCrunchyrollVideoId,
  getMetadata: requestMetadataFromParent,
  onMetadataReady: ({ showTitle, videoId }) => {console.log("📺 Title:", showTitle); console.log("📺 VideoId:", videoId);},
  generateUrlFromId: (videoId, time) => {
    const timestampParam = time && time > 1 ? `?t=${Math.floor(time)}` : '';
    return `https://www.crunchyroll.com${videoId}${timestampParam}`;
  },
  onSyncMismatch: (url) => {
    window.parent.postMessage({
      type: 'reactsync:navigate',
      videoUrl: url,
      videoId
    }, '*');
  },
  onRoomClosed: () => {
    window.parent.postMessage({ type: 'parent:room-closed' }, '*');
  }
});

controller.init();


let isFakeFullscreen = false;
function hookFullscreenButton(button: HTMLElement) {
  const alreadyHooked = button.getAttribute('data-reactr-hooked');
  if (alreadyHooked) return;
  button.setAttribute('data-reactr-hooked', 'true');

  button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      isFakeFullscreen = !isFakeFullscreen;
      console.log(`🖱️ Intercepted fullscreen click. isFakeFullscreen = ${isFakeFullscreen}`);

      // Notify parent for layout styling
      window.parent.postMessage({ type: 'reactr-fullscreen-toggle', payload: { isFullscreen: isFakeFullscreen },},'*');
      
      // Update button state attribute if Crunchyroll uses it
      button.setAttribute('data-test-state', isFakeFullscreen ? 'open' : 'closed');
    },
    true // ✅ useCapture to intercept before React sees it
  );
}

function startFullscreenWatcher() {
  const root = document.querySelector('.video-player-wrapper') || document.body;

  const observer = new MutationObserver(() => {
    const btns = document.querySelectorAll('[data-testid="vilos-fullscreen_button"]');
    btns.forEach((btn) => {
      if (btn instanceof HTMLElement) {
        hookFullscreenButton(btn);
      }
    });
  });

  observer.observe(root, { childList: true, subtree: true });

  console.log('👀 Watching for fullscreen buttons...');
}

startFullscreenWatcher();