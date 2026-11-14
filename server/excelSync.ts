import * as XLSX from 'xlsx';
import {
  DEFAULT_GRADIENTS_CONFIG,
  DEFAULT_LOGO_CONFIG,
  DEFAULT_QUOTE_STYLE,
  type VideoRecord,
} from '../src/shared/types.ts';
import {
  getAllMusicTracks,
  getAllUsedContent,
  getAllVideos,
  getSettings,
  getVideoById,
  saveSettings,
  upsertVideo,
} from './db.ts';
import { recordUsedContent } from './nonRepetition.ts';

export function buildStudioWorkbookBuffer(): Buffer {
  const videos = getAllVideos();
  const used = getAllUsedContent();
  const tracks = getAllMusicTracks();
  const settings = getSettings();

  const wb = XLSX.utils.book_new();

  const videoRows = videos.map((v) => ({
    ID: v.id,
    Title: v.title,
    Topic: v.topic,
    Quote: v.quote,
    Category: v.category,
    VisualStyle: v.visualStyle,
    Mode: v.productionMode,
    ImageSource: v.imageSource,
    AIEngine: v.aiEngineUsed,
    Resolution: v.resolution,
    DurationSec: v.durationSec,
    Status: v.status,
    MusicTrackID: v.musicTrackId,
    MusicVolume: v.musicVolume,
    Privacy: v.privacyStatus,
    ScheduledAt: v.scheduledAt ?? '',
    PublishedAt: v.publishedAt ?? '',
    YouTubeVideoID: v.youtubeVideoId ?? '',
    Hashtags: v.hashtags.join(', '),
    Description: v.description,
    MP4Path: v.mp4Url,
    SizeBytes: v.fileSizeBytes,
    CreatedAt: v.createdAt,
  }));

  const usedRows = used.map((u) => ({
    ID: u.id,
    VideoID: u.videoId,
    Quote: u.quote,
    Topic: u.topic,
    Title: u.title,
    NormalizedQuote: u.normalizedQuote,
    CreatedAt: u.createdAt,
  }));

  const musicRows = tracks.map((t) => ({
    ID: t.id,
    Title: t.title,
    Mood: t.mood,
    Artist: t.artist,
    License: t.license,
    DurationSec: t.durationSec,
    SourceType: t.sourceType,
    FileURL: t.fileUrl,
    CreatedAt: t.createdAt,
  }));

  const settingsRows = [
    { Key: 'defaultProductionMode', Value: settings.defaultProductionMode },
    { Key: 'defaultImageSource', Value: settings.defaultImageSource },
    { Key: 'resolution', Value: settings.resolution },
    { Key: 'defaultPrivacy', Value: settings.defaultPrivacy },
    { Key: 'durationSec', Value: String(settings.durationSec) },
    { Key: 'dailyLimit', Value: String(settings.dailyLimit) },
    { Key: 'activeEngine', Value: settings.activeEngine },
    { Key: 'bwMonochrome', Value: String(settings.bwMonochrome) },
    { Key: 'musicVolume', Value: String(settings.musicVolume) },
    { Key: 'activeMusicTrackId', Value: settings.activeMusicTrackId },
    { Key: 'jaccardThreshold', Value: String(settings.jaccardThreshold) },
    { Key: 'trigramThreshold', Value: String(settings.trigramThreshold) },
    { Key: 'scheduleIntervalHours', Value: String(settings.scheduleConfig.intervalHours) },
    { Key: 'scheduleWindow', Value: `${settings.scheduleConfig.earliestHour}:00 - ${settings.scheduleConfig.latestHour}:00` },
    { Key: 'preferredDays', Value: settings.scheduleConfig.preferredDays.join(', ') },
    { Key: 'connectedSpreadsheetId', Value: settings.connectedSpreadsheetId },
  ];

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      videoRows.length > 0
        ? videoRows
        : [
            {
              ID: '',
              Title: '',
              Topic: '',
              Quote: '',
              Category: '',
              VisualStyle: '',
              Mode: '',
              Status: '',
            },
          ]
    ),
    'VIDEO DATABASE'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      usedRows.length > 0
        ? usedRows
        : [{ ID: '', VideoID: '', Quote: '', Topic: '', Title: '', NormalizedQuote: '', CreatedAt: '' }]
    ),
    'USED CONTENT'
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(musicRows), 'MUSIC LIBRARY');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(settingsRows), 'SETTINGS');

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export interface ExcelImportSummary {
  importedVideos: number;
  skippedDuplicates: number;
  conflicts: Array<{ id: string; title: string; reason: string }>;
  importedUsedContent: number;
}

export function importStudioWorkbookBuffer(buf: Buffer): ExcelImportSummary {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const settings = getSettings();
  const summary: ExcelImportSummary = {
    importedVideos: 0,
    skippedDuplicates: 0,
    conflicts: [],
    importedUsedContent: 0,
  };

  const videoSheet = wb.Sheets['VIDEO DATABASE'];
  if (videoSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(videoSheet);
    for (const r of rows) {
      const id = String(r.ID || '').trim();
      const title = String(r.Title || '').trim();
      const quote = String(r.Quote || '').trim();
      if (!id || !quote) continue;

      const existing = getVideoById(id);
      if (existing) {
        summary.skippedDuplicates++;
        summary.conflicts.push({
          id,
          title: title || existing.title,
          reason: 'Video ID already exists in local SQLite database',
        });
        continue;
      }

      const now = new Date().toISOString();
      const record: VideoRecord = {
        id,
        title: title || 'Imported Short',
        topic: String(r.Topic || 'Imported'),
        quote,
        description: String(r.Description || ''),
        hashtags: String(r.Hashtags || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        category: String(r.Category || 'Motivation'),
        visualStyle: String(r.VisualStyle || 'Dark Cinematic Motivation'),
        productionMode: r.Mode === 'multi_scene' ? 'multi_scene' : 'single_image',
        imageSource: 'stock_web',
        aiEngineUsed: String(r.AIEngine || 'imported'),
        resolution: r.Resolution === '720x1280' ? '720x1280' : '1080x1920',
        durationSec: Number(r.DurationSec) || 30,
        status: ['generating', 'completed', 'scheduled', 'published', 'failed'].includes(r.Status)
          ? r.Status
          : 'completed',
        backgroundImageUrl: '/media/samples/dark_lone_wolf_1794548198442.jpg',
        thumbnailUrl: '/media/samples/dark_lone_wolf_1794548198442.jpg',
        mp4Url: String(r.MP4Path || ''),
        fileSizeBytes: Number(r.SizeBytes) || 0,
        scenes: [],
        musicTrackId: String(r.MusicTrackID || settings.activeMusicTrackId),
        musicVolume: Number(r.MusicVolume) || settings.musicVolume,
        logoConfig: DEFAULT_LOGO_CONFIG,
        gradientsConfig: DEFAULT_GRADIENTS_CONFIG,
        quoteStyleConfig: DEFAULT_QUOTE_STYLE,
        scheduledAt: r.ScheduledAt ? String(r.ScheduledAt) : null,
        publishedAt: r.PublishedAt ? String(r.PublishedAt) : null,
        youtubeVideoId: r.YouTubeVideoID ? String(r.YouTubeVideoID) : null,
        privacyStatus: r.Privacy === 'public' || r.Privacy === 'unlisted' ? r.Privacy : 'private',
        createdAt: String(r.CreatedAt || now),
        updatedAt: now,
      };
      upsertVideo(record);
      recordUsedContent(record.id, { quote: record.quote, topic: record.topic, title: record.title });
      summary.importedVideos++;
    }
  }

  const usedSheet = wb.Sheets['USED CONTENT'];
  if (usedSheet) {
    const usedRows = XLSX.utils.sheet_to_json<Record<string, any>>(usedSheet);
    for (const r of usedRows) {
      const quote = String(r.Quote || '').trim();
      if (!quote) continue;
      const inserted = recordUsedContent(String(r.VideoID || r.ID || 'excel_import'), {
        quote,
        topic: String(r.Topic || 'Imported'),
        title: String(r.Title || 'Imported Quote'),
      });
      if (inserted) summary.importedUsedContent++;
    }
  }

  return summary;
}

export async function pullUsedContentFromGoogleSheets(accessToken: string): Promise<{
  importedCount: number;
  spreadsheetId: string;
}> {
  const settings = getSettings();
  const spreadsheetId = settings.connectedSpreadsheetId
    ? extractSpreadsheetId(settings.connectedSpreadsheetId)
    : '';
  if (!spreadsheetId || !accessToken) {
    return { importedCount: 0, spreadsheetId: '' };
  }

  let importedCount = 0;
  try {
    const ranges = [
      encodeURIComponent("'USED CONTENT'!A2:F"),
      encodeURIComponent("'VIDEO DATABASE'!A2:L"),
    ];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${ranges.join(
      '&ranges='
    )}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      return { importedCount: 0, spreadsheetId };
    }
    const data = (await res.json()) as any;
    const valueRanges = Array.isArray(data?.valueRanges) ? data.valueRanges : [];

    // Range 0: USED CONTENT -> [ID, Video ID, Quote, Topic, Title, Created At]
    const usedRows: any[][] = valueRanges[0]?.values || [];
    for (const row of usedRows) {
      const videoId = String(row?.[1] || row?.[0] || 'sheet_archive').trim();
      const quote = String(row?.[2] || '').trim();
      const topic = String(row?.[3] || 'Archived').trim();
      const title = String(row?.[4] || 'Archived Short').trim();
      if (quote && recordUsedContent(videoId, { quote, topic, title })) {
        importedCount++;
      }
    }

    // Range 1: VIDEO DATABASE -> [ID, Title, Topic, Quote, ...]
    const videoRows: any[][] = valueRanges[1]?.values || [];
    for (const row of videoRows) {
      const videoId = String(row?.[0] || 'sheet_archive').trim();
      const title = String(row?.[1] || 'Archived Short').trim();
      const topic = String(row?.[2] || 'Archived').trim();
      const quote = String(row?.[3] || '').trim();
      if (quote && recordUsedContent(videoId, { quote, topic, title })) {
        importedCount++;
      }
    }
  } catch {
    // non-fatal sheet read error
  }

  return { importedCount, spreadsheetId };
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return trimmed;
}

export async function syncToGoogleSheets(accessToken: string): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
}> {
  const settings = getSettings();
  let spreadsheetId = settings.connectedSpreadsheetId ? extractSpreadsheetId(settings.connectedSpreadsheetId) : '';
  let spreadsheetUrl = settings.connectedSpreadsheetUrl;

  const sheetTitles = ['VIDEO DATABASE', 'USED CONTENT', 'MUSIC LIBRARY', 'SETTINGS'];

  if (spreadsheetId) {
    // Verify spreadsheet exists and inspect existing tab names first
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetUrl,sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (metaRes.status === 404) {
      spreadsheetId = '';
      spreadsheetUrl = '';
    } else if (!metaRes.ok) {
      const txt = await metaRes.text().catch(() => metaRes.statusText);
      throw new Error(`Failed to inspect Google Sheet (${metaRes.status}): ${txt}`);
    } else {
      const meta = (await metaRes.json()) as any;
      if (meta.spreadsheetUrl) spreadsheetUrl = meta.spreadsheetUrl;
      const existingTitles = new Set<string>(
        (meta.sheets || []).map((s: any) => s?.properties?.title).filter(Boolean)
      );
      const missingTitles = sheetTitles.filter((t) => !existingTitles.has(t));
      if (missingTitles.length > 0) {
        const addRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: missingTitles.map((title) => ({ addSheet: { properties: { title } } })),
            }),
          }
        );
        if (!addRes.ok) {
          const txt = await addRes.text().catch(() => addRes.statusText);
          throw new Error(`Failed to add missing Google Sheet tabs (${addRes.status}): ${txt}`);
        }
      } else {
        // Merge existing Sheet quote history into local SQLite before writing back
        await pullUsedContentFromGoogleSheets(accessToken);
      }
    }
  }

  if (!spreadsheetId) {
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title: 'AI Shorts Studio — Master Database' },
        sheets: sheetTitles.map((title) => ({ properties: { title } })),
      }),
    });
    if (!createRes.ok) {
      const txt = await createRes.text().catch(() => createRes.statusText);
      throw new Error(`Failed to create Google Sheet (${createRes.status}): ${txt}`);
    }
    const created = (await createRes.json()) as any;
    spreadsheetId = created.spreadsheetId;
    spreadsheetUrl = created.spreadsheetUrl;
    saveSettings({ connectedSpreadsheetId: spreadsheetId, connectedSpreadsheetUrl: spreadsheetUrl });
  }

  const videos = getAllVideos();
  const used = getAllUsedContent();
  const tracks = getAllMusicTracks();

  const videoValues = [
    ['ID', 'Title', 'Topic', 'Quote', 'Category', 'Visual Style', 'Mode', 'Engine', 'Status', 'Scheduled At', 'YouTube ID', 'Created At'],
    ...videos.map((v) => [
      v.id,
      v.title,
      v.topic,
      v.quote,
      v.category,
      v.visualStyle,
      v.productionMode,
      v.aiEngineUsed,
      v.status,
      v.scheduledAt ?? '',
      v.youtubeVideoId ?? '',
      v.createdAt,
    ]),
  ];

  const usedValues = [
    ['ID', 'Video ID', 'Quote', 'Topic', 'Title', 'Created At'],
    ...used.map((u) => [u.id, u.videoId, u.quote, u.topic, u.title, u.createdAt]),
  ];

  const musicValues = [
    ['ID', 'Title', 'Mood', 'Artist', 'License', 'Duration (s)', 'Source Type'],
    ...tracks.map((t) => [t.id, t.title, t.mood, t.artist, t.license, String(t.durationSec), t.sourceType]),
  ];

  const settingsValues = [
    ['Setting', 'Value'],
    ['Default Mode', settings.defaultProductionMode],
    ['Resolution', settings.resolution],
    ['Duration (s)', String(settings.durationSec)],
    ['AI Engine', settings.activeEngine],
    ['Music Volume', String(settings.musicVolume)],
    ['Auto Upload & Schedule', String(settings.autoUploadSchedule)],
    ['Daily Run Time', `${settings.dailyAutomation?.runTime || '08:00'} (${settings.dailyAutomation?.timezone || 'UTC'})`],
    ['Daily Videos Count', String(settings.dailyAutomation?.videosPerDay || 8)],
    ['Publish Interval Hours', String(settings.dailyAutomation?.intervalHours || 2)],
  ];

  const data = [
    { range: "'VIDEO DATABASE'!A1", values: videoValues },
    { range: "'USED CONTENT'!A1", values: usedValues },
    { range: "'MUSIC LIBRARY'!A1", values: musicValues },
    { range: "'SETTINGS'!A1", values: settingsValues },
  ];

  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data,
      }),
    }
  );

  if (!batchRes.ok) {
    const txt = await batchRes.text().catch(() => batchRes.statusText);
    throw new Error(`Google Sheets sync failed (${batchRes.status}): ${txt}`);
  }

  return { spreadsheetId, spreadsheetUrl };
}
