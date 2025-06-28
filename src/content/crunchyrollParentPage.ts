import { showCountdownToast, showRoomClosedToast } from './toastUtils';

console.log("🧠 Parent page content script active for Netflix");
// Listen for video ID requests from the iframe

window.addEventListener("message", (event) => {
    if (event.data?.type === "request-video-id") {
      sendVideoDataToChild();
    }
    if (event.data?.type === 'reactsync:navigate') {
      showCountdownToast(event.data.videoUrl);
    }
    if(event.data?.type === 'parent:room-closed'){
      showRoomClosedToast();
    }
    if(event.data?.type === 'room-closed'){
      console.log('PARENT CAN CATCH ROOM CLOSED');
    }
});

async function watchCrunchyrollDOMForNavigation() {
  const container = document.querySelector('#appMountPoint') || document.body;
  if (!container) {
    console.warn("❌ Couldn't find Crunchyroll root container");
    return;
  }

  let lastPath = location.pathname;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    const newPath = location.pathname;

    if (newPath !== lastPath) {
      console.log("🧬 Netflix DOM mutation → possible route change:", newPath, lastPath);

      lastPath = newPath;
      
      if (newPath.startsWith('/watch')) {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          console.log("🎬 Triggering tryFindVideo() from MutationObserver");
          resetController();
        }, 300);
      }
    }
  });

  observer.observe(container, { childList: true, subtree: true });

  console.log("👁️ Watching Crunchyroll DOM for changes");
}

function resetController() {
  const iframe = document.querySelector('iframe.video-player') as HTMLIFrameElement | null;
  const targetWindow = iframe?.contentWindow;
  targetWindow?.postMessage({ 
    type: "reset-crunchyroll-controller"
  }, "*");
}

function sendVideoDataToChild(){
  const iframe = document.querySelector('iframe.video-player') as HTMLIFrameElement | null;
  const targetWindow = iframe?.contentWindow;
  const { showTitle, episodeTitle, episodeNumber } = getCrunchyrollTitles();
  
  targetWindow?.postMessage({ 
    type: "video-id", 
    videoId:window.location.pathname, 
    showTitle, 
    episodeTitle,
    episodeNumber
  }, "*");
}

function getCrunchyrollTitles(): {
  showTitle: string | null;
  episodeTitle: string | null;
  episodeNumber: string | null;
} {
  const meta = document.querySelector('meta[property="og:title"]');
  if (!meta) {
    return { showTitle: null, episodeTitle: null, episodeNumber: null };
  }

  const content = meta.getAttribute('content') || '';
  const [showTitleRaw, episodeTitleRaw] = content.split(' | ', 2);

  const showTitle = showTitleRaw?.trim() || null;
  let episodeTitle = episodeTitleRaw?.trim() || null;
  let episodeNumber: string | null = null;

  if (episodeTitle) {
    const match = episodeTitle.match(/^E(\d+)\s*[-:]?\s*(.*)$/i);
    if (match) {
      episodeNumber = `E${match[1]}`;
      episodeTitle = match[2]?.trim() || null;
    }
  }

  return {
    showTitle,
    episodeTitle,
    episodeNumber,
  };
}

watchCrunchyrollDOMForNavigation();

let isFakeFullscreen = false;

function toggleFakeFullscreen(enable: boolean) {
  isFakeFullscreen = enable;

  const wrapper = document.querySelector('.video-player-wrapper');
  if (!wrapper) return;

  if (enable) {
    wrapper.requestFullscreen?.().catch(console.warn);
  } else {
    document.exitFullscreen?.().catch(console.warn);
  }

  //I think this can be removed?
  /*const root = document.getElementById('reactsync-root');
  if (root) {
    if(enable){
      root.style.position = 'absolute';
      root.style.top = '50%';
      root.style.left = '50%';
      root.style.width = '100vw';
      root.style.height = '56.25vw';
      root.style.transform = 'translate(-50%, -50%)';
    }else{
      root.style.position = '';
      root.style.top = '';
      root.style.left = '';
      root.style.width = '';
      root.style.height = '';
      root.style.transform = '';
    }
  }*/

  //Message attempt at centering video post-fullscreen
  const iframe = document.querySelector('iframe[src*="vilos"]') as HTMLIFrameElement;
  if(iframe){
    iframe?.contentWindow?.postMessage({
      type: 'reactr-mark-vilos-relative',
      payload: { enable: enable }
    }, '*');
  }

}

// Unified handler
function handleEventMessageOrFullscreenExit(event: Event | MessageEvent) {
  if (event instanceof MessageEvent && event.data?.type === 'reactr-fullscreen-toggle') {
    toggleFakeFullscreen(!isFakeFullscreen);
  }

  if (event.type === 'fullscreenchange') {
    console.log('fullscreenchange');
    if (!document.fullscreenElement && isFakeFullscreen) {
      console.log('🔁 Synced fake fullscreen exit after Esc');
      toggleFakeFullscreen(false);
    }
  }
}

window.addEventListener('message', handleEventMessageOrFullscreenExit);
document.addEventListener('fullscreenchange', handleEventMessageOrFullscreenExit);