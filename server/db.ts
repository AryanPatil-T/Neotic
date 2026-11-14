import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  CONTENT_CATEGORIES,
  DEFAULT_GRADIENTS_CONFIG,
  DEFAULT_LOGO_CONFIG,
  DEFAULT_QUOTE_STYLE,
  type MusicTrackRecord,
  type PipelineJob,
  STUDIO_SAMPLE_IMAGES,
  type StudioSettings,
  type UploadedAsset,
  type UsedContentRecord,
  type VideoRecord,
  VISUAL_STYLES,
} from '../src/shared/types.ts';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
export const THUMBS_DIR = path.join(DATA_DIR, 'thumbs');
export const IMAGES_DIR = path.join(DATA_DIR, 'images');
export const MUSIC_DIR = path.join(DATA_DIR, 'music');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const SAMPLES_DIR = path.resolve(process.cwd(), 'src/assets/images');

for (const dir of [DATA_DIR, VIDEOS_DIR, THUMBS_DIR, IMAGES_DIR, MUSIC_DIR, UPLOADS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'studio.db');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      quote TEXT NOT NULL,
      description TEXT NOT NULL,
      hashtags TEXT NOT NULL,
      category TEXT NOT NULL,
      visual_style TEXT NOT NULL,
      production_mode TEXT NOT NULL,
      image_source TEXT NOT NULL,
      ai_engine_used TEXT NOT NULL,
      resolution TEXT NOT NULL,
      duration_sec INTEGER NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      background_image_url TEXT NOT NULL,
      thumbnail_url TEXT NOT NULL,
      mp4_url TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      scenes_json TEXT NOT NULL,
      music_track_id TEXT NOT NULL,
      music_volume INTEGER NOT NULL DEFAULT 45,
      logo_config_json TEXT NOT NULL,
      gradients_config_json TEXT NOT NULL,
      quote_style_config_json TEXT NOT NULL,
      scheduled_at TEXT,
      published_at TEXT,
      youtube_video_id TEXT,
      privacy_status TEXT NOT NULL DEFAULT 'private',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS used_content (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      quote TEXT NOT NULL,
      topic TEXT NOT NULL,
      title TEXT NOT NULL,
      normalized_quote TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS used_image_urls (
      url TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      used_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS music_tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mood TEXT NOT NULL,
      artist TEXT NOT NULL,
      license TEXT NOT NULL,
      duration_sec INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      file_url TEXT NOT NULL,
      synth_preset TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS studio_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pipeline_jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      total_videos INTEGER NOT NULL,
      completed_videos INTEGER NOT NULL,
      current_stage_index INTEGER NOT NULL,
      current_stage_name TEXT NOT NULL,
      active_provider TEXT NOT NULL,
      logs_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS uploaded_assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      file_url TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  seedBuiltInMusicTracks();
  seedDefaultSettings();
  seedSampleAssets();
}

function seedBuiltInMusicTracks() {
  const tracks: MusicTrackRecord[] = [
    {
      id: 'synth-obsidian-pulse',
      title: 'Obsidian Pulse',
      mood: 'Dark Ambient',
      artist: 'AI Shorts Synth Engine',
      license: 'CC0 Public Domain (Offline Synth)',
      durationSec: 30,
      sourceType: 'builtin_synth',
      fileUrl: '/media/music/obsidian_pulse.wav',
      synthPreset: 'obsidian_pulse',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'synth-midnight-wolf',
      title: 'Midnight Wolf',
      mood: 'Deep Drone',
      artist: 'AI Shorts Synth Engine',
      license: 'CC0 Public Domain (Offline Synth)',
      durationSec: 30,
      sourceType: 'builtin_synth',
      fileUrl: '/media/music/midnight_wolf.wav',
      synthPreset: 'midnight_wolf',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'synth-iron-discipline',
      title: 'Iron Discipline',
      mood: 'Minimal Piano',
      artist: 'AI Shorts Synth Engine',
      license: 'CC0 Public Domain (Offline Synth)',
      durationSec: 30,
      sourceType: 'builtin_synth',
      fileUrl: '/media/music/iron_discipline.wav',
      synthPreset: 'iron_discipline',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'synth-shadow-horizon',
      title: 'Shadow Horizon',
      mood: 'Rain & Sub-Bass',
      artist: 'AI Shorts Synth Engine',
      license: 'CC0 Public Domain (Offline Synth)',
      durationSec: 30,
      sourceType: 'builtin_synth',
      fileUrl: '/media/music/shadow_horizon.wav',
      synthPreset: 'shadow_horizon',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'synth-silent-ascension',
      title: 'Silent Ascension',
      mood: 'Emotional Strings Pad',
      artist: 'AI Shorts Synth Engine',
      license: 'CC0 Public Domain (Offline Synth)',
      durationSec: 30,
      sourceType: 'builtin_synth',
      fileUrl: '/media/music/silent_ascension.wav',
      synthPreset: 'silent_ascension',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'user-default-motivation-mp3',
      title: 'Take Action — Signature Soundtrack',
      mood: 'Dark Motivational Beat',
      artist: 'Studio Default Audio',
      license: 'User Provided Audio',
      durationSec: 11,
      sourceType: 'uploaded',
      fileUrl:
        '/assets/aistudio/Take_action_and_grow_your_life.____motivation__action__shorts__ytshorts__subscribe_610d6101.mp3',
      synthPreset: null as any,
      createdAt: '2026-11-12T22:15:00.000Z',
    },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO music_tracks (id, title, mood, artist, license, duration_sec, source_type, file_url, synth_preset, created_at)
    VALUES (@id, @title, @mood, @artist, @license, @durationSec, @sourceType, @fileUrl, @synthPreset, @createdAt)
  `);

  for (const t of tracks) {
    insert.run(t);
  }
}

function resolveEnvSpreadsheet(): { id: string; url: string } {
  const raw = (process.env.GOOGLE_SHEET_URL || process.env.GOOGLE_SPREADSHEET_ID || '').trim();
  if (!raw) return { id: '', url: '' };
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id = match ? match[1] : raw;
  const url = raw.startsWith('http') ? raw : `https://docs.google.com/spreadsheets/d/${id}/edit`;
  return { id, url };
}

export function getDefaultSettings(): StudioSettings {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const isLowResource = process.env.LOW_MEMORY === 'true' || process.env.RENDER === 'true';
  const envSheet = resolveEnvSpreadsheet();

  return {
    defaultProductionMode: 'single_image',
    defaultImageSource: 'stock_web',
    resolution: isLowResource ? '720x1280' : '1080x1920',
    defaultPrivacy: 'private',
    durationSec: isLowResource ? 15 : 30,
    dailyLimit: 8,
    activeEngine: 'auto',
    defaultQuoteTone: 'secular_wisdom',
    bwMonochrome: true,
    autoUploadSchedule: true,
    autoSyncSheets: true,
    musicVolume: 75,
    autoSelectMoodTrack: false,
    activeMusicTrackId: 'user-default-motivation-mp3',
    jaccardThreshold: 0.58,
    trigramThreshold: 0.72,
    connectedSpreadsheetId: envSheet.id,
    connectedSpreadsheetUrl: envSheet.url,
    youtubeChannel: null,
    selectedCategories: [...CONTENT_CATEGORIES],
    selectedVisualStyles: [...VISUAL_STYLES],
    categoryRotationIndex: 0,
    styleRotationIndex: 0,
    scheduleConfig: {
      intervalHours: 2,
      startDate: `${yyyy}-${mm}-${dd}`,
      startTime: '09:00',
      earliestHour: 8,
      latestHour: 23,
      preferredDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    },
    dailyAutomation: {
      enabled: true,
      runTime: '08:00',
      timezone:
        process.env.AUTOMATION_TIMEZONE ||
        process.env.TZ ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'UTC',
      videosPerDay: 8,
      intervalHours: 2,
      firstPublishTime: '09:00',
      autoUploadToYouTube: true,
      autoSyncToSheets: true,
      lastRunDate: null,
      lastRunAt: null,
      lastRunStatus: 'idle',
      lastRunMessage: null,
    },
    logoConfig: DEFAULT_LOGO_CONFIG,
    gradientsConfig: DEFAULT_GRADIENTS_CONFIG,
    quoteStyleConfig: DEFAULT_QUOTE_STYLE,
  };
}

function seedDefaultSettings() {
  const existing = db.prepare(`SELECT value_json FROM studio_settings WHERE key = 'studio_settings'`).get();
  if (!existing) {
    const defaults = getDefaultSettings();
    db.prepare(`INSERT INTO studio_settings (key, value_json, updated_at) VALUES (?, ?, ?)`)
      .run('studio_settings', JSON.stringify(defaults), new Date().toISOString());
  }

  const migrated = db.prepare(`SELECT value_json FROM studio_settings WHERE key = 'user_mp3_default_v1'`).get();
  if (!migrated) {
    saveSettings({
      activeMusicTrackId: 'user-default-motivation-mp3',
      autoSelectMoodTrack: false,
    });
    db.prepare(`UPDATE videos SET music_track_id = 'user-default-motivation-mp3'`).run();
    db.prepare(`INSERT INTO studio_settings (key, value_json, updated_at) VALUES (?, ?, ?)`)
      .run('user_mp3_default_v1', 'true', new Date().toISOString());
  }

  const migratedAuto = db.prepare(`SELECT value_json FROM studio_settings WHERE key = 'daily_8am_2h_defaults_v1'`).get();
  if (!migratedAuto) {
    const current = getSettings();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    saveSettings({
      dailyLimit: 8,
      autoUploadSchedule: true,
      autoSyncSheets: true,
      scheduleConfig: {
        ...current.scheduleConfig,
        intervalHours: 2,
        startDate: todayStr,
        startTime: '09:00',
        earliestHour: 8,
        latestHour: 23,
      },
      dailyAutomation: {
        ...current.dailyAutomation,
        enabled: true,
        runTime: '08:00',
        videosPerDay: 8,
        intervalHours: 2,
        firstPublishTime: '09:00',
        autoUploadToYouTube: true,
        autoSyncToSheets: true,
      },
    });
    db.prepare(`INSERT INTO studio_settings (key, value_json, updated_at) VALUES (?, ?, ?)`)
      .run('daily_8am_2h_defaults_v1', 'true', new Date().toISOString());
  }
}

function seedSampleAssets() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO uploaded_assets (id, name, kind, file_url, size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const sample of STUDIO_SAMPLE_IMAGES) {
    const fileName = path.basename(sample.fileUrl);
    const fullPath = path.join(SAMPLES_DIR, fileName);
    const sizeBytes = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
    insert.run(sample.id, sample.name, 'sample', sample.fileUrl, sizeBytes, '2026-01-01T00:00:00.000Z');
  }
}

export function getSettings(): StudioSettings {
  const row = db.prepare(`SELECT value_json FROM studio_settings WHERE key = 'studio_settings'`).get() as
    | { value_json: string }
    | undefined;
  const defaults = getDefaultSettings();
  if (!row) return defaults;
  try {
    const parsed = JSON.parse(row.value_json) as Partial<StudioSettings>;
    const envSheet = resolveEnvSpreadsheet();
    return {
      ...defaults,
      ...parsed,
      connectedSpreadsheetId: parsed.connectedSpreadsheetId || envSheet.id || '',
      connectedSpreadsheetUrl: parsed.connectedSpreadsheetUrl || envSheet.url || '',
      musicVolume: parsed.musicVolume && parsed.musicVolume <= 45 ? 75 : (parsed.musicVolume ?? defaults.musicVolume),
      scheduleConfig: { ...defaults.scheduleConfig, ...(parsed.scheduleConfig ?? {}) },
      dailyAutomation: { ...defaults.dailyAutomation, ...(parsed.dailyAutomation ?? {}) },
      logoConfig: { ...defaults.logoConfig, ...(parsed.logoConfig ?? {}) },
      gradientsConfig: { ...defaults.gradientsConfig, ...(parsed.gradientsConfig ?? {}) },
      quoteStyleConfig: { ...defaults.quoteStyleConfig, ...(parsed.quoteStyleConfig ?? {}) },
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(partial: Partial<StudioSettings>): StudioSettings {
  const current = getSettings();
  const merged: StudioSettings = {
    ...current,
    ...partial,
    scheduleConfig: { ...current.scheduleConfig, ...(partial.scheduleConfig ?? {}) },
    dailyAutomation: { ...current.dailyAutomation, ...(partial.dailyAutomation ?? {}) },
    logoConfig: { ...current.logoConfig, ...(partial.logoConfig ?? {}) },
    gradientsConfig: { ...current.gradientsConfig, ...(partial.gradientsConfig ?? {}) },
    quoteStyleConfig: { ...current.quoteStyleConfig, ...(partial.quoteStyleConfig ?? {}) },
  };
  db.prepare(`
    INSERT INTO studio_settings (key, value_json, updated_at)
    VALUES ('studio_settings', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(JSON.stringify(merged), new Date().toISOString());
  return merged;
}

export function mapVideoRow(row: any): VideoRecord {
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    quote: row.quote,
    description: row.description,
    hashtags: safeJson(row.hashtags, []),
    category: row.category,
    visualStyle: row.visual_style,
    productionMode: row.production_mode,
    imageSource: row.image_source,
    aiEngineUsed: row.ai_engine_used,
    resolution: row.resolution,
    durationSec: row.duration_sec,
    status: row.status,
    errorMessage: row.error_message,
    backgroundImageUrl: row.background_image_url,
    thumbnailUrl: row.thumbnail_url,
    mp4Url: row.mp4_url,
    fileSizeBytes: row.file_size_bytes,
    scenes: safeJson(row.scenes_json, []),
    musicTrackId: row.music_track_id,
    musicVolume: row.music_volume,
    logoConfig: { ...DEFAULT_LOGO_CONFIG, ...safeJson(row.logo_config_json, {}) },
    gradientsConfig: { ...DEFAULT_GRADIENTS_CONFIG, ...safeJson(row.gradients_config_json, {}) },
    quoteStyleConfig: { ...DEFAULT_QUOTE_STYLE, ...safeJson(row.quote_style_config_json, {}) },
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    youtubeVideoId: row.youtube_video_id,
    privacyStatus: row.privacy_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllVideos(): VideoRecord[] {
  const rows = db.prepare(`SELECT * FROM videos ORDER BY created_at DESC`).all();
  return rows.map(mapVideoRow);
}

export function getVideoById(id: string): VideoRecord | null {
  const row = db.prepare(`SELECT * FROM videos WHERE id = ?`).get(id);
  return row ? mapVideoRow(row) : null;
}

export function upsertVideo(v: VideoRecord) {
  db.prepare(`
    INSERT INTO videos (
      id, title, topic, quote, description, hashtags, category, visual_style,
      production_mode, image_source, ai_engine_used, resolution, duration_sec,
      status, error_message, background_image_url, thumbnail_url, mp4_url,
      file_size_bytes, scenes_json, music_track_id, music_volume,
      logo_config_json, gradients_config_json, quote_style_config_json,
      scheduled_at, published_at, youtube_video_id, privacy_status, created_at, updated_at
    ) VALUES (
      @id, @title, @topic, @quote, @description, @hashtags, @category, @visualStyle,
      @productionMode, @imageSource, @aiEngineUsed, @resolution, @durationSec,
      @status, @errorMessage, @backgroundImageUrl, @thumbnailUrl, @mp4Url,
      @fileSizeBytes, @scenesJson, @musicTrackId, @musicVolume,
      @logoConfigJson, @gradientsConfigJson, @quoteStyleConfigJson,
      @scheduledAt, @publishedAt, @youtubeVideoId, @privacyStatus, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      topic = excluded.topic,
      quote = excluded.quote,
      description = excluded.description,
      hashtags = excluded.hashtags,
      category = excluded.category,
      visual_style = excluded.visual_style,
      production_mode = excluded.production_mode,
      image_source = excluded.image_source,
      ai_engine_used = excluded.ai_engine_used,
      resolution = excluded.resolution,
      duration_sec = excluded.duration_sec,
      status = excluded.status,
      error_message = excluded.error_message,
      background_image_url = excluded.background_image_url,
      thumbnail_url = excluded.thumbnail_url,
      mp4_url = excluded.mp4_url,
      file_size_bytes = excluded.file_size_bytes,
      scenes_json = excluded.scenes_json,
      music_track_id = excluded.music_track_id,
      music_volume = excluded.music_volume,
      logo_config_json = excluded.logo_config_json,
      gradients_config_json = excluded.gradients_config_json,
      quote_style_config_json = excluded.quote_style_config_json,
      scheduled_at = excluded.scheduled_at,
      published_at = excluded.published_at,
      youtube_video_id = excluded.youtube_video_id,
      privacy_status = excluded.privacy_status,
      updated_at = excluded.updated_at
  `).run({
    id: v.id,
    title: v.title,
    topic: v.topic,
    quote: v.quote,
    description: v.description,
    hashtags: JSON.stringify(v.hashtags),
    category: v.category,
    visualStyle: v.visualStyle,
    productionMode: v.productionMode,
    imageSource: v.imageSource,
    aiEngineUsed: v.aiEngineUsed,
    resolution: v.resolution,
    durationSec: v.durationSec,
    status: v.status,
    errorMessage: v.errorMessage ?? null,
    backgroundImageUrl: v.backgroundImageUrl,
    thumbnailUrl: v.thumbnailUrl,
    mp4Url: v.mp4Url,
    fileSizeBytes: v.fileSizeBytes,
    scenesJson: JSON.stringify(v.scenes),
    musicTrackId: v.musicTrackId,
    musicVolume: v.musicVolume,
    logoConfigJson: JSON.stringify(v.logoConfig),
    gradientsConfigJson: JSON.stringify(v.gradientsConfig),
    quoteStyleConfigJson: JSON.stringify(v.quoteStyleConfig),
    scheduledAt: v.scheduledAt ?? null,
    publishedAt: v.publishedAt ?? null,
    youtubeVideoId: v.youtubeVideoId ?? null,
    privacyStatus: v.privacyStatus,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  });
}

export function getAllUsedContent(): UsedContentRecord[] {
  const rows = db.prepare(`SELECT * FROM used_content ORDER BY created_at DESC`).all() as any[];
  return rows.map((r) => ({
    id: r.id,
    videoId: r.video_id,
    quote: r.quote,
    topic: r.topic,
    title: r.title,
    normalizedQuote: r.normalized_quote,
    createdAt: r.created_at,
  }));
}

export function getAllMusicTracks(): MusicTrackRecord[] {
  const rows = db.prepare(`SELECT * FROM music_tracks ORDER BY source_type ASC, created_at DESC`).all() as any[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    mood: r.mood,
    artist: r.artist,
    license: r.license,
    durationSec: r.duration_sec,
    sourceType: r.source_type,
    fileUrl: r.file_url,
    synthPreset: r.synth_preset ?? undefined,
    createdAt: r.created_at,
  }));
}

export function getUploadedAssets(kind?: 'photo' | 'logo' | 'sample'): UploadedAsset[] {
  const rows = kind
    ? (db.prepare(`SELECT * FROM uploaded_assets WHERE kind = ? ORDER BY created_at DESC`).all(kind) as any[])
    : (db.prepare(`SELECT * FROM uploaded_assets ORDER BY created_at DESC`).all() as any[]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    fileUrl: r.file_url,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
  }));
}

export function getLatestPipelineJob(): PipelineJob | null {
  const row = db.prepare(`SELECT * FROM pipeline_jobs ORDER BY started_at DESC LIMIT 1`).get() as any;
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    totalVideos: row.total_videos,
    completedVideos: row.completed_videos,
    currentStageIndex: row.current_stage_index,
    currentStageName: row.current_stage_name,
    activeProvider: row.active_provider,
    logs: safeJson(row.logs_json, []),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function savePipelineJob(job: PipelineJob) {
  db.prepare(`
    INSERT INTO pipeline_jobs (
      id, status, total_videos, completed_videos, current_stage_index,
      current_stage_name, active_provider, logs_json, started_at, finished_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      total_videos = excluded.total_videos,
      completed_videos = excluded.completed_videos,
      current_stage_index = excluded.current_stage_index,
      current_stage_name = excluded.current_stage_name,
      active_provider = excluded.active_provider,
      logs_json = excluded.logs_json,
      finished_at = excluded.finished_at
  `).run(
    job.id,
    job.status,
    job.totalVideos,
    job.completedVideos,
    job.currentStageIndex,
    job.currentStageName,
    job.activeProvider,
    JSON.stringify(job.logs.slice(-120)),
    job.startedAt,
    job.finishedAt ?? null
  );
}

export function computeLocalStorageBytes(): number {
  let total = 0;
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else total += fs.statSync(full).size;
    }
  };
  walk(DATA_DIR);
  return total;
}

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
