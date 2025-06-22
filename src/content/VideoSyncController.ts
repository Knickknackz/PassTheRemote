// src/shared/VideoSyncController.ts
import { getFromStorage, setInStorage} from '../lib/storage'; 

export type Role = 'host' | 'audience';

export interface ProviderConfig {
  getProviderId: () => string;
  getVideoId: () => string | null;
  getMetadata: () => Promise<{
    videoId: string | null;
    showTitle: string | null;
    episodeTitle: string | null;
    episodeNumber: string | null;
  }>;
  onSyncMismatch?: (redirectUrl: string) => void;
  onRoomClosed?: () => void;
  generateUrlFromId: (videoId: string, time?: number | null) => string;

  // Lifecycle hooks
  onInit?: () => void;
  onVideoFound?: (video: HTMLVideoElement) => void;
  onMetadataReady?: (meta: {
    videoId: string | null;
    showTitle: string | null;
    episodeTitle: string | null;
    episodeNumber: string | null;
  }) => void;
}

export class VideoSyncController {
  protected video: HTMLVideoElement | null = null;
  protected userRole: Role = 'audience';
  private suppressCounter = 0;
  private suppressLimit = 3; // ⏱ Max events per second
  private suppressResetHandle: ReturnType<typeof setTimeout> | null = null;
  protected videoReady = false;
  protected metadataReceived = false;

  protected videoId: string | null = null;
  protected showTitle: string | null = null;
  protected episodeTitle: string | null = null;
  protected episodeNumber: string | null = null;

  protected currentMessageHandler: ((msg: any, sender: any, sendResponse: any) => void) | null = null;

  constructor(public config: ProviderConfig) {}

  private getRedirectUrl(videoId: string, time: number, provider: string): string {
    const timestamp = time && time > 0 ? `?t=${Math.floor(time)}` : '';
    switch (provider) {
        case 'netflix':
            return `https://www.netflix.com${videoId}${timestamp}`;
        case 'crunchyroll':
            return `https://www.crunchyroll.com${videoId}${timestamp}`;
        default:
            console.warn("❌ Unknown provider for redirect:", provider);
            return location.href;
    }
  }

  private getTimeWithDelta(current_time: number, updated_at: string): number{
    if(!current_time) return 0
    if(!updated_at) return current_time;

    // Convert to ISO 8601 format (replace space with "T")
    const isoTimestamp = updated_at.replace(' ', 'T');

    // Create Date objects
    const past = new Date(isoTimestamp);
    const now = new Date();

    // Difference in seconds
    const diffSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    console.log(diffSeconds + ' has passed since last video update');
    return diffSeconds + current_time;
  }

  async init() {
    this.config.onInit?.();
    const { role } = await getFromStorage('role');
    this.userRole = (role === 'host' ? 'host' : 'audience');
    this.videoId = this.config.getVideoId();
    await this.tryFindVideo();
  }

  public async reset() {
    console.log("🔄 Resetting video sync controller...");
    this.video = null;
    this.videoReady = false;
    this.metadataReceived = false;
    this.videoId = this.config.getVideoId();
    await this.tryFindVideo();
  }

  protected async tryFindVideo(): Promise<void> {
    const found = document.querySelector('video') as HTMLVideoElement | null;
    if (!found) {
        console.log("⏳ VideoSyncController: Waiting for video element...");
        setTimeout(() => this.tryFindVideo(), 1000);
        return;
    }

    if (found.readyState < 2) {
        console.log("⏳ Video Element Not ready, waiting...");
        // Not ready enough to reliably pause/play — wait again
        setTimeout(() => this.tryFindVideo(), 200);
        return;
    }

    this.video = found;
    this.videoReady = true;

    this.config.onVideoFound?.(found);

    await this.extractMetadata();
    this.setupVideoSync();
    this.registerIfNeeded();
  }

  protected async extractMetadata() {
    const metadata = await this.config.getMetadata();
    this.videoId = metadata.videoId;
    this.showTitle = metadata.showTitle;
    this.episodeTitle = metadata.episodeTitle;
    this.episodeNumber = metadata.episodeNumber;
    this.config.onMetadataReady?.(metadata);
  }

  protected setupVideoSync() {
    console.log('setupVideoSync', this.video);
    if (!this.video) return;
    const handler = () => this.sendState();

    this.video.addEventListener('pause', handler);
    this.video.addEventListener('play', handler);
    this.video.addEventListener('seeked', handler);

    this.setupMessageListener();
    if (this.userRole === 'host') this.sendState();
  }

  protected sendState() {
    if (this.video == null || this.userRole !== 'host') return;

    if (this.suppressCounter >= this.suppressLimit) {
        console.log("⏳ Too many events — throttling");
        return;
    }

    this.suppressCounter++;

    if (!this.suppressResetHandle) {
    this.suppressResetHandle = setTimeout(() => {
        this.suppressCounter = 0;
        this.suppressResetHandle = null;
    }, 1000);
    }

    chrome.runtime.sendMessage({
      type: 'video-update',
      play_state: this.video.paused ? 'paused' : 'playing',
      current_time: this.video.currentTime,
      video_id: this.config.getVideoId(),
      provider: this.config.getProviderId(),
      show_title: this.showTitle,
      episode_title: this.episodeTitle,
      episode_number: this.episodeNumber,
    });
  }

  protected setupMessageListener() {
    if (this.currentMessageHandler) {
      chrome.runtime.onMessage.removeListener(this.currentMessageHandler);
    }

    const handler = (msg: any, _sender: any, sendResponse: any) => {
      if (!this.video){
        if(msg.type == 'request-state'){
          sendResponse({ videoFound: false });
        }
        return true;
      }

      switch (msg.type) {
        case 'role-update':
          console.log('ROLE UPDATED');
          this.userRole = msg.role;
          break;
        case 'sync-update':{
          console.log('New State', msg);
          if(this.userRole === 'host'){
            if(msg.video_id && this.config.getVideoId() !== msg.video_id){
              setInStorage({videoId: msg.video_id});
            } 
            console.log('User is Host, Ignoring Command'); 
            return;
          }
          
          if ((this.config.getVideoId() !== msg.video_id || this.config.getProviderId() !== msg.provider) &&
              this.userRole === 'audience' && msg.video_id != null && msg.video_id !== 'debug') 
          {
            setInStorage({ videoId: msg.video_id, provider: msg.provider });
            const targetTime = msg.state == 'playing' ? this.getTimeWithDelta(msg.time, msg.updated_at) : msg.time;
            this.config.onSyncMismatch?.(this.getRedirectUrl(msg.video_id, targetTime, msg.provider));
            sendResponse?.();
            return true;
          }

          
          const targetTime = msg.state == 'playing' ? this.getTimeWithDelta(msg.time, msg.updated_at) : msg.time;
          console.log('Target Time: ', targetTime);
          console.log('current time', this.video.currentTime);
          if (Math.abs(this.video.currentTime - targetTime) > 5 && msg.provider != 'netflix') {
            this.video.currentTime = targetTime;
          }

          if (msg.state === 'playing') this.video.play();
          else if (msg.state === 'paused') this.video.pause();
          else if (msg.state === 'skip') this.video.currentTime = msg.time;

          break;
        }
        case 'request-state':
          this.sendState();
          sendResponse({ videoFound: true });
          break;
        case 'room-closed':
          this.config.onRoomClosed?.();
          break;
      }

      sendResponse?.();
      return true;
    };

    chrome.runtime.onMessage.addListener(handler);
    this.currentMessageHandler = handler;
  }

  protected registerIfNeeded() {
    if (!this.video) return;

    chrome.runtime.sendMessage({ type: 'register-content' });
    window.addEventListener('unload', () => {
      chrome.runtime.sendMessage({ type: 'unregister-content' });
    });
  }
}
