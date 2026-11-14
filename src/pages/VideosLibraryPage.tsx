import React, { useEffect, useState } from 'react';
import {
  CalendarClock,
  Download,
  Edit3,
  Film,
  ImagePlus,
  Layers,
  Music,
  Palette,
  Play,
  RefreshCw,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { MusicTrackRecord, VideoRecord, VideoStatus } from '../shared/types';
import { api, formatBytes } from '../lib/api';

interface VideosLibraryPageProps {
  videos: VideoRecord[];
  onVideosChanged: () => Promise<void>;
  onOpenEditor: (videoId: string, tab: 'logo' | 'gradient' | 'quote') => void;
  onNavigateScheduler: () => void;
}

const FILTER_TABS: Array<{ id: 'all' | VideoStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'generating', label: 'Generating' },
  { id: 'completed', label: 'Completed' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'failed', label: 'Failed' },
];

export const VideosLibraryPage: React.FC<VideosLibraryPageProps> = ({
  videos,
  onVideosChanged,
  onOpenEditor,
  onNavigateScheduler,
}) => {
  const [filter, setFilter] = useState<'all' | VideoStatus>('all');
  const [search, setSearch] = useState('');
  const [tracks, setTracks] = useState<MusicTrackRecord[]>([]);
  const [playerVideo, setPlayerVideo] = useState<VideoRecord | null>(null);
  const [metaVideo, setMetaVideo] = useState<VideoRecord | null>(null);
  const [musicVideo, setMusicVideo] = useState<VideoRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit Metadata fields
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTags, setEditTags] = useState('');

  useEffect(() => {
    api.getMusicTracks().then((r) => setTracks(r.tracks)).catch(() => {});
  }, []);

  const filtered = videos.filter((v) => {
    if (filter !== 'all' && v.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        v.title.toLowerCase().includes(q) ||
        v.quote.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openMetadata = (v: VideoRecord) => {
    setMetaVideo(v);
    setEditTitle(v.title);
    setEditDesc(v.description);
    setEditTags(v.hashtags.join(', '));
  };

  const saveMetadata = async () => {
    if (!metaVideo) return;
    await api.updateVideo(metaVideo.id, {
      title: editTitle,
      description: editDesc,
      hashtags: editTags
        .split(',')
        .map((s) => s.trim().replace(/^#/, ''))
        .filter(Boolean),
    });
    setMetaVideo(null);
    await onVideosChanged();
  };

  const handleReRender = async (v: VideoRecord) => {
    setBusyId(v.id);
    setErrorMsg(null);
    try {
      await api.renderVideo(v.id);
      await onVideosChanged();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Re-render failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleRegenImage = async (v: VideoRecord) => {
    setBusyId(v.id);
    setErrorMsg(null);
    try {
      await api.regenerateVideoImage(v.id);
      await onVideosChanged();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Image regeneration failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignMusic = async (trackId: string) => {
    if (!musicVideo) return;
    setBusyId(musicVideo.id);
    try {
      await api.renderVideo(musicVideo.id, { musicTrackId: trackId });
      setMusicVideo(null);
      await onVideosChanged();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to assign music');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (v: VideoRecord) => {
    setBusyId(v.id);
    try {
      await api.deleteVideo(v.id);
      await onVideosChanged();
    } finally {
      setBusyId(null);
    }
  };

  const statusTone = (status: VideoStatus) => {
    switch (status) {
      case 'completed':
        return 'text-[#10B981]';
      case 'scheduled':
        return 'text-[#3B82F6]';
      case 'published':
        return 'text-[#8B5CF6]';
      case 'failed':
        return 'text-[#EF4444]';
      default:
        return 'text-[#F59E0B]';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl sm:text-3xl font-semibold text-white">
            My Videos Library
          </h1>
          <p className="text-sm text-[#9B9FB5] mt-1">
            Inspect rendered 9:16 MP4s, adjust overlays, swap background artwork, assign soundtracks, or download locally.
          </p>
        </div>

        <input
          type="search"
          placeholder="Search title, quote, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full lg:w-72 px-3.5 py-2 rounded-lg bg-[#12131A] border border-[#27293A] text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[#12131A] border border-[#27293A] w-fit">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.id === 'all' ? videos.length : videos.filter((v) => v.status === tab.id).length;
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                active ? 'bg-[#8B5CF6] text-white' : 'text-[#A0A4B8] hover:text-white'
              }`}
            >
              {tab.label} <span className="font-mono-tabular opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/35 px-4 py-2.5 text-xs text-[#FCA5A5]">
          {errorMsg}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-14 text-center space-y-3">
          <Film className="w-8 h-8 text-[#8B5CF6] mx-auto opacity-80" />
          <div className="text-sm font-medium text-white">No matching Shorts in library</div>
          <p className="text-xs text-[#8E92A8]">
            Generate a new batch or switch filter tabs to view your local Shorts collection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((v) => {
            const isBusy = busyId === v.id;
            return (
              <div
                key={v.id}
                className="rounded-xl bg-[#12131A] border border-[#27293A] overflow-hidden flex flex-col"
              >
                <div className="flex gap-4 p-4">
                  {/* 9:16 Thumbnail */}
                  <button
                    onClick={() => v.mp4Url && setPlayerVideo(v)}
                    className="relative w-28 aspect-[9/16] rounded-lg overflow-hidden bg-[#09090E] border border-[#27293A] shrink-0 group"
                    title={v.mp4Url ? 'Play MP4 preview' : 'Not rendered yet'}
                  >
                    <img
                      src={v.thumbnailUrl || v.backgroundImageUrl}
                      alt={v.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {v.mp4Url && (
                      <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-6 h-6 text-white fill-current" />
                      </div>
                    )}
                  </button>

                  {/* Metadata & Quote */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[11px] font-mono-tabular">
                        <span className={`font-semibold uppercase ${statusTone(v.status)}`}>
                          {v.status}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#8E92A8]">{v.resolution}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#8E92A8]">{v.durationSec}s</span>
                      </div>

                      <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                        {v.title}
                      </h3>

                      <p className="text-xs text-[#A0A4B8] line-clamp-3 italic">
                        &ldquo;{v.quote}&rdquo;
                      </p>

                      {v.errorMessage && (
                        <p className="text-[11px] text-[#EF4444] line-clamp-2">{v.errorMessage}</p>
                      )}
                    </div>

                    <div className="text-[11px] text-[#7E8299] font-mono-tabular flex flex-wrap gap-1.5">
                      <span>{v.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{v.aiEngineUsed}</span>
                      {v.fileSizeBytes > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{formatBytes(v.fileSizeBytes)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="px-4 py-3 bg-[#181924]/70 border-t border-[#27293A] flex flex-wrap gap-1.5">
                  <ActionBtn icon={Edit3} label="Metadata" onClick={() => openMetadata(v)} />
                  <ActionBtn icon={Type} label="Quote" onClick={() => onOpenEditor(v.id, 'quote')} />
                  <ActionBtn icon={Layers} label="Logo" onClick={() => onOpenEditor(v.id, 'logo')} />
                  <ActionBtn icon={Palette} label="Gradients" onClick={() => onOpenEditor(v.id, 'gradient')} />
                  <ActionBtn icon={Music} label="Music" onClick={() => setMusicVideo(v)} />
                  <ActionBtn
                    icon={ImagePlus}
                    label="New Image"
                    disabled={isBusy}
                    onClick={() => handleRegenImage(v)}
                  />
                  <ActionBtn
                    icon={RefreshCw}
                    label={isBusy ? 'Working...' : 'Re-Render'}
                    disabled={isBusy}
                    onClick={() => handleReRender(v)}
                  />
                  {v.mp4Url && (
                    <a
                      href={`/api/videos/${v.id}/download`}
                      className="px-2.5 py-1.5 rounded-md bg-[#12131A] hover:bg-[#222434] border border-[#27293A] text-[11px] text-[#10B981] font-medium inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>MP4</span>
                    </a>
                  )}
                  <ActionBtn icon={CalendarClock} label="Schedule" onClick={onNavigateScheduler} />
                  <button
                    disabled={isBusy}
                    onClick={() => handleDelete(v)}
                    className="px-2.5 py-1.5 rounded-md bg-[#12131A] hover:bg-[#EF4444]/15 border border-[#27293A] text-[11px] text-[#EF4444] inline-flex items-center gap-1 ml-auto"
                    title="Delete video"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline MP4 Player Modal */}
      {playerVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-[#12131A] border border-[#27293A] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white truncate">{playerVideo.title}</h3>
              <button onClick={() => setPlayerVideo(null)} className="p-1 text-[#8E92A8] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-[9/16] w-full max-h-[70vh] mx-auto bg-black rounded-lg overflow-hidden">
              <video
                src={playerVideo.mp4Url}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {metaVideo && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Edit YouTube Metadata</h3>
              <button onClick={() => setMetaVideo(null)} className="p-1 text-[#8E92A8] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-[#A0A4B8]">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#A0A4B8]">Description</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#A0A4B8]">Hashtags (comma separated)</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setMetaVideo(null)}
                className="px-4 py-2 rounded-lg border border-[#27293A] text-xs text-[#A0A4B8]"
              >
                Cancel
              </button>
              <button
                onClick={saveMetadata}
                className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-white text-xs font-semibold"
              >
                Save Metadata
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Music Modal */}
      {musicVideo && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Assign Soundtrack &amp; Re-Render</h3>
              <button onClick={() => setMusicVideo(null)} className="p-1 text-[#8E92A8] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {tracks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleAssignMusic(t.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    musicVideo.musicTrackId === t.id
                      ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                      : 'bg-[#181924] border-[#27293A] text-[#D4D6E2] hover:border-[#8B5CF6]/50'
                  }`}
                >
                  <div className="text-xs font-semibold">{t.title}</div>
                  <div className="text-[11px] text-[#8E92A8]">{t.mood} · {t.license}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionBtn: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon: Icon, label, onClick, disabled }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className="px-2.5 py-1.5 rounded-md bg-[#12131A] hover:bg-[#222434] disabled:opacity-50 border border-[#27293A] text-[11px] text-[#D4D6E2] inline-flex items-center gap-1"
  >
    <Icon className="w-3 h-3 text-[#8E92A8]" />
    <span>{label}</span>
  </button>
);
