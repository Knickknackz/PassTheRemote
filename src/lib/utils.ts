// This module provides utility functions for handling storage operations
export function getFromStorage<T = Record<string, any>>(keys: string[] | string): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result as T));
  });
}

export function setInStorage(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

export function removeFromStorage(keys: string[] | string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

// This function constructs a video URL based on the provider and video ID
export function getVideoUrl(provider: string, video_id: string, current_time: number): string | null {
  const t = Math.floor(current_time || 0);
  switch (provider) {
    case 'Netflix':
      return `https://www.netflix.com${video_id}?t=${t}`;
    case 'Crunchyroll':
      return `https://www.crunchyroll.com${video_id}`;
    default:
      return null;
  }
}

// This function formats a number of seconds into a string “MM:SS”
export function formatTime(seconds: number): string {
  const rounded = Math.floor(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}