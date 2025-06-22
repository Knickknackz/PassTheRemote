//import { getFromStorage, setInStorage, removeFromStorage } from '../lib/storage';
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
