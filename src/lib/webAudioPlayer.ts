import { MusicTrackRecord } from '../shared/types';

class StudioWebAudioPlayer {
  private htmlAudio: HTMLAudioElement | null = null;
  private currentTrackId: string | null = null;

  public getPlayingId(): string | null {
    return this.currentTrackId;
  }

  public setVolume(volPct: number) {
    const gain = Math.max(0, Math.min(1, volPct / 100));
    if (this.htmlAudio) {
      this.htmlAudio.volume = gain;
    }
  }

  public stop() {
    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio.currentTime = 0;
      this.htmlAudio = null;
    }
    this.currentTrackId = null;
  }

  public playTrack(track: MusicTrackRecord, volumePct: number, onEnded?: () => void) {
    this.stop();
    this.currentTrackId = track.id;

    // Play the exact synthesized WAV / uploaded audio file used in FFmpeg rendering
    const src = track.fileUrl.includes('?')
      ? track.fileUrl
      : `${track.fileUrl}?v=${Date.now()}`;

    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, volumePct / 100));
    audio.onended = () => {
      this.currentTrackId = null;
      onEnded?.();
    };
    audio.onerror = () => {
      this.currentTrackId = null;
      onEnded?.();
    };
    audio.play().catch(() => {
      this.currentTrackId = null;
      onEnded?.();
    });
    this.htmlAudio = audio;
  }
}

export const webAudioPlayer = new StudioWebAudioPlayer();
