// src/content/netflix.ts
import { VideoSyncController } from './VideoSyncController';
import { showCountdownToast, showRoomClosedToast } from './toastUtils';

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

