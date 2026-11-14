import { CONTENT_CATEGORIES, type PipelineJob, VISUAL_STYLES } from '../src/shared/types.ts';
import { getAllVideos, getSettings, saveSettings } from './db.ts';
import { syncToGoogleSheets } from './excelSync.ts';
import { getActiveOrLatestJob, startBatchGenerationPipeline } from './pipeline.ts';
import { getZonedParts, zonedWallClockToUtc } from './scheduler.ts';

interface InMemoryToken {
  token: string;
  expiresAt: number;
}

let sessionGoogleToken: InMemoryToken | null = null;
let daemonTimer: NodeJS.Timeout | null = null;

export function setSessionGoogleToken(token: string | null, expiresInSec = 3300) {
  if (!token) {
    sessionGoogleToken = null;
    return;
  }
  sessionGoogleToken = {
    token,
    expiresAt: Date.now() + Math.max(60, expiresInSec) * 1000,
  };
}

export function getSessionGoogleToken(): string | null {
  if (!sessionGoogleToken) return null;
  if (Date.now() >= sessionGoogleToken.expiresAt) {
    sessionGoogleToken = null;
    return null;
  }
  return sessionGoogleToken.token;
}

function parseHHMM(hhmm: string): { hour: number; minute: number } {
  const [hStr, mStr] = (hhmm || '08:00').split(':');
  const hour = Math.max(0, Math.min(23, Number(hStr) || 8));
  const minute = Math.max(0, Math.min(59, Number(mStr) || 0));
  return { hour, minute };
}

export function computeNextDailyRun() {
  const settings = getSettings();
  const cfg = settings.dailyAutomation;
  const tz = cfg.timezone || 'UTC';
  const now = new Date();
  const nowParts = getZonedParts(now, tz);
  const { hour, minute } = parseHHMM(cfg.runTime);

  let targetDate = zonedWallClockToUtc(nowParts.year, nowParts.month, nowParts.day, hour, minute, tz);
  const alreadyRanToday = cfg.lastRunDate === nowParts.ymd;

  if (alreadyRanToday || targetDate.getTime() <= now.getTime()) {
    const nextUtcDay = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day + 1));
    targetDate = zonedWallClockToUtc(
      nextUtcDay.getUTCFullYear(),
      nextUtcDay.getUTCMonth() + 1,
      nextUtcDay.getUTCDate(),
      hour,
      minute,
      tz
    );
  }

  return {
    nextRunIso: targetDate.toISOString(),
    nextRunDisplay: targetDate.toLocaleString('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export function getAutomationStatus() {
  const settings = getSettings();
  const videos = getAllVideos();
  const pendingYouTubeUploads = videos.filter(
    (v) => v.status === 'scheduled' && !v.youtubeVideoId && Boolean(v.mp4Url)
  ).length;
  const activeToken = getSessionGoogleToken();
  const next = computeNextDailyRun();

  return {
    config: settings.dailyAutomation,
    nextRunIso: next.nextRunIso,
    nextRunDisplay: next.nextRunDisplay,
    pendingYouTubeUploads,
    hasActiveSessionToken: Boolean(activeToken),
    tokenExpiresAt: sessionGoogleToken ? new Date(sessionGoogleToken.expiresAt).toISOString() : null,
  };
}

export function triggerDailyAutomationRun(
  source: 'cron' | 'manual' | 'webhook',
  overrideToken?: string | null
): { started: boolean; job?: PipelineJob; reason?: string } {
  const active = getActiveOrLatestJob(null);
  if (active && active.status === 'running') {
    return { started: false, job: active, reason: 'A generation pipeline is already running.' };
  }

  const settings = getSettings();
  const cfg = settings.dailyAutomation;
  const tz = cfg.timezone || 'UTC';
  const nowParts = getZonedParts(new Date(), tz);
  const accessToken = overrideToken || getSessionGoogleToken() || undefined;

  const qty = Math.max(1, Math.min(10, Number(cfg.videosPerDay) || 8));
  const intervalHours = Math.max(1, Math.min(12, Number(cfg.intervalHours) || 2));

  // Keep scheduleConfig aligned with dailyAutomation cadence
  saveSettings({
    scheduleConfig: {
      ...settings.scheduleConfig,
      intervalHours,
      startDate: nowParts.ymd,
      startTime: cfg.firstPublishTime || '09:00',
    },
    dailyAutomation: {
      ...cfg,
      lastRunDate: nowParts.ymd,
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'running',
      lastRunMessage: `Started ${qty} Shorts (${source}) with ${intervalHours}h publish slots.`,
    },
  });

  const job = startBatchGenerationPipeline({
    quantity: qty,
    productionMode: settings.defaultProductionMode,
    imageSource: settings.defaultImageSource,
    engine: settings.activeEngine,
    quoteTone: settings.defaultQuoteTone,
    visualStyles: VISUAL_STYLES.slice(0, 8),
    categories: CONTENT_CATEGORIES.slice(0, 8),
    bwMonochrome: settings.bwMonochrome,
    autoUploadSchedule: true,
    youtubeAccessToken: cfg.autoUploadToYouTube ? accessToken : undefined,
    onComplete: async (finishedJob) => {
      const latestSettings = getSettings();
      const allVids = getAllVideos();
      const pendingYt = allVids.filter(
        (v) => v.status === 'scheduled' && !v.youtubeVideoId && Boolean(v.mp4Url)
      ).length;

      let sheetsNote = '';
      if (latestSettings.dailyAutomation.autoSyncToSheets && accessToken) {
        try {
          await syncToGoogleSheets(accessToken);
          sheetsNote = ' · Google Sheet synced';
        } catch (err: any) {
          sheetsNote = ` · Sheets sync skipped (${err?.message || 'auth'})`;
        }
      }

      const finalStatus =
        finishedJob.status === 'failed'
          ? 'failed'
          : pendingYt > 0 && latestSettings.dailyAutomation.autoUploadToYouTube && !accessToken
          ? 'partial'
          : 'completed';

      saveSettings({
        dailyAutomation: {
          ...latestSettings.dailyAutomation,
          lastRunStatus: finalStatus,
          lastRunMessage:
            finishedJob.status === 'failed'
              ? `Batch failed after ${finishedJob.completedVideos}/${qty} Shorts.`
              : `Generated ${finishedJob.completedVideos}/${qty} Shorts on ${intervalHours}h slots${
                  pendingYt > 0 ? ` (${pendingYt} awaiting Google Sign-In to upload to YouTube)` : ' · Uploaded to YouTube'
                }${sheetsNote}.`,
        },
      });
    },
  });

  return { started: true, job };
}

function checkDailyTick() {
  try {
    const settings = getSettings();
    const cfg = settings.dailyAutomation;
    if (!cfg?.enabled) return;

    const tz = cfg.timezone || 'UTC';
    const nowParts = getZonedParts(new Date(), tz);
    if (cfg.lastRunDate === nowParts.ymd) return;

    const { hour: targetH, minute: targetM } = parseHHMM(cfg.runTime);
    const nowMinutes = nowParts.hour * 60 + nowParts.minute;
    const targetMinutes = targetH * 60 + targetM;
    const diff = nowMinutes - targetMinutes;

    // Trigger within 0..45 minutes after configured runTime (e.g. 08:00..08:45)
    if (diff >= 0 && diff <= 45) {
      console.log(
        `[DailyAutomation] Triggering 08:00 batch (${cfg.videosPerDay} Shorts, ${cfg.intervalHours}h interval) for ${nowParts.ymd} (${tz})`
      );
      triggerDailyAutomationRun('cron');
    }
  } catch (err) {
    console.error('[DailyAutomation] Tick error:', err);
  }
}

export function startAutomationDaemon() {
  if (daemonTimer) clearInterval(daemonTimer);
  // Check immediately after 5s, then every 30s
  setTimeout(checkDailyTick, 5000);
  daemonTimer = setInterval(checkDailyTick, 30_000);
}
