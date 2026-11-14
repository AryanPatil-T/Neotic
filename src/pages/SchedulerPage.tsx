import React, { useEffect, useState } from 'react';
import {
  CalendarClock,
  Check,
  Clock,
  Cloud,
  Copy,
  LogOut,
  Play,
  RefreshCw,
  UploadCloud,
  Youtube,
} from 'lucide-react';
import {
  DAYS_OF_WEEK,
  DailyAutomationConfig,
  ScheduleConfig,
  StudioSettings,
  VideoRecord,
} from '../shared/types';
import { AutomationStatusResponse, api } from '../lib/api';
import { googleSignIn, logout } from '../lib/googleOAuth';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { ConfirmActionModal } from '../components/ConfirmActionModal';

interface SchedulerPageProps {
  settings: StudioSettings;
  videos: VideoRecord[];
  automation?: AutomationStatusResponse;
  accessToken: string | null;
  onTokenChange: (token: string | null) => void;
  onSettingsUpdated: (s: StudioSettings) => void;
  onVideosUpdated: () => Promise<void>;
}

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'UTC',
];

export const SchedulerPage: React.FC<SchedulerPageProps> = ({
  settings,
  videos,
  automation,
  accessToken,
  onTokenChange,
  onSettingsUpdated,
  onVideosUpdated,
}) => {
  const [config, setConfig] = useState<ScheduleConfig>(settings.scheduleConfig);
  const [daily, setDaily] = useState<DailyAutomationConfig>(settings.dailyAutomation);
  const [slots, setSlots] = useState<Array<{ isoUtc: string; localDisplay: string; dayCode: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);
  const [syncingPending, setSyncingPending] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    mode: 'selected' | 'pending' | 'run_now';
  }>({ open: false, mode: 'selected' });

  const hasGoogleSession = Boolean(
    accessToken || automation?.hasActiveSessionToken || automation?.headlessAutoUploadConfigured
  );
  const readyVideos = videos.filter((v) => v.status === 'completed' || v.status === 'scheduled');
  const pendingYouTubeVideos = videos.filter(
    (v) => v.status === 'scheduled' && !v.youtubeVideoId && Boolean(v.mp4Url)
  );

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const tzOptions = Array.from(new Set([browserTz, daily.timezone, ...COMMON_TIMEZONES].filter(Boolean)));

  useEffect(() => {
    setConfig(settings.scheduleConfig);
    setDaily(settings.dailyAutomation);
  }, [settings]);

  useEffect(() => {
    const previewCount = Math.max(5, Math.min(10, daily.videosPerDay || 8));
    api
      .previewScheduleSlots(
        {
          ...config,
          intervalHours: daily.intervalHours || config.intervalHours,
          startTime: daily.firstPublishTime || config.startTime,
        },
        previewCount
      )
      .then((res) => setSlots(res.slots))
      .catch(() => {});
  }, [config, daily.intervalHours, daily.firstPublishTime, daily.videosPerDay]);

  const handleSaveScheduleConfig = async (next: ScheduleConfig) => {
    setConfig(next);
    const { settings: updated } = await api.updateSettings({ scheduleConfig: next });
    onSettingsUpdated(updated);
  };

  const handleSaveDailyConfig = async (nextDaily: DailyAutomationConfig) => {
    setDaily(nextDaily);
    const nextSchedule: ScheduleConfig = {
      ...config,
      intervalHours: nextDaily.intervalHours,
      startTime: nextDaily.firstPublishTime,
    };
    setConfig(nextSchedule);
    const { settings: updated } = await api.updateSettings({
      dailyAutomation: nextDaily,
      scheduleConfig: nextSchedule,
      dailyLimit: nextDaily.videosPerDay,
      autoUploadSchedule: nextDaily.autoUploadToYouTube,
      autoSyncSheets: nextDaily.autoSyncToSheets,
    });
    onSettingsUpdated(updated);
  };

  const toggleDay = (day: string) => {
    const exists = config.preferredDays.includes(day);
    const nextDays = exists
      ? config.preferredDays.filter((d) => d !== day)
      : [...config.preferredDays, day];
    if (nextDays.length === 0) return;
    handleSaveScheduleConfig({ ...config, preferredDays: nextDays });
  };

  const handleConnectGoogle = async () => {
    setErrorMsg(null);
    setMessage(null);
    setConnecting(true);
    try {
      const { accessToken: tok, channel } = await googleSignIn();
      onTokenChange(tok);
      await api.setAutomationSessionToken(tok);
      const { settings: updated } = await api.updateSettings({ youtubeChannel: channel });
      onSettingsUpdated(updated);
      setMessage(
        channel
          ? `Connected YouTube channel: ${channel.title}. Ready for automated uploads and Google Sheets sync.`
          : 'Signed in with Google. Ready for YouTube uploads and Google Sheets sync.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google sign-in failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await logout();
    onTokenChange(null);
    await api.setAutomationSessionToken(null);
    const { settings: updated } = await api.updateSettings({ youtubeChannel: null });
    onSettingsUpdated(updated);
  };

  const executeAssignSchedule = async (uploadToYouTube: boolean) => {
    if (selectedIds.length === 0) return;
    setErrorMsg(null);
    setMessage(null);
    setUploading(true);
    try {
      const res = await api.assignSchedule(selectedIds, uploadToYouTube, accessToken);
      await onVideosUpdated();
      const okCount = res.results.filter((r) => r.status === 'scheduled').length;
      const errItems = res.results.filter((r) => r.error);
      if (errItems.length > 0) {
        setErrorMsg(errItems.map((e) => e.error).join(' | '));
      }
      if (okCount > 0) {
        setMessage(
          uploadToYouTube
            ? `Uploaded and scheduled ${okCount} Short(s) on YouTube as private with 2h publishAt slots.`
            : `Assigned non-colliding schedule slots to ${okCount} Short(s).`
        );
      }
      setSelectedIds([]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Scheduling failed');
    } finally {
      setUploading(false);
    }
  };

  const executeSyncPending = async () => {
    if (!hasGoogleSession) {
      setErrorMsg('Sign in with Google first to upload pending scheduled Shorts.');
      return;
    }
    setErrorMsg(null);
    setMessage(null);
    setSyncingPending(true);
    try {
      const res = await api.syncPendingUploads(accessToken);
      await onVideosUpdated();
      if (res.errors.length > 0) {
        setErrorMsg(res.errors.join(' | '));
      }
      setMessage(
        `Uploaded ${res.uploadedCount} pending Short(s) to YouTube${
          res.sheetsSynced ? ' and synced Google Sheets.' : '.'
        }`
      );
    } catch (err: any) {
      await onVideosUpdated();
      setErrorMsg(err?.message || 'Pending upload sync failed');
    } finally {
      setSyncingPending(false);
    }
  };

  const executeRunNow = async () => {
    setErrorMsg(null);
    setMessage(null);
    setRunningBatch(true);
    try {
      await api.runAutomationNow(accessToken);
      await onVideosUpdated();
      setMessage(
        `Started daily batch (${daily.videosPerDay} Shorts @ ${daily.intervalHours}h publish intervals). Track live progress on the Dashboard.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not start daily batch');
    } finally {
      setRunningBatch(false);
    }
  };

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const quotaUnitsPerDay = (daily.videosPerDay || 8) * 1600;
  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.onrender.com';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-playfair text-2xl sm:text-3xl font-semibold text-white">
          Daily 8:00 AM Automation &amp; YouTube Scheduler
        </h1>
        <p className="text-sm text-[#9B9FB5] mt-1">
          Runs once daily at 08:00 AM to generate Shorts, schedules them every 2 hours in UTC ISO-8601, and syncs with YouTube &amp; Google Sheets.
        </p>
      </div>

      {/* Google Account / YouTube Connection Card */}
      <section className="rounded-xl bg-[#12131A] border border-[#27293A] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#181924] border border-[#27293A] flex items-center justify-center shrink-0">
            <Youtube className="w-6 h-6 text-[#EF4444]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              {settings.youtubeChannel ? settings.youtubeChannel.title : 'YouTube & Google Sheets Account'}
            </div>
            <div className="text-xs text-[#9B9FB5] mt-0.5 font-mono-tabular">
              {automation?.headlessAutoUploadConfigured
                ? settings.youtubeChannel
                  ? `${settings.youtubeChannel.subscriberCount} subscribers · ${settings.youtubeChannel.videoCount} videos · 24/7 Unattended Auto-Upload Active`
                  : '24/7 Unattended Auto-Upload Active (Server Refresh Token configured)'
                : hasGoogleSession
                ? settings.youtubeChannel
                  ? `${settings.youtubeChannel.subscriberCount} subscribers · ${settings.youtubeChannel.videoCount} videos · Google Session Active${
                      automation?.tokenExpiresAt
                        ? ` (until ${new Date(automation.tokenExpiresAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })})`
                        : ''
                    }`
                  : 'Google Session Active (YouTube & Sheets permissions granted)'
                : settings.youtubeChannel
                ? `${settings.youtubeChannel.subscriberCount} subscribers · Sign in with Google to authorize uploads for this session`
                : 'Sign in with Google to link your YouTube channel and Google Sheet.'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {accessToken || automation?.hasActiveSessionToken ? (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs font-medium text-[#D4D6E2] flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          ) : (
            <GoogleSignInButton
              onClick={handleConnectGoogle}
              disabled={connecting}
              label={connecting ? 'Signing in...' : 'Sign in with Google'}
            />
          )}
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/35 px-4 py-2.5 text-xs text-[#FCA5A5]">
          {errorMsg}
        </div>
      )}
      {message && (
        <div className="rounded-lg bg-[#10B981]/10 border border-[#10B981]/35 px-4 py-2.5 text-xs text-[#D1FAE5]">
          {message}
        </div>
      )}

      {/* Daily 8:00 AM Automation Card */}
      <section className="rounded-xl bg-[#12131A] border border-[#8B5CF6]/35 p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="text-base font-semibold text-white">
                Once-Daily Auto-Generator &amp; 2-Hour Upload Cadence
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular font-semibold ${
                  daily.enabled
                    ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                    : 'bg-[#181924] text-[#8E92A8] border border-[#27293A]'
                }`}
              >
                {daily.enabled ? 'ACTIVE' : 'PAUSED'}
              </span>
            </div>
            <p className="text-xs text-[#9B9FB5]">
              Next scheduled generation:{' '}
              <span className="font-mono-tabular text-white">
                {automation?.nextRunDisplay || `${daily.runTime} (${daily.timezone})`}
              </span>
              {daily.lastRunMessage ? ` · Last run: ${daily.lastRunMessage}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#181924] border border-[#27293A] text-xs text-[#D4D6E2] cursor-pointer">
              <input
                type="checkbox"
                checked={daily.enabled}
                onChange={(e) => handleSaveDailyConfig({ ...daily, enabled: e.target.checked })}
                className="accent-[#8B5CF6]"
              />
              <span>Enable Daily 8:00 AM Run</span>
            </label>

            <button
              disabled={runningBatch}
              onClick={() => setConfirmState({ open: true, mode: 'run_now' })}
              className="px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{runningBatch ? 'Starting...' : `Run ${daily.videosPerDay}-Short Batch Now`}</span>
            </button>

            {pendingYouTubeVideos.length > 0 && (
              <button
                disabled={syncingPending || !hasGoogleSession}
                onClick={() => setConfirmState({ open: true, mode: 'pending' })}
                className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-[#052E16] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingPending ? 'animate-spin' : ''}`} />
                <span>
                  {syncingPending
                    ? 'Pushing...'
                    : `Push ${pendingYouTubeVideos.length} Pending to YouTube`}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-[#A0A4B8]">Daily Trigger Time</label>
            <input
              type="time"
              value={daily.runTime}
              onChange={(e) => handleSaveDailyConfig({ ...daily, runTime: e.target.value || '08:00' })}
              className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-[#A0A4B8]">Timezone</label>
            <select
              value={daily.timezone}
              onChange={(e) => handleSaveDailyConfig({ ...daily, timezone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white"
            >
              {tzOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-[#A0A4B8]">First Upload Slot Time</label>
            <input
              type="time"
              value={daily.firstPublishTime}
              onChange={(e) =>
                handleSaveDailyConfig({ ...daily, firstPublishTime: e.target.value || '09:00' })
              }
              className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-[#A0A4B8]">Shorts Per Day (YouTube Limit Aware)</label>
            <div className="flex items-center gap-1.5">
              {[6, 7, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleSaveDailyConfig({ ...daily, videosPerDay: n })}
                  className={`flex-1 py-2 rounded-lg border text-xs font-mono-tabular font-semibold ${
                    daily.videosPerDay === n
                      ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                      : 'bg-[#09090E] border-[#27293A] text-[#A0A4B8]'
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={10}
                value={daily.videosPerDay}
                onChange={(e) =>
                  handleSaveDailyConfig({
                    ...daily,
                    videosPerDay: Math.max(1, Math.min(10, Number(e.target.value) || 8)),
                  })
                }
                className="w-16 px-2.5 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#27293A] text-xs">
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 text-[#D4D6E2] cursor-pointer">
              <input
                type="checkbox"
                checked={daily.autoUploadToYouTube}
                onChange={(e) =>
                  handleSaveDailyConfig({ ...daily, autoUploadToYouTube: e.target.checked })
                }
                className="accent-[#8B5CF6]"
              />
              <span>Auto-upload to YouTube with 2h publishAt slots</span>
            </label>

            <label className="flex items-center gap-2 text-[#D4D6E2] cursor-pointer">
              <input
                type="checkbox"
                checked={daily.autoSyncToSheets}
                onChange={(e) =>
                  handleSaveDailyConfig({ ...daily, autoSyncToSheets: e.target.checked })
                }
                className="accent-[#8B5CF6]"
              />
              <span>Auto-sync Google Sheet after daily batch</span>
            </label>
          </div>

          <div
            className={`font-mono-tabular ${
              quotaUnitsPerDay <= 10000 ? 'text-[#10B981]' : 'text-[#F59E0B]'
            }`}
          >
            Est. YouTube API Quota: {quotaUnitsPerDay.toLocaleString()} / 10,000 units/day
            {quotaUnitsPerDay > 10000 ? ' (excess queued for next sync)' : ' (within daily limit)'}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Rules Engine */}
        <div className="lg:col-span-6 rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-5">
          <h2 className="text-base font-semibold text-white">2-Hour Slot Rules Engine</h2>

          <div className="space-y-2">
            <label className="text-xs text-[#A0A4B8]">Publishing Interval</label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((h) => (
                <button
                  key={h}
                  onClick={() => handleSaveDailyConfig({ ...daily, intervalHours: h })}
                  className={`px-3.5 py-2 rounded-lg border text-xs font-mono-tabular ${
                    daily.intervalHours === h
                      ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                      : 'bg-[#181924] border-[#27293A] text-[#A0A4B8]'
                  }`}
                >
                  Every {h}h
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={48}
                value={daily.intervalHours}
                onChange={(e) =>
                  handleSaveDailyConfig({
                    ...daily,
                    intervalHours: Math.max(1, Number(e.target.value) || 2),
                  })
                }
                className="w-20 px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-[#A0A4B8]">Start Date</label>
              <input
                type="date"
                value={config.startDate}
                onChange={(e) => handleSaveScheduleConfig({ ...config, startDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#A0A4B8]">Start Time</label>
              <input
                type="time"
                value={daily.firstPublishTime}
                onChange={(e) =>
                  handleSaveDailyConfig({ ...daily, firstPublishTime: e.target.value || '09:00' })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#A0A4B8]">Earliest Hour (0–23)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={config.earliestHour}
                onChange={(e) =>
                  handleSaveScheduleConfig({ ...config, earliestHour: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#A0A4B8]">Latest Hour (0–23)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={config.latestHour}
                onChange={(e) =>
                  handleSaveScheduleConfig({ ...config, latestHour: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-[#A0A4B8]">Preferred Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const active = config.preferredDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono-tabular ${
                      active
                        ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-white'
                        : 'bg-[#181924] border-[#27293A] text-[#8E92A8]'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Next N Slots Preview */}
          <div className="pt-3 border-t border-[#27293A] space-y-2">
            <div className="text-xs font-semibold text-white">
              Next {slots.length} Non-Colliding Publish Slots ({daily.intervalHours}h spacing)
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {slots.map((slot, idx) => (
                <div
                  key={slot.isoUtc}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular"
                >
                  <span className="text-[#D4D6E2]">
                    #{idx + 1} · {slot.localDisplay}
                  </span>
                  <span className="text-[#8E92A8] text-[11px]">{slot.isoUtc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ready Shorts Queue */}
        <div className="lg:col-span-6 rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">Assign Slots &amp; Batch Upload</h2>
              <p className="text-xs text-[#8E92A8]">
                Select Shorts to schedule locally or push to YouTube with 2h intervals.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={uploading || selectedIds.length === 0}
                onClick={() => executeAssignSchedule(false)}
                className="px-3 py-2 rounded-lg bg-[#181924] hover:bg-[#222434] disabled:opacity-50 border border-[#27293A] text-xs font-medium text-white flex items-center gap-1.5"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>Schedule Locally ({selectedIds.length})</span>
              </button>
              <button
                disabled={uploading || selectedIds.length === 0 || !hasGoogleSession}
                onClick={() => setConfirmState({ open: true, mode: 'selected' })}
                className="px-3 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload to YouTube</span>
              </button>
            </div>
          </div>

          {readyVideos.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8E92A8] border border-dashed border-[#27293A] rounded-xl">
              Generate and render Shorts first to assign publishing slots.
            </div>
          ) : (
            <div className="divide-y divide-[#27293A] border border-[#27293A] rounded-xl overflow-hidden max-h-[470px] overflow-y-auto">
              {readyVideos.map((v) => {
                const checked = selectedIds.includes(v.id);
                return (
                  <button
                    key={v.id}
                    onClick={() =>
                      setSelectedIds((prev) =>
                        checked ? prev.filter((id) => id !== v.id) : [...prev, v.id]
                      )
                    }
                    className="w-full p-3.5 bg-[#12131A] hover:bg-[#181924] flex items-center gap-3 text-left transition-colors"
                  >
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                        checked ? 'bg-[#8B5CF6] border-[#8B5CF6]' : 'border-[#343850]'
                      }`}
                    >
                      {checked && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <img
                      src={v.thumbnailUrl || v.backgroundImageUrl}
                      alt={v.title}
                      className="w-9 h-16 rounded object-cover shrink-0 bg-[#09090E]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate">{v.title}</div>
                      <div className="text-[11px] text-[#8E92A8] font-mono-tabular mt-0.5">
                        {v.scheduledAt
                          ? `Scheduled: ${new Date(v.scheduledAt).toLocaleString()}`
                          : 'Unscheduled · Ready'}
                        {v.youtubeVideoId ? ` · YT: ${v.youtubeVideoId}` : v.scheduledAt ? ' · Awaiting YT push' : ''}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Free Hosting & 24/7 Cron Setup Guide */}
      <section className="rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Cloud className="w-4 h-4 text-[#3B82F6]" />
          <h2 className="text-base font-semibold text-white">
            Free Platform Hosting &amp; 24/7 Daily Trigger Setup
          </h2>
        </div>

        <p className="text-xs text-[#9B9FB5] leading-relaxed">
          This studio includes a production <span className="font-mono-tabular text-white">Dockerfile</span> (with FFmpeg pre-installed) and{' '}
          <span className="font-mono-tabular text-white">render.yaml</span> for free hosting on{' '}
          <strong className="text-white">Render.com Free</strong>, <strong className="text-white">Koyeb Free</strong>,{' '}
          <strong className="text-white">Hugging Face Spaces (Docker)</strong>, or an{' '}
          <strong className="text-white">Oracle Cloud Always-Free VM</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg bg-[#09090E] border border-[#27293A] p-4 space-y-2">
            <div className="font-semibold text-white">1. Free Keep-Alive Ping (Every 10 mins)</div>
            <p className="text-[#8E92A8]">
              Use free cron-job.org or UptimeRobot to ping this URL so free hosts stay awake for 08:00 AM runs:
            </p>
            <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded bg-[#12131A] border border-[#27293A] font-mono-tabular text-[11px] text-[#D4D6E2]">
              <span className="truncate">GET {originUrl}/api/health</span>
              <button
                onClick={() => copyText('health', `${originUrl}/api/health`)}
                className="text-[#8B5CF6] hover:text-white shrink-0"
              >
                {copiedKey === 'health' ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-[#09090E] border border-[#27293A] p-4 space-y-2">
            <div className="font-semibold text-white">2. External 08:00 AM Cron Webhook</div>
            <p className="text-[#8E92A8]">
              Optionally fire this POST webhook daily at 08:00 AM (add header <span className="font-mono-tabular">x-cron-secret</span> if set):
            </p>
            <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded bg-[#12131A] border border-[#27293A] font-mono-tabular text-[11px] text-[#D4D6E2]">
              <span className="truncate">POST {originUrl}/api/automation/cron-trigger</span>
              <button
                onClick={() => copyText('cron', `${originUrl}/api/automation/cron-trigger`)}
                className="text-[#8B5CF6] hover:text-white shrink-0"
              >
                {copiedKey === 'cron' ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <ConfirmActionModal
        open={confirmState.open}
        title={
          confirmState.mode === 'pending'
            ? `Upload ${pendingYouTubeVideos.length} Scheduled Short(s) to YouTube?`
            : confirmState.mode === 'run_now'
            ? `Run ${daily.videosPerDay}-Short Batch & Schedule Now?`
            : `Upload & Schedule ${selectedIds.length} Selected Short(s) on YouTube?`
        }
        description={
          confirmState.mode === 'pending'
            ? 'This will upload all locally scheduled Shorts to your connected YouTube channel as private videos with their 2-hour publishAt timestamps, and sync your Google Sheet.'
            : confirmState.mode === 'run_now'
            ? `This will generate ${daily.videosPerDay} unique Shorts, render MP4s, assign ${daily.intervalHours}-hour publishing slots starting at ${daily.firstPublishTime}, and ${
                hasGoogleSession && daily.autoUploadToYouTube
                  ? 'upload them to YouTube & sync your Google Sheet.'
                  : 'queue them locally until you sign in with Google.'
              }`
            : 'This will upload the selected Shorts to your connected YouTube channel as private videos scheduled at the next available 2-hour slots.'
        }
        details={
          confirmState.mode === 'selected'
            ? selectedIds
                .map((id) => readyVideos.find((v) => v.id === id)?.title)
                .filter(Boolean) as string[]
            : confirmState.mode === 'pending'
            ? pendingYouTubeVideos.map((v) => `${v.title} (${v.scheduledAt ? new Date(v.scheduledAt).toLocaleString() : 'Next slot'})`)
            : undefined
        }
        confirmLabel={
          confirmState.mode === 'run_now' ? 'Start Daily Batch' : 'Confirm Upload'
        }
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
        onConfirm={() => {
          const mode = confirmState.mode;
          setConfirmState((s) => ({ ...s, open: false }));
          if (mode === 'selected') executeAssignSchedule(true);
          else if (mode === 'pending') executeSyncPending();
          else executeRunNow();
        }}
      />
    </div>
  );
};
