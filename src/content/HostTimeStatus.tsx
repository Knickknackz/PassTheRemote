import { useEffect, useState } from 'react';

function formatTime(seconds: number): string {
  const rounded = Math.floor(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

type HostState = {
  baseTime: number;
  updatedAt: number;
  state: 'playing' | 'paused';
  title?: string;
  episode?: string;
  viewer_count?: number;
};

export default function HostTimeStatus({ isVisible }: { isVisible : boolean;}) {
  const [hostState, setHostState] = useState<HostState | null>(null);
  const [displayTime, setDisplayTime] = useState('00:00');

  // Listen to sync-update events
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg.type === 'sync-update') {
        const { time, updated_at, state, show_title, episode_title, episode_number, viewer_count } = msg;

        setHostState({
          baseTime: time,
          updatedAt: new Date(updated_at).getTime(),
          state,
          title: show_title,
          episode: episode_title || (episode_number ? `Ep. ${episode_number}` : undefined),
          viewer_count: viewer_count,
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Recalculate display time every second
  useEffect(() => {
    if (!hostState) return;

    const tick = () => {
      const now = Date.now();
      const elapsed = (now - hostState.updatedAt) / 1000;
      const effectiveTime = hostState.state === 'playing'
        ? hostState.baseTime + elapsed
        : hostState.baseTime;

      setDisplayTime(formatTime(effectiveTime));
    };

    tick(); // immediate update
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [hostState]);

  if (!hostState) return null;

  return (
    <div style={{
        fontSize: '0.9rem',
        marginTop: '0.5rem',
        color: '#fff',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '6px 10px',
        maxWidth: '260px',
        lineHeight: '1.4',
        opacity: isVisible  ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none', // Don't block interactions
    }}>
      🧑‍💻 <strong>Room is at:</strong> {displayTime} ({hostState.state})
        {(hostState.title || hostState.episode) && (
            <div style={{ marginTop: '0.25rem' }}>
            {hostState.title && <strong>{hostState.title}</strong>}
            {hostState.episode && ` – ${hostState.episode}`}
            </div>
        )}
        {typeof hostState.viewer_count === 'number' && (
            <div style={{ marginTop: '0.25rem', fontStyle: 'italic', color: '#ccc' }}>
                Watching with {hostState.viewer_count.toLocaleString()} others
            </div>
        )}
    </div>
  );
}