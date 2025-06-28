const TOAST_CONTAINER_ID = 'reactr-toast-container';
const TOAST_CLASS = 'reactr-toast';
const TOAST_STYLE_ID = 'reactr-toast-style';

export function ensureToastContainer() {
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

export function showToast(html: string, duration = 5000, onDone?: () => void) {
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

export function showRoomClosedToast() {
  showToast(`
    <div style="margin-bottom: 0.5em;">🚪 Room Closed</div>
    <div>The host has ended this session.</div>
  `);
}

export function showCountdownToast(videoUrl: string, onRedirect?: () => void) {
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
        if (onRedirect) onRedirect();
        else window.location.href = videoUrl;
      }, 400);
    }
  }, 1000);
}