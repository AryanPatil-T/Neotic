import {
  AiEngine,
  DailyAutomationConfig,
  ImageSourceMode,
  MusicTrackRecord,
  PipelineJob,
  ProductionMode,
  ProviderStatus,
  QuoteTone,
  ScheduleConfig,
  StudioSettings,
  UploadedAsset,
  UsedContentRecord,
  VideoRecord,
} from '../shared/types';

export interface AutomationStatusResponse {
  config: DailyAutomationConfig;
  nextRunIso: string;
  nextRunDisplay: string;
  pendingYouTubeUploads: number;
  hasActiveSessionToken: boolean;
  tokenExpiresAt: string | null;
}

export interface OverviewResponse {
  kpis: {
    generatedToday: number;
    scheduled: number;
    published: number;
    failed: number;
    localStorageBytes: number;
    totalLibrary: number;
  };
  settings: StudioSettings;
  job: PipelineJob | null;
  providers: ProviderStatus[];
  recentVideos: VideoRecord[];
  automation?: AutomationStatusResponse;
}

async function reqJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getOverview: () => reqJson<OverviewResponse>('/api/studio/overview'),

  getSettings: () =>
    reqJson<{ settings: StudioSettings; providers: ProviderStatus[] }>('/api/settings'),

  updateSettings: (partial: Partial<StudioSettings>) =>
    reqJson<{ settings: StudioSettings }>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    }),

  testProvider: (id: string) =>
    reqJson<{ ok: boolean; latencyMs: number; message: string }>(`/api/providers/${id}/test`, {
      method: 'POST',
    }),

  startGeneration: (
    payload: {
      quantity: number;
      productionMode: ProductionMode;
      imageSource: ImageSourceMode;
      engine: AiEngine;
      quoteTone?: QuoteTone;
      visualStyles: string[];
      categories: string[];
      bwMonochrome: boolean;
      autoUploadSchedule: boolean;
      customConcepts?: Array<{
        quote: string;
        title?: string;
        topic?: string;
        description?: string;
        hashtags?: string[];
        visualQuery?: string;
        category?: string;
        visualStyle?: string;
      }>;
    },
    accessToken?: string | null
  ) =>
    reqJson<{ job: PipelineJob }>('/api/pipeline/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    }),

  getPipelineStatus: () => reqJson<{ job: PipelineJob | null }>('/api/pipeline/status'),

  getVideos: () => reqJson<{ videos: VideoRecord[] }>('/api/videos'),

  updateVideo: (id: string, partial: Partial<VideoRecord>) =>
    reqJson<{ video: VideoRecord }>(`/api/videos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    }),

  renderVideo: (id: string, overrides?: Partial<VideoRecord>) =>
    reqJson<{ video: VideoRecord }>(`/api/videos/${id}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides || {}),
    }),

  regenerateVideoImage: (id: string, imageSource?: ImageSourceMode) =>
    reqJson<{ video: VideoRecord }>(`/api/videos/${id}/regenerate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageSource }),
    }),

  deleteVideo: (id: string) =>
    reqJson<{ ok: boolean }>(`/api/videos/${id}`, { method: 'DELETE' }),

  getAssets: (kind?: 'photo' | 'logo' | 'sample') =>
    reqJson<{ assets: UploadedAsset[] }>(kind ? `/api/assets?kind=${kind}` : '/api/assets'),

  uploadAsset: async (file: File, kind: 'photo' | 'logo') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    return reqJson<{ asset: UploadedAsset }>('/api/assets/upload', {
      method: 'POST',
      body: fd,
    });
  },

  deleteAsset: (id: string) =>
    reqJson<{ ok: boolean }>(`/api/assets/${id}`, { method: 'DELETE' }),

  getMusicTracks: () => reqJson<{ tracks: MusicTrackRecord[] }>('/api/music'),

  uploadMusicTrack: async (file: File, meta: { title: string; mood: string; license: string }) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', meta.title);
    fd.append('mood', meta.mood);
    fd.append('license', meta.license);
    return reqJson<{ track: MusicTrackRecord }>('/api/music/upload', {
      method: 'POST',
      body: fd,
    });
  },

  recommendMusic: (prompt: string) =>
    reqJson<{ trackId: string; reason: string }>('/api/music/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    }),

  generateMusicTrack: (payload: {
    title: string;
    mood: string;
    bpm: number;
    rainLevel?: number;
    bellIntensity?: number;
  }) =>
    reqJson<{ track: MusicTrackRecord }>('/api/music/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  previewScheduleSlots: (scheduleConfig: ScheduleConfig, count = 5) =>
    reqJson<{ slots: Array<{ isoUtc: string; localDisplay: string; dayCode: string }> }>(
      '/api/schedule/preview',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleConfig, count }),
      }
    ),

  assignSchedule: (
    videoIds: string[],
    uploadToYouTube: boolean,
    accessToken?: string | null
  ) =>
    reqJson<{
      results: Array<{
        id: string;
        status: string;
        scheduledAt?: string;
        youtubeVideoId?: string;
        error?: string;
      }>;
    }>('/api/schedule/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ videoIds, uploadToYouTube }),
    }),

  getDatabaseTables: () =>
    reqJson<{
      videos: VideoRecord[];
      usedContent: UsedContentRecord[];
      musicTracks: MusicTrackRecord[];
      settings: StudioSettings;
    }>('/api/database/tables'),

  importExcel: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return reqJson<{
      summary: {
        importedVideos: number;
        skippedDuplicates: number;
        conflicts: Array<{ id: string; title: string; reason: string }>;
      };
    }>('/api/database/import.xlsx', { method: 'POST', body: fd });
  },

  linkGoogleSheet: (spreadsheetUrlOrId: string) =>
    reqJson<{ settings: StudioSettings }>('/api/database/sheets-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetUrlOrId }),
    }),

  syncGoogleSheets: (accessToken: string) =>
    reqJson<{ spreadsheetId: string; spreadsheetUrl: string }>('/api/database/sheets-sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  getAutomationStatus: () => reqJson<AutomationStatusResponse>('/api/automation/status'),

  setAutomationSessionToken: (accessToken: string | null) =>
    reqJson<{ active: boolean }>('/api/automation/session-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ expiresInSec: 3300 }),
    }),

  runAutomationNow: (accessToken?: string | null) =>
    reqJson<{ job: PipelineJob; automation: AutomationStatusResponse }>('/api/automation/run-now', {
      method: 'POST',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    }),

  syncPendingUploads: (accessToken: string) =>
    reqJson<{
      uploadedCount: number;
      skippedCount: number;
      sheetsSynced: boolean;
      errors: string[];
    }>('/api/automation/sync-pending', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
