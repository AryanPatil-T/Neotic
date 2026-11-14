import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  getProviderStatuses,
  recommendTrackWithAI,
  testProviderConnection,
} from './server/aiProviders.ts';
import {
  ensureBuiltInSynthWavs,
  generateCustomSynthTrack,
} from './server/audioSynth.ts';
import {
  IMAGES_DIR,
  MUSIC_DIR,
  SAMPLES_DIR,
  THUMBS_DIR,
  UPLOADS_DIR,
  VIDEOS_DIR,
  computeLocalStorageBytes,
  db,
  getAllMusicTracks,
  getAllUsedContent,
  getAllVideos,
  getLatestPipelineJob,
  getSettings,
  getUploadedAssets,
  getVideoById,
  initDatabase,
  saveSettings,
  upsertVideo,
} from './server/db.ts';
import {
  buildStudioWorkbookBuffer,
  extractSpreadsheetId,
  importStudioWorkbookBuffer,
  syncToGoogleSheets,
} from './server/excelSync.ts';
import { acquireVerticalImage } from './server/mediaAcquisition.ts';
import {
  getActiveOrLatestJob,
  startBatchGenerationPipeline,
} from './server/pipeline.ts';
import {
  cleanupUploadedMediaFiles,
  computeNextPublishSlots,
  syncPendingScheduledVideos,
  uploadShortToYouTube,
} from './server/scheduler.ts';
import {
  getAutomationStatus,
  getSessionGoogleToken,
  setSessionGoogleToken,
  startAutomationDaemon,
  triggerDailyAutomationRun,
} from './server/automationDaemon.ts';
import { renderShortVideoMp4 } from './server/videoRenderer.ts';

dotenv.config();

initDatabase();
ensureBuiltInSynthWavs();

const app = express();
app.use(express.json({ limit: '25mb' }));

// Static media serving (no .jpg imports in TS)
app.use('/media/videos', express.static(VIDEOS_DIR));
app.use('/media/thumbs', express.static(THUMBS_DIR));
app.use('/media/images', express.static(IMAGES_DIR));
app.use('/media/music', express.static(MUSIC_DIR));
app.use('/media/uploads', express.static(UPLOADS_DIR));
app.use('/media/samples', express.static(SAMPLES_DIR));
app.use('/assets', express.static(path.resolve(process.cwd(), 'public/assets')));

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext}`);
  },
});
const upload = multer({ storage: uploadStorage, limits: { fileSize: 50 * 1024 * 1024 } });
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Free-tier cloud healthcheck & uptime ping endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    automation: getAutomationStatus(),
  });
});

// Overview / Dashboard State
app.get('/api/studio/overview', (_req, res) => {
  const videos = getAllVideos();
  const settings = getSettings();
  const job = getActiveOrLatestJob(getLatestPipelineJob());
  const storageBytes = computeLocalStorageBytes();
  const providers = getProviderStatuses();
  const todayPrefix = new Date().toISOString().slice(0, 10);

  const kpis = {
    generatedToday: videos.filter((v) => v.createdAt.startsWith(todayPrefix)).length,
    scheduled: videos.filter((v) => v.status === 'scheduled').length,
    published: videos.filter((v) => v.status === 'published').length,
    failed: videos.filter((v) => v.status === 'failed').length,
    localStorageBytes: storageBytes,
    totalLibrary: videos.length,
  };

  res.json({
    kpis,
    settings,
    job,
    providers,
    recentVideos: videos.slice(0, 6),
    automation: getAutomationStatus(),
  });
});

// Settings
app.get('/api/settings', (_req, res) => {
  res.json({ settings: getSettings(), providers: getProviderStatuses() });
});

app.put('/api/settings', (req, res) => {
  const updated = saveSettings(req.body || {});
  res.json({ settings: updated });
});

app.post('/api/providers/:id/test', async (req, res) => {
  const result = await testProviderConnection(req.params.id as any);
  res.json(result);
});

// Pipeline Generation
app.post('/api/pipeline/generate', (req, res) => {
  const active = getActiveOrLatestJob(null);
  if (active && active.status === 'running') {
    return res.status(409).json({ error: 'A generation pipeline is already running.', job: active });
  }
  const settings = getSettings();
  const body = req.body || {};
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (bearer) setSessionGoogleToken(bearer);

  const job = startBatchGenerationPipeline({
    quantity: Number(body.quantity) || 5,
    productionMode: body.productionMode || settings.defaultProductionMode,
    imageSource: body.imageSource || settings.defaultImageSource,
    engine: body.engine || settings.activeEngine,
    quoteTone: body.quoteTone || settings.defaultQuoteTone,
    visualStyles: Array.isArray(body.visualStyles) ? body.visualStyles : ['Dark Cinematic Motivation'],
    categories: Array.isArray(body.categories) ? body.categories : ['Timeless Wisdom'],
    bwMonochrome: body.bwMonochrome !== undefined ? Boolean(body.bwMonochrome) : settings.bwMonochrome,
    autoUploadSchedule: Boolean(body.autoUploadSchedule),
    youtubeAccessToken: bearer || body.youtubeAccessToken || getSessionGoogleToken() || undefined,
    customConcepts: Array.isArray(body.customConcepts) ? body.customConcepts : undefined,
  });
  res.json({ job });
});

app.get('/api/pipeline/status', (_req, res) => {
  const job = getActiveOrLatestJob(getLatestPipelineJob());
  res.json({ job });
});

// Videos CRUD & Actions
app.get('/api/videos', (_req, res) => {
  res.json({ videos: getAllVideos() });
});

app.put('/api/videos/:id', (req, res) => {
  const existing = getVideoById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Video not found' });

  const updated = {
    ...existing,
    ...req.body,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };
  upsertVideo(updated);
  res.json({ video: updated });
});

app.post('/api/videos/:id/render', async (req, res) => {
  const existing = getVideoById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Video not found' });

  try {
    const merged = {
      ...existing,
      ...(req.body || {}),
      id: existing.id,
      status: 'generating' as const,
      updatedAt: new Date().toISOString(),
    };
    if (merged.scenes && merged.scenes.length === 1) {
      merged.scenes[0].overlayText = merged.quote;
    }
    upsertVideo(merged);

    const rendered = await renderShortVideoMp4(merged);
    merged.mp4Url = rendered.mp4Url;
    merged.thumbnailUrl = rendered.thumbnailUrl;
    merged.fileSizeBytes = rendered.fileSizeBytes;
    merged.status = existing.status === 'scheduled' || existing.status === 'published' ? existing.status : 'completed';
    merged.errorMessage = null;
    merged.updatedAt = new Date().toISOString();
    upsertVideo(merged);

    res.json({ video: merged });
  } catch (err: any) {
    existing.status = 'failed';
    existing.errorMessage = err?.message || 'Render failed';
    upsertVideo(existing);
    res.status(500).json({ error: existing.errorMessage });
  }
});

app.post('/api/videos/:id/regenerate-image', async (req, res) => {
  const existing = getVideoById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Video not found' });
  const settings = getSettings();

  try {
    const newImg = await acquireVerticalImage({
      sourceMode: req.body?.imageSource || existing.imageSource,
      visualPrompt: existing.topic || existing.visualStyle,
      visualStyle: existing.visualStyle,
      resolution: existing.resolution,
      bwMonochrome: settings.bwMonochrome,
    });
    const updatedScenes =
      existing.scenes.length > 0
        ? existing.scenes.map((s, idx) => (idx === 0 ? { ...s, imageUrl: newImg } : s))
        : [];
    const updated = {
      ...existing,
      backgroundImageUrl: newImg,
      scenes: updatedScenes,
      updatedAt: new Date().toISOString(),
    };
    const rendered = await renderShortVideoMp4(updated);
    updated.mp4Url = rendered.mp4Url;
    updated.thumbnailUrl = rendered.thumbnailUrl;
    updated.fileSizeBytes = rendered.fileSizeBytes;
    upsertVideo(updated);
    res.json({ video: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Image regeneration failed' });
  }
});

app.delete('/api/videos/:id', (req, res) => {
  const existing = getVideoById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Video not found' });
  db.prepare(`DELETE FROM videos WHERE id = ?`).run(req.params.id);
  const mp4File = path.join(VIDEOS_DIR, `${req.params.id}.mp4`);
  const thumbFile = path.join(THUMBS_DIR, `${req.params.id}.jpg`);
  if (fs.existsSync(mp4File)) fs.unlinkSync(mp4File);
  if (fs.existsSync(thumbFile)) fs.unlinkSync(thumbFile);
  res.json({ ok: true });
});

app.get('/api/videos/:id/download', (req, res) => {
  const existing = getVideoById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Video not found' });
  const mp4Path = path.join(VIDEOS_DIR, `${req.params.id}.mp4`);
  if (!fs.existsSync(mp4Path)) return res.status(404).json({ error: 'MP4 file not rendered yet' });
  const safeName = existing.title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 50) || existing.id;
  res.download(mp4Path, `${safeName}.mp4`);
});

// Assets Upload (Photos & Logos)
app.get('/api/assets', (req, res) => {
  const kind = req.query.kind as 'photo' | 'logo' | 'sample' | undefined;
  res.json({ assets: getUploadedAssets(kind) });
});

app.post('/api/assets/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const kind = req.body.kind === 'logo' ? 'logo' : 'photo';
  const id = `asset_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const fileUrl = `/media/uploads/${req.file.filename}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO uploaded_assets (id, name, kind, file_url, size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.file.originalname, kind, fileUrl, req.file.size, createdAt);

  res.json({
    asset: { id, name: req.file.originalname, kind, fileUrl, sizeBytes: req.file.size, createdAt },
  });
});

app.delete('/api/assets/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM uploaded_assets WHERE id = ?`).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Asset not found' });
  if (row.kind !== 'sample') {
    const filePath = path.join(UPLOADS_DIR, path.basename(row.file_url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare(`DELETE FROM uploaded_assets WHERE id = ?`).run(req.params.id);
  }
  res.json({ ok: true });
});

// Music Library
app.get('/api/music', (_req, res) => {
  res.json({ tracks: getAllMusicTracks() });
});

app.post('/api/music/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
  const id = `track_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const fileUrl = `/media/uploads/${req.file.filename}`;
  const track = {
    id,
    title: String(req.body.title || req.file.originalname.replace(/\.[^.]+$/, '')),
    mood: String(req.body.mood || 'Custom Atmospheric'),
    artist: String(req.body.artist || 'Studio Upload'),
    license: String(req.body.license || 'User Licensed'),
    durationSec: Number(req.body.durationSec) || 30,
    sourceType: 'uploaded' as const,
    fileUrl,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO music_tracks (id, title, mood, artist, license, duration_sec, source_type, file_url, created_at)
    VALUES (@id, @title, @mood, @artist, @license, @durationSec, @sourceType, @fileUrl, @createdAt)
  `).run(track);

  res.json({ track });
});

app.post('/api/music/recommend', async (req, res) => {
  const tracks = getAllMusicTracks();
  const settings = getSettings();
  const promptText = String(req.body?.prompt || 'Dark cinematic motivational short');
  const rec = await recommendTrackWithAI(promptText, tracks, settings.activeEngine);
  res.json(rec);
});

app.post('/api/music/generate', (req, res) => {
  try {
    const body = req.body || {};
    const track = generateCustomSynthTrack({
      title: String(body.title || 'Midnight Echoes'),
      mood: String(body.mood || 'Dark Ambient'),
      bpm: Number(body.bpm) || 70,
      rainLevel: body.rainLevel !== undefined ? Number(body.rainLevel) : undefined,
      bellIntensity: body.bellIntensity !== undefined ? Number(body.bellIntensity) : undefined,
    });
    res.json({ track });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Soundtrack generation failed' });
  }
});

// Daily Automation & Time-Based Auto-Upload
app.get('/api/automation/status', (_req, res) => {
  res.json(getAutomationStatus());
});

app.post('/api/automation/session-token', (req, res) => {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!bearer) {
    setSessionGoogleToken(null);
    return res.json({ active: false });
  }
  setSessionGoogleToken(bearer, Number(req.body?.expiresInSec) || 3300);
  res.json({ active: true });
});

app.post('/api/automation/run-now', (req, res) => {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (bearer) setSessionGoogleToken(bearer);
  const result = triggerDailyAutomationRun('manual', bearer);
  if (!result.started) {
    return res.status(409).json({ error: result.reason, job: result.job });
  }
  res.json({ job: result.job, automation: getAutomationStatus() });
});

app.post('/api/automation/cron-trigger', (req, res) => {
  const expectedSecret = process.env.AUTOMATION_WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = req.headers['x-cron-secret'] || req.query.secret;
    if (provided !== expectedSecret) {
      return res.status(401).json({ error: 'Invalid cron secret' });
    }
  }
  const result = triggerDailyAutomationRun('webhook');
  if (!result.started) {
    return res.status(409).json({ error: result.reason, job: result.job });
  }
  res.json({ ok: true, job: result.job });
});

app.post('/api/automation/sync-pending', async (req, res) => {
  const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, '') || getSessionGoogleToken();
  if (!accessToken) {
    return res.status(401).json({ error: 'Sign in with Google first to upload pending Shorts.' });
  }
  setSessionGoogleToken(accessToken);
  const result = await syncPendingScheduledVideos(accessToken);
  res.json(result);
});

// Scheduler & YouTube
app.post('/api/schedule/preview', (req, res) => {
  const settings = getSettings();
  const config = req.body?.scheduleConfig || settings.scheduleConfig;
  const count = Math.max(1, Math.min(20, Number(req.body?.count) || 8));
  const tz = req.body?.timezone || settings.dailyAutomation?.timezone;
  const slots = computeNextPublishSlots(config, count, getAllVideos(), tz);
  res.json({ slots });
});

app.post('/api/schedule/assign', async (req, res) => {
  const settings = getSettings();
  const videoIds: string[] = Array.isArray(req.body?.videoIds) ? req.body.videoIds : [];
  const uploadToYouTube = Boolean(req.body?.uploadToYouTube);
  const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, '') || getSessionGoogleToken();

  const slots = computeNextPublishSlots(
    settings.scheduleConfig,
    Math.max(1, videoIds.length),
    getAllVideos(),
    settings.dailyAutomation?.timezone
  );
  const results: Array<{ id: string; status: string; scheduledAt?: string; youtubeVideoId?: string; error?: string }> = [];

  for (let i = 0; i < videoIds.length; i++) {
    const v = getVideoById(videoIds[i]);
    if (!v) continue;
    const slot = slots[i];
    if (!slot) continue;

    try {
      let targetVideo = v;
      if (uploadToYouTube && accessToken) {
        const yt = await uploadShortToYouTube({
          video: v,
          accessToken,
          publishAtIso: slot.isoUtc,
        });
        targetVideo.youtubeVideoId = yt.youtubeVideoId;
        targetVideo = cleanupUploadedMediaFiles(targetVideo);
      }
      targetVideo.scheduledAt = slot.isoUtc;
      targetVideo.status = 'scheduled';
      targetVideo.errorMessage = null;
      targetVideo.updatedAt = new Date().toISOString();
      upsertVideo(targetVideo);
      results.push({
        id: targetVideo.id,
        status: targetVideo.status,
        scheduledAt: slot.isoUtc,
        youtubeVideoId: targetVideo.youtubeVideoId ?? undefined,
      });
    } catch (err: any) {
      results.push({ id: v.id, status: 'failed', error: err?.message || 'Upload failed' });
    }
  }

  res.json({ results });
});

// Database / Excel / Google Sheets
app.get('/api/database/tables', (_req, res) => {
  res.json({
    videos: getAllVideos(),
    usedContent: getAllUsedContent(),
    musicTracks: getAllMusicTracks(),
    settings: getSettings(),
  });
});

app.get('/api/database/export.xlsx', (_req, res) => {
  const buf = buildStudioWorkbookBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="ai_shorts_studio_database.xlsx"');
  res.send(buf);
});

app.post('/api/database/import.xlsx', memUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No .xlsx file uploaded' });
  try {
    const summary = importStudioWorkbookBuffer(req.file.buffer);
    res.json({ summary });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Invalid workbook' });
  }
});

app.post('/api/database/sheets-link', (req, res) => {
  const raw = String(req.body?.spreadsheetUrlOrId || '').trim();
  if (!raw) {
    const updated = saveSettings({ connectedSpreadsheetId: '', connectedSpreadsheetUrl: '' });
    return res.json({ settings: updated });
  }
  const id = extractSpreadsheetId(raw);
  const url = raw.startsWith('http')
    ? raw
    : `https://docs.google.com/spreadsheets/d/${id}/edit`;
  const updated = saveSettings({
    connectedSpreadsheetId: id,
    connectedSpreadsheetUrl: url,
  });
  res.json({ settings: updated });
});

app.post('/api/database/sheets-sync', async (req, res) => {
  const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, '') || getSessionGoogleToken();
  if (!accessToken) {
    return res.status(401).json({ error: 'Google sign-in required to sync Google Sheets.' });
  }
  try {
    const result = await syncToGoogleSheets(accessToken);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Google Sheets sync failed' });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Shorts Studio server listening on http://localhost:${PORT}`);
    startAutomationDaemon();
  });
}

startServer();
