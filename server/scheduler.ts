import fs from 'fs';
import path from 'path';
import type { ScheduleConfig, VideoRecord } from '../src/shared/types.ts';
import { IMAGES_DIR, VIDEOS_DIR, getAllVideos, getSettings, upsertVideo } from './db.ts';
import { syncToGoogleSheets } from './excelSync.ts';

const JS_DAY_TO_CODE = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export interface ComputedSlot {
  isoUtc: string;
  localDisplay: string;
  dayCode: string;
}

export function getZonedParts(
  date: Date,
  timeZone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=SUN..6=SAT
  ymd: string;
  hhmm: string;
} {
  let tz = timeZone || 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    tz = 'UTC';
  }

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour) % 24;
  const minute = Number(map.minute);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[map.weekday] ?? date.getUTCDay();
  const ymd = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { year, month, day, hour, minute, dayOfWeek, ymd, hhmm };
}

export function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const targetUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const guess = new Date(targetUtcMs);
  const p = getZonedParts(guess, timeZone);
  const guessWallUtcMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
  const offsetMs = guessWallUtcMs - targetUtcMs;
  const adjusted = new Date(targetUtcMs - offsetMs);
  // Second refinement pass across DST transitions
  const p2 = getZonedParts(adjusted, timeZone);
  const guess2WallUtcMs = Date.UTC(p2.year, p2.month - 1, p2.day, p2.hour, p2.minute, 0, 0);
  const delta2 = guess2WallUtcMs - targetUtcMs;
  return new Date(adjusted.getTime() - delta2);
}

export function computeNextPublishSlots(
  config: ScheduleConfig,
  count: number,
  existingVideos: VideoRecord[] = getAllVideos(),
  timeZone?: string
): ComputedSlot[] {
  const tz = timeZone || getSettings().dailyAutomation?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const occupiedBuckets = new Set<number>();

  for (const v of existingVideos) {
    if (v.scheduledAt && (v.status === 'scheduled' || v.status === 'published')) {
      const ts = Date.parse(v.scheduledAt);
      if (!Number.isNaN(ts)) {
        occupiedBuckets.add(Math.floor(ts / (15 * 60 * 1000)));
      }
    }
  }

  const intervalHours = Math.max(0.5, Number(config.intervalHours) || 2);
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const earliestHour = Math.max(0, Math.min(23, Number(config.earliestHour ?? 8)));
  const latestHour = Math.max(earliestHour, Math.min(23, Number(config.latestHour ?? 23)));
  const preferredDays =
    config.preferredDays && config.preferredDays.length > 0
      ? new Set(config.preferredDays)
      : new Set(JS_DAY_TO_CODE);

  const [startHStr, startMStr] = (config.startTime || '09:00').split(':');
  const startH = Math.max(0, Math.min(23, Number(startHStr) || 9));
  const startM = Math.max(0, Math.min(59, Number(startMStr) || 0));

  const nowParts = getZonedParts(new Date(), tz);
  const [cfgY, cfgM, cfgD] = (config.startDate || nowParts.ymd).split('-').map(Number);

  let cursor = zonedWallClockToUtc(
    cfgY || nowParts.year,
    cfgM || nowParts.month,
    cfgD || nowParts.day,
    startH,
    startM,
    tz
  );

  const minFutureMs = Date.now() + 5 * 60 * 1000;

  // Step forward cleanly preserving the daily cadence if startDate/startTime is in the past
  if (cursor.getTime() < minFutureMs) {
    // Jump to today's startTime first if cursor was days ago
    const todayAnchor = zonedWallClockToUtc(nowParts.year, nowParts.month, nowParts.day, startH, startM, tz);
    if (cursor.getTime() < todayAnchor.getTime()) {
      cursor = todayAnchor;
    }
    while (cursor.getTime() < minFutureMs) {
      cursor = new Date(cursor.getTime() + intervalMs);
    }
  }

  const slots: ComputedSlot[] = [];
  let guard = 0;

  while (slots.length < count && guard < 2500) {
    guard++;
    const zp = getZonedParts(cursor, tz);
    const dayCode = JS_DAY_TO_CODE[zp.dayOfWeek];
    const hour = zp.hour;
    const bucket = Math.floor(cursor.getTime() / (15 * 60 * 1000));

    const dayValid = preferredDays.has(dayCode);
    const hourValid = hour >= earliestHour && hour <= latestHour;
    const free = !occupiedBuckets.has(bucket);

    if (dayValid && hourValid && free && cursor.getTime() >= minFutureMs) {
      occupiedBuckets.add(bucket);
      slots.push({
        isoUtc: cursor.toISOString(),
        localDisplay: cursor.toLocaleString('en-US', {
          timeZone: tz,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        dayCode,
      });
      cursor = new Date(cursor.getTime() + intervalMs);
    } else if (!dayValid || hour > latestHour) {
      // Advance to next day's anchor hour (either startH or earliestHour, whichever is >= earliestHour)
      const anchorHour = Math.max(earliestHour, startH <= latestHour ? startH : earliestHour);
      const nextUtcDay = new Date(Date.UTC(zp.year, zp.month - 1, zp.day + 1));
      cursor = zonedWallClockToUtc(
        nextUtcDay.getUTCFullYear(),
        nextUtcDay.getUTCMonth() + 1,
        nextUtcDay.getUTCDate(),
        anchorHour,
        startM,
        tz
      );
    } else if (hour < earliestHour) {
      const anchorHour = Math.max(earliestHour, startH <= latestHour ? startH : earliestHour);
      cursor = zonedWallClockToUtc(zp.year, zp.month, zp.day, anchorHour, startM, tz);
    } else {
      cursor = new Date(cursor.getTime() + intervalMs);
    }
  }

  return slots;
}

export async function uploadShortToYouTube(params: {
  video: VideoRecord;
  accessToken: string;
  publishAtIso?: string | null;
}): Promise<{ youtubeVideoId: string }> {
  const { video, accessToken, publishAtIso } = params;
  const rawMp4 = (video.mp4Url || '').split('?')[0].trim();
  const mp4File = rawMp4 ? path.basename(rawMp4) : '';
  const mp4Path = mp4File ? path.join(VIDEOS_DIR, mp4File) : '';
  if (!mp4Path || !fs.existsSync(mp4Path) || !fs.statSync(mp4Path).isFile()) {
    throw new Error('Rendered MP4 file not found on disk (already cleaned up or not rendered yet).');
  }

  const videoBytes = fs.readFileSync(mp4Path);
  const hashtagStr = video.hashtags.map((h) => `#${h}`).join(' ');
  const fullDescription = `${video.description}\n\n${hashtagStr}\n#Shorts`.trim();

  // Ensure publishAt is strictly in the future if provided
  const validFuturePublishAt =
    publishAtIso && Date.parse(publishAtIso) > Date.now() + 60 * 1000 ? publishAtIso : undefined;

  const metadata: any = {
    snippet: {
      title: video.title.slice(0, 95),
      description: fullDescription.slice(0, 4900),
      tags: [...video.hashtags, 'Shorts'].slice(0, 15),
      categoryId: '22',
    },
    status: {
      privacyStatus: validFuturePublishAt ? 'private' : video.privacyStatus || 'private',
      selfDeclaredMadeForKids: false,
      ...(validFuturePublishAt ? { publishAt: validFuturePublishAt } : {}),
    },
  };

  // Step 1: Initiate YouTube resumable upload
  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(videoBytes.length),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => initRes.statusText);
    throw new Error(`YouTube upload init failed (${initRes.status}): ${errText}`);
  }

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('YouTube did not return a resumable upload location header.');
  }

  // Step 2: Upload MP4 payload
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBytes.length),
    },
    body: videoBytes,
  });

  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => putRes.statusText);
    throw new Error(`YouTube upload failed (${putRes.status}): ${errText}`);
  }

  const uploaded = (await putRes.json()) as any;
  if (!uploaded?.id) {
    throw new Error('YouTube response missing uploaded video ID.');
  }

  return { youtubeVideoId: uploaded.id };
}

/**
 * Deletes the local MP4 (and per-video fetched stock image) once YouTube confirms upload.
 * Keeps lightweight metadata + YouTube ID + thumbnail in SQLite/Google Sheets so
 * the Non-Repetition Engine still remembers every published Short with near-zero disk usage.
 */
export function cleanupUploadedMediaFiles(video: VideoRecord): VideoRecord {
  const candidates = new Set<string>();
  if (video.mp4Url) {
    candidates.add(path.join(VIDEOS_DIR, path.basename(video.mp4Url.split('?')[0])));
  }
  candidates.add(path.join(VIDEOS_DIR, `${video.id}.mp4`));

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
    } catch {
      // non-fatal cleanup error
    }
  }

  // Delete per-video generated/fetched images in IMAGES_DIR (never shared samples or user uploads)
  const imgUrls = [
    video.backgroundImageUrl,
    ...(video.scenes || []).map((s) => s.imageUrl),
  ].filter(Boolean);

  for (const url of imgUrls) {
    const clean = url.split('?')[0];
    if (clean.startsWith('/media/images/')) {
      const base = path.basename(clean);
      const imgPath = base ? path.join(IMAGES_DIR, base) : '';
      try {
        if (imgPath && fs.existsSync(imgPath) && fs.statSync(imgPath).isFile()) fs.unlinkSync(imgPath);
      } catch {
        // non-fatal cleanup error
      }
    }
  }

  const fallbackThumb = video.thumbnailUrl || '/media/samples/dark_lone_wolf_1794548198442.jpg';
  return {
    ...video,
    mp4Url: '',
    fileSizeBytes: 0,
    backgroundImageUrl: video.backgroundImageUrl.startsWith('/media/images/')
      ? fallbackThumb
      : video.backgroundImageUrl,
    scenes: (video.scenes || []).map((s) => ({
      ...s,
      imageUrl: s.imageUrl.startsWith('/media/images/') ? fallbackThumb : s.imageUrl,
    })),
  };
}

export async function syncPendingScheduledVideos(accessToken: string): Promise<{
  uploadedCount: number;
  skippedCount: number;
  sheetsSynced: boolean;
  errors: string[];
}> {
  const settings = getSettings();
  const pending = getAllVideos()
    .filter((v) => v.status === 'scheduled' && !v.youtubeVideoId && Boolean(v.mp4Url))
    .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));

  let uploadedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const v of pending) {
    try {
      // If scheduledAt is already in the past, recompute next available future slot
      let publishAt = v.scheduledAt;
      if (!publishAt || Date.parse(publishAt) <= Date.now() + 2 * 60 * 1000) {
        const nextSlot = computeNextPublishSlots(
          settings.scheduleConfig,
          1,
          getAllVideos(),
          settings.dailyAutomation?.timezone
        )[0];
        if (nextSlot) {
          publishAt = nextSlot.isoUtc;
          v.scheduledAt = publishAt;
        }
      }

      const yt = await uploadShortToYouTube({
        video: v,
        accessToken,
        publishAtIso: publishAt,
      });

      v.youtubeVideoId = yt.youtubeVideoId;
      v.status = 'scheduled';
      v.errorMessage = null;
      v.updatedAt = new Date().toISOString();
      const cleaned = cleanupUploadedMediaFiles(v);
      upsertVideo(cleaned);
      uploadedCount++;
    } catch (err: any) {
      const msg = err?.message || String(err);
      errors.push(`${v.title}: ${msg}`);
      skippedCount++;
      // Stop early on YouTube quota/auth errors so we don't spam failing requests
      if (/quota|401|403|unauthorized/i.test(msg)) {
        break;
      }
    }
  }

  let sheetsSynced = false;
  if (settings.autoSyncSheets || settings.dailyAutomation?.autoSyncToSheets) {
    try {
      await syncToGoogleSheets(accessToken);
      sheetsSynced = true;
    } catch (err: any) {
      errors.push(`Google Sheets sync: ${err?.message || err}`);
    }
  }

  return { uploadedCount, skippedCount, sheetsSynced, errors };
}
