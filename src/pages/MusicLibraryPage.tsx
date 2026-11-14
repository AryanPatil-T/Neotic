import React, { useEffect, useState } from 'react';
import {
  Check,
  Music,
  Play,
  Sliders,
  Sparkles,
  Square,
  Upload,
  Volume2,
} from 'lucide-react';
import { MusicTrackRecord, StudioSettings } from '../shared/types';
import { api } from '../lib/api';
import { webAudioPlayer } from '../lib/webAudioPlayer';

interface MusicLibraryPageProps {
  settings: StudioSettings;
  onSettingsUpdated: (s: StudioSettings) => void;
}

export const MusicLibraryPage: React.FC<MusicLibraryPageProps> = ({
  settings,
  onSettingsUpdated,
}) => {
  const [tracks, setTracks] = useState<MusicTrackRecord[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [volume, setVolume] = useState(settings.musicVolume);
  const [autoMood, setAutoMood] = useState(settings.autoSelectMoodTrack);
  const [activeTrackId, setActiveTrackId] = useState(settings.activeMusicTrackId);

  const [aiMoodPrompt, setAiMoodPrompt] = useState('Lone wolf on a misty mountain ridge, stoic discipline');
  const [aiResult, setAiResult] = useState<{ trackId: string; reason: string } | null>(null);
  const [recommending, setRecommending] = useState(false);

  // Custom Track Synthesizer Generator
  const [genTitle, setGenTitle] = useState('Midnight Reverie');
  const [genMood, setGenMood] = useState('Dark Cinematic Piano');
  const [genBpm, setGenBpm] = useState(68);
  const [genRain, setGenRain] = useState(6);
  const [generatingTrack, setGeneratingTrack] = useState(false);

  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadMood, setUploadMood] = useState('Dark Ambient');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.getMusicTracks().then((res) => setTracks(res.tracks)).catch(() => {});
    return () => {
      webAudioPlayer.stop();
    };
  }, []);

  const handleTogglePlay = (track: MusicTrackRecord) => {
    if (playingId === track.id) {
      webAudioPlayer.stop();
      setPlayingId(null);
    } else {
      webAudioPlayer.playTrack(track, volume, () => setPlayingId(null));
      setPlayingId(track.id);
    }
  };

  const handleVolumeChange = async (val: number) => {
    setVolume(val);
    webAudioPlayer.setVolume(val);
    const { settings: updated } = await api.updateSettings({ musicVolume: val });
    onSettingsUpdated(updated);
  };

  const handleSelectActiveTrack = async (trackId: string) => {
    setActiveTrackId(trackId);
    const { settings: updated } = await api.updateSettings({ activeMusicTrackId: trackId });
    onSettingsUpdated(updated);
  };

  const handleToggleAutoMood = async () => {
    const next = !autoMood;
    setAutoMood(next);
    const { settings: updated } = await api.updateSettings({ autoSelectMoodTrack: next });
    onSettingsUpdated(updated);
  };

  const handleAiRecommend = async () => {
    setRecommending(true);
    try {
      const rec = await api.recommendMusic(aiMoodPrompt);
      setAiResult(rec);
      await handleSelectActiveTrack(rec.trackId);
    } finally {
      setRecommending(false);
    }
  };

  const handleGenerateSynthTrack = async () => {
    setGeneratingTrack(true);
    try {
      const { track } = await api.generateMusicTrack({
        title: genTitle,
        mood: genMood,
        bpm: genBpm,
        rainLevel: genRain / 100,
        bellIntensity: 0.52,
      });
      setTracks((prev) => [track, ...prev]);
      await handleSelectActiveTrack(track.id);
      webAudioPlayer.playTrack(track, volume, () => setPlayingId(null));
      setPlayingId(track.id);
    } finally {
      setGeneratingTrack(false);
    }
  };

  const handleUploadTrack = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { track } = await api.uploadMusicTrack(file, {
        title: uploadTitle.trim() || file.name.replace(/\.[^.]+$/, ''),
        mood: uploadMood,
        license: 'User Custom License',
      });
      setTracks((prev) => [track, ...prev]);
      setUploadTitle('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl sm:text-3xl font-semibold text-white">
            Music Library &amp; Soundtrack Synthesizer
          </h1>
          <p className="text-sm text-[#9B9FB5] mt-1">
            Rich 44.1kHz stereo CC0 soundtracks synthesized cleanly on disk for direct playback and FFmpeg MP4 mixing.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-[#12131A] border border-[#27293A] rounded-xl px-4 py-3">
          <Volume2 className="w-4 h-4 text-[#8B5CF6] shrink-0" />
          <div className="w-36 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#A0A4B8]">Master Volume</span>
              <span className="font-mono-tabular text-white">{volume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-full accent-[#8B5CF6]"
            />
          </div>
        </div>
      </div>

      {/* Generate New Soundtrack + AI Recommend + Upload */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Generate New Soundtrack */}
        <div className="lg:col-span-5 rounded-xl bg-[#12131A] border border-[#27293A] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#8B5CF6]" />
            <h2 className="text-sm font-semibold text-white">Generate New CC0 Soundtrack</h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="text"
              value={genTitle}
              onChange={(e) => setGenTitle(e.target.value)}
              placeholder="Track title"
              className="px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
            />
            <select
              value={genMood}
              onChange={(e) => setGenMood(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
            >
              <option value="Dark Cinematic Piano">Dark Cinematic Piano</option>
              <option value="Midnight Wolf Drone">Midnight Wolf Drone</option>
              <option value="Rainy Noir Sub-Bass">Rainy Noir Sub-Bass</option>
              <option value="Epic Stoic Strings">Epic Stoic Strings</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-[#A0A4B8]">
                <span>Tempo</span>
                <span className="font-mono-tabular text-white">{genBpm} BPM</span>
              </div>
              <input
                type="range"
                min={50}
                max={105}
                value={genBpm}
                onChange={(e) => setGenBpm(Number(e.target.value))}
                className="w-full accent-[#8B5CF6]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-[#A0A4B8]">
                <span>Rain Texture</span>
                <span className="font-mono-tabular text-white">{genRain}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={genRain}
                onChange={(e) => setGenRain(Number(e.target.value))}
                className="w-full accent-[#8B5CF6]"
              />
            </div>
          </div>

          <button
            disabled={generatingTrack}
            onClick={handleGenerateSynthTrack}
            className="w-full py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white text-xs font-semibold transition-colors"
          >
            {generatingTrack ? 'Synthesizing 44.1kHz Stereo WAV...' : 'Generate & Preview Soundtrack'}
          </button>
        </div>

        {/* AI Mood Match */}
        <div className="lg:col-span-4 rounded-xl bg-[#12131A] border border-[#27293A] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">AI Mood Match</h2>
            <label className="flex items-center gap-2 text-xs text-[#D4D6E2] cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoMood}
                onChange={handleToggleAutoMood}
                className="accent-[#8B5CF6]"
              />
              <span>Auto-Select</span>
            </label>
          </div>

          <input
            type="text"
            value={aiMoodPrompt}
            onChange={(e) => setAiMoodPrompt(e.target.value)}
            placeholder="Describe quote mood or scene..."
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
          />

          <button
            disabled={recommending}
            onClick={handleAiRecommend}
            className="w-full py-2.5 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-white text-xs font-semibold flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>{recommending ? 'Analyzing...' : 'Let AI Recommend Music'}</span>
          </button>

          {aiResult && (
            <div className="rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 px-3 py-2 text-[11px] text-[#D1FAE5]">
              Selected{' '}
              <span className="font-semibold">
                {tracks.find((t) => t.id === aiResult.trackId)?.title || aiResult.trackId}
              </span>{' '}
              — {aiResult.reason}
            </div>
          )}
        </div>

        {/* Upload Custom MP3 / WAV */}
        <div className="lg:col-span-3 rounded-xl bg-[#12131A] border border-[#27293A] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Upload Audio (.mp3 / .wav)</h2>
          <input
            type="text"
            placeholder="Track title"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
          />
          <input
            type="text"
            placeholder="Mood"
            value={uploadMood}
            onChange={(e) => setUploadMood(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
          />
          <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-[#343850] hover:border-[#8B5CF6] bg-[#09090E] text-xs text-[#D4D6E2] cursor-pointer">
            <Upload className="w-4 h-4 text-[#8B5CF6]" />
            <span>{uploading ? 'Uploading...' : 'Select .mp3 / .wav'}</span>
            <input
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              className="hidden"
              onChange={(e) => handleUploadTrack(e.target.files?.[0])}
            />
          </label>
        </div>
      </section>

      {/* Track List */}
      <section className="rounded-xl bg-[#12131A] border border-[#27293A] divide-y divide-[#27293A]">
        {tracks.map((track) => {
          const isPlaying = playingId === track.id;
          const isDefault = activeTrackId === track.id;
          return (
            <div
              key={track.id}
              className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#181924]/50 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <button
                  onClick={() => handleTogglePlay(track)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors shrink-0 ${
                    isPlaying
                      ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
                      : 'bg-[#181924] border-[#27293A] text-[#D4D6E2] hover:border-[#8B5CF6]'
                  }`}
                  aria-label={isPlaying ? `Stop ${track.title}` : `Play ${track.title}`}
                >
                  {isPlaying ? (
                    <Square className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{track.title}</span>
                    {isDefault && (
                      <span className="text-[11px] text-[#10B981] font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#8E92A8] flex flex-wrap items-center gap-2 mt-0.5">
                    <span>{track.mood}</span>
                    <span aria-hidden="true">·</span>
                    <span>{track.artist}</span>
                    <span aria-hidden="true">·</span>
                    <span>{track.license}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{track.durationSec}s</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleSelectActiveTrack(track.id)}
                  className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                    isDefault
                      ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                      : 'bg-[#181924] border-[#27293A] text-[#D4D6E2] hover:text-white'
                  }`}
                >
                  {isDefault ? 'Active Default' : 'Set as Default'}
                </button>
              </div>
            </div>
          );
        })}

        {tracks.length === 0 && (
          <div className="p-10 text-center text-xs text-[#8E92A8]">
            <Music className="w-5 h-5 mx-auto mb-2 opacity-60" />
            Loading studio soundtracks...
          </div>
        )}
      </section>
    </div>
  );
};
