import React, { useEffect, useState } from 'react';
import {
  CloudUpload,
  Download,
  ExternalLink,
  Link2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  MusicTrackRecord,
  StudioSettings,
  UsedContentRecord,
  VideoRecord,
} from '../shared/types';
import { AutomationStatusResponse, api } from '../lib/api';
import { googleSignIn } from '../lib/googleOAuth';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { ConfirmActionModal } from '../components/ConfirmActionModal';

interface DatabasePageProps {
  settings: StudioSettings;
  automation?: AutomationStatusResponse;
  accessToken: string | null;
  onTokenChange: (token: string | null) => void;
  onSettingsUpdated: (s: StudioSettings) => void;
  onDataImported: () => Promise<void>;
}

type SheetTab = 'VIDEO DATABASE' | 'USED CONTENT' | 'MUSIC LIBRARY' | 'SETTINGS';

export const DatabasePage: React.FC<DatabasePageProps> = ({
  settings,
  automation,
  accessToken,
  onTokenChange,
  onSettingsUpdated,
  onDataImported,
}) => {
  const hasGoogleSession = Boolean(
    accessToken || automation?.hasActiveSessionToken || automation?.headlessAutoUploadConfigured
  );
  const [activeTab, setActiveTab] = useState<SheetTab>('VIDEO DATABASE');
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [usedContent, setUsedContent] = useState<UsedContentRecord[]>([]);
  const [musicTracks, setMusicTracks] = useState<MusicTrackRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [sheetUrlInput, setSheetUrlInput] = useState(settings.connectedSpreadsheetUrl || '');
  const [linkingSheet, setLinkingSheet] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);

  const [importSummary, setImportSummary] = useState<{
    importedVideos: number;
    skippedDuplicates: number;
    conflicts: Array<{ id: string; title: string; reason: string }>;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setSheetUrlInput(settings.connectedSpreadsheetUrl || settings.connectedSpreadsheetId || '');
  }, [settings.connectedSpreadsheetUrl, settings.connectedSpreadsheetId]);

  const loadTables = async () => {
    setLoading(true);
    try {
      const data = await api.getDatabaseTables();
      setVideos(data.videos);
      setUsedContent(data.usedContent);
      setMusicTracks(data.musicTracks);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const handleImportXlsx = async (file: File | undefined) => {
    if (!file) return;
    setErrorMsg(null);
    setImportSummary(null);
    try {
      const { summary } = await api.importExcel(file);
      setImportSummary(summary);
      await loadTables();
      await onDataImported();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Excel import failed');
    }
  };

  const handleSignIn = async () => {
    setErrorMsg(null);
    setConnecting(true);
    try {
      const { accessToken: tok, channel } = await googleSignIn();
      onTokenChange(tok);
      await api.setAutomationSessionToken(tok);
      if (channel) {
        const { settings: updated } = await api.updateSettings({ youtubeChannel: channel });
        onSettingsUpdated(updated);
      }
      setStatusMsg('Signed in with Google. You can now sync directly to Google Sheets.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google sign-in failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleLinkSheet = async () => {
    setLinkingSheet(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const { settings: updated } = await api.linkGoogleSheet(sheetUrlInput);
      onSettingsUpdated(updated);
      setStatusMsg(
        updated.connectedSpreadsheetId
          ? `Linked Google Sheet (${updated.connectedSpreadsheetId}). Click Sync Google Sheets to push rows.`
          : 'Cleared linked Google Sheet. Next sync will create a fresh workbook.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not link spreadsheet URL');
    } finally {
      setLinkingSheet(false);
    }
  };

  const executeSheetsSync = async () => {
    if (!hasGoogleSession) {
      setErrorMsg('Please Sign in with Google first to sync to Google Sheets.');
      return;
    }
    setSyncing(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await api.syncGoogleSheets(accessToken);
      const { settings: updated } = await api.updateSettings({
        connectedSpreadsheetId: res.spreadsheetId,
        connectedSpreadsheetUrl: res.spreadsheetUrl,
      });
      onSettingsUpdated(updated);
      setStatusMsg('Successfully synced all 4 tabs to Google Sheets.');
    } catch (err: any) {
      await onDataImported();
      setErrorMsg(err?.message || 'Google Sheets sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleAutoSync = async () => {
    const { settings: updated } = await api.updateSettings({
      autoSyncSheets: !settings.autoSyncSheets,
    });
    onSettingsUpdated(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl sm:text-3xl font-semibold text-white">
            Excel Database (.xlsx) &amp; Google Sheets Sync
          </h1>
          <p className="text-sm text-[#9B9FB5] mt-1">
            Inspect all 4 local SQLite tables, export or import real .xlsx workbooks, and sync to Google Sheets API v4.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!hasGoogleSession && (
            <GoogleSignInButton
              onClick={handleSignIn}
              disabled={connecting}
              label={connecting ? 'Signing in...' : 'Sign in with Google'}
            />
          )}

          <a
            href="/api/database/export.xlsx"
            className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#052E16] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .xlsx</span>
          </a>

          <label className="px-4 py-2 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs font-medium text-white cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap">
            <Upload className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Import .xlsx</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleImportXlsx(e.target.files?.[0])}
            />
          </label>

          <button
            disabled={syncing || !hasGoogleSession}
            onClick={() => setConfirmSyncOpen(true)}
            className="px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>{syncing ? 'Syncing...' : 'Sync Google Sheets'}</span>
          </button>

          <button
            onClick={loadTables}
            className="p-2 rounded-lg bg-[#181924] border border-[#27293A] text-[#A0A4B8] hover:text-white"
            title="Refresh tables"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Google Sheets Link & Auto-sync Toggle */}
      <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-4 space-y-3 text-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[#9B9FB5]">
              {settings.connectedSpreadsheetUrl ? 'Connected Workbook:' : 'No Google Sheet linked yet (auto-creates on first sync, or paste URL below).'}
            </span>
            {settings.connectedSpreadsheetUrl && (
              <a
                href={settings.connectedSpreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#8B5CF6] hover:underline inline-flex items-center gap-1 font-medium"
              >
                <span>Open in Google Sheets</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <label className="flex items-center gap-2 text-[#D4D6E2] cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoSyncSheets}
              onChange={handleToggleAutoSync}
              className="accent-[#8B5CF6]"
            />
            <span>Auto-sync after each generation</span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={sheetUrlInput}
            onChange={(e) => setSheetUrlInput(e.target.value)}
            placeholder="Optional: Paste existing Google Sheet URL or Spreadsheet ID..."
            className="flex-1 px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white placeholder:text-[#5C6078]"
          />
          <button
            disabled={linkingSheet}
            onClick={handleLinkSheet}
            className="px-4 py-2 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs font-medium text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Link2 className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>{linkingSheet ? 'Saving...' : 'Save Sheet Link'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/35 px-4 py-2.5 text-xs text-[#FCA5A5]">
          {errorMsg}
        </div>
      )}
      {statusMsg && (
        <div className="rounded-lg bg-[#10B981]/10 border border-[#10B981]/35 px-4 py-2.5 text-xs text-[#D1FAE5]">
          {statusMsg}
        </div>
      )}

      {importSummary && (
        <div className="rounded-xl bg-[#12131A] border border-[#8B5CF6]/40 p-4 space-y-2 text-xs">
          <div className="font-semibold text-white">
            Workbook Import Summary: {importSummary.importedVideos} imported ·{' '}
            {importSummary.skippedDuplicates} skipped duplicate(s)
          </div>
          {importSummary.conflicts.length > 0 && (
            <div className="space-y-1 text-[#F59E0B] max-h-28 overflow-y-auto">
              {importSummary.conflicts.map((c) => (
                <div key={c.id}>
                  {c.id} ({c.title}): {c.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4-Tab Spreadsheet Bar */}
      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[#12131A] border border-[#27293A] w-fit">
        {(['VIDEO DATABASE', 'USED CONTENT', 'MUSIC LIBRARY', 'SETTINGS'] as SheetTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono-tabular font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab ? 'bg-[#8B5CF6] text-white' : 'text-[#A0A4B8] hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Spreadsheet Grid */}
      <div className="rounded-xl bg-[#12131A] border border-[#27293A] overflow-hidden">
        <div className="overflow-x-auto max-h-[540px]">
          {loading ? (
            <div className="p-10 text-center text-xs text-[#8E92A8]">Loading SQLite tables...</div>
          ) : activeTab === 'VIDEO DATABASE' ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#181924] text-[#9B9FB5] sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">ID</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Title</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Quote</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Category</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Style</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Engine</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Status</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Scheduled At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27293A]">
                {videos.map((v) => (
                  <tr key={v.id} className="hover:bg-[#181924]/50">
                    <td className="px-4 py-2.5 font-mono-tabular text-[#8E92A8] whitespace-nowrap">{v.id}</td>
                    <td className="px-4 py-2.5 text-white font-medium min-w-[180px]">{v.title}</td>
                    <td className="px-4 py-2.5 text-[#C8CBDA] min-w-[260px]">{v.quote}</td>
                    <td className="px-4 py-2.5 text-[#A0A4B8] whitespace-nowrap">{v.category}</td>
                    <td className="px-4 py-2.5 text-[#A0A4B8] whitespace-nowrap">{v.visualStyle}</td>
                    <td className="px-4 py-2.5 font-mono-tabular text-[#A0A4B8]">{v.aiEngineUsed}</td>
                    <td className="px-4 py-2.5 font-mono-tabular text-white">{v.status}</td>
                    <td className="px-4 py-2.5 font-mono-tabular text-[#8E92A8] whitespace-nowrap">
                      {v.scheduledAt ? new Date(v.scheduledAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
                {videos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[#8E92A8]">
                      No video rows yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : activeTab === 'USED CONTENT' ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#181924] text-[#9B9FB5] sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Video ID</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Title</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Topic</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Quote</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Recorded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27293A]">
                {usedContent.map((u) => (
                  <tr key={u.id} className="hover:bg-[#181924]/50">
                    <td className="px-4 py-2.5 font-mono-tabular text-[#8E92A8] whitespace-nowrap">{u.videoId}</td>
                    <td className="px-4 py-2.5 text-white font-medium">{u.title}</td>
                    <td className="px-4 py-2.5 text-[#A0A4B8]">{u.topic}</td>
                    <td className="px-4 py-2.5 text-[#C8CBDA] min-w-[260px]">{u.quote}</td>
                    <td className="px-4 py-2.5 font-mono-tabular text-[#8E92A8] whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {usedContent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[#8E92A8]">
                      Permanent anti-repetition archive is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : activeTab === 'MUSIC LIBRARY' ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#181924] text-[#9B9FB5] sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">ID</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Title</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Mood</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">License</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Duration</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27293A]">
                {musicTracks.map((t) => (
                  <tr key={t.id} className="hover:bg-[#181924]/50">
                    <td className="px-4 py-2.5 font-mono-tabular text-[#8E92A8]">{t.id}</td>
                    <td className="px-4 py-2.5 text-white font-medium">{t.title}</td>
                    <td className="px-4 py-2.5 text-[#A0A4B8]">{t.mood}</td>
                    <td className="px-4 py-2.5 text-[#A0A4B8]">{t.license}</td>
                    <td className="px-4 py-2.5 font-mono-tabular text-[#D4D6E2]">{t.durationSec}s</td>
                    <td className="px-4 py-2.5 font-mono-tabular text-[#8E92A8]">{t.sourceType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#181924] text-[#9B9FB5] sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Key</th>
                  <th className="px-4 py-2.5 border-b border-[#27293A]">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27293A]">
                {[
                  ['defaultProductionMode', settings.defaultProductionMode],
                  ['defaultImageSource', settings.defaultImageSource],
                  ['resolution', settings.resolution],
                  ['defaultPrivacy', settings.defaultPrivacy],
                  ['durationSec', `${settings.durationSec}s`],
                  ['dailyLimit', String(settings.dailyLimit)],
                  ['dailyAutomationRunTime', `${settings.dailyAutomation?.runTime || '08:00'} (${settings.dailyAutomation?.timezone || 'UTC'})`],
                  ['dailyVideosPerDay', String(settings.dailyAutomation?.videosPerDay || 8)],
                  ['publishIntervalHours', `${settings.dailyAutomation?.intervalHours || 2}h`],
                  ['activeEngine', settings.activeEngine],
                  ['bwMonochrome', String(settings.bwMonochrome)],
                  ['musicVolume', `${settings.musicVolume}%`],
                  ['jaccardThreshold', String(settings.jaccardThreshold)],
                  ['trigramThreshold', String(settings.trigramThreshold)],
                ].map(([k, val]) => (
                  <tr key={k} className="hover:bg-[#181924]/50">
                    <td className="px-4 py-2.5 font-mono-tabular text-[#A0A4B8]">{k}</td>
                    <td className="px-4 py-2.5 font-mono-tabular text-white">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmActionModal
        open={confirmSyncOpen}
        title="Sync Studio Database to Google Sheets?"
        description={
          settings.connectedSpreadsheetId
            ? `This will update the 4 tabs (VIDEO DATABASE, USED CONTENT, MUSIC LIBRARY, SETTINGS) in your linked Google Sheet (${settings.connectedSpreadsheetId}) with ${videos.length} video row(s) and ${usedContent.length} used quote(s).`
            : `This will create a new "AI Shorts Studio — Master Database" Google Sheet in your Drive and populate all 4 tabs with ${videos.length} video row(s).`
        }
        confirmLabel="Sync Google Sheet"
        onCancel={() => setConfirmSyncOpen(false)}
        onConfirm={() => {
          setConfirmSyncOpen(false);
          executeSheetsSync();
        }}
      />
    </div>
  );
};
