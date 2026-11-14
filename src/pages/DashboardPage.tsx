import React, { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Film,
  Layers,
  Palette,
  Play,
  Sliders,
  Type,
  Wand2,
  X,
  Youtube,
} from 'lucide-react';
import {
  PIPELINE_STAGES,
  PipelineJob,
  ProviderStatus,
  StudioSettings,
  VideoRecord,
} from '../shared/types';
import { AutomationStatusResponse, formatBytes } from '../lib/api';
import { NavRoute } from '../components/Layout';

interface DashboardPageProps {
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
  accessToken: string | null;
  onNavigate: (route: NavRoute, subTab?: string) => void;
  onQuickGenerate: (qty: number) => Promise<void>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  kpis,
  settings,
  job,
  providers,
  recentVideos,
  automation,
  accessToken,
  onNavigate,
  onQuickGenerate,
}) => {
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [customQty, setCustomQty] = useState(10);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const configuredProviders = providers.filter((p) => p.role === 'text' && p.configured);
  const isRunning = job?.status === 'running';
  const hasGoogleSession = Boolean(
    accessToken || automation?.hasActiveSessionToken || automation?.headlessAutoUploadConfigured
  );

  const handleLaunch = async (qty: number) => {
    setLaunchError(null);
    setLaunching(true);
    try {
      await onQuickGenerate(qty);
      setShowBatchModal(false);
    } catch (err: any) {
      setLaunchError(err?.message || 'Failed to launch batch generation');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Studio Hero Card */}
      <section className="rounded-xl bg-[#12131A] border border-[#27293A] p-6 sm:p-8 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#9B9FB5] font-mono-tabular">
            <span className="text-[#8B5CF6] font-semibold">
              {settings.defaultProductionMode === 'multi_scene'
                ? 'Mode B · Multi-Scene Storytelling'
                : 'Mode A · Single Image Motivation'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              AI Engine: {settings.activeEngine === 'auto' ? 'Auto Failover' : settings.activeEngine}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {configuredProviders.length} Text Provider{configuredProviders.length === 1 ? '' : 's'} Ready
            </span>
          </div>

          <h1 className="font-playfair text-2xl sm:text-4xl font-semibold text-white tracking-tight text-balance">
            Dark-Cinematic YouTube Shorts Automation Studio
          </h1>

          <p className="text-sm sm:text-base text-[#A0A4B8] leading-relaxed">
            Local-first SQLite production suite with multi-provider AI writing, jaccard &amp; trigram
            non-repetition verification, real-time 9:16 visual editors, and native FFmpeg MP4 rendering.
          </p>

          {launchError && (
            <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-3 py-2">
              {launchError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            disabled={launching || isRunning}
            onClick={() => handleLaunch(5)}
            className="px-5 py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isRunning ? 'Pipeline Running' : 'GENERATE 5 SHORTS'}</span>
          </button>

          <button
            disabled={launching || isRunning}
            onClick={() => setShowBatchModal(true)}
            className="px-4 py-2.5 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            GENERATE MORE
          </button>

          <button
            onClick={() => onNavigate('generate')}
            className="px-4 py-2.5 rounded-lg bg-transparent hover:bg-[#181924] border border-[#27293A] text-[#D4D6E2] text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Sliders className="w-4 h-4" />
            <span>CUSTOMIZE</span>
          </button>
        </div>
      </section>

      {/* Integration Status Strip */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#181924] border border-[#27293A] flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">Daily {settings.dailyAutomation?.runTime || '08:00'} Auto-Run</div>
              <div className="text-xs text-[#9B9FB5] truncate font-mono-tabular">
                {settings.dailyAutomation?.enabled
                  ? `${settings.dailyAutomation.videosPerDay} Shorts/day · Every ${settings.dailyAutomation.intervalHours}h · Next: ${automation?.nextRunDisplay || '08:00'}`
                  : 'Daily auto-generation paused'}
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('scheduler')}
            className="px-3.5 py-2 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs font-medium text-white whitespace-nowrap shrink-0"
          >
            Schedule
          </button>
        </div>

        <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#181924] border border-[#27293A] flex items-center justify-center shrink-0">
              <Youtube className="w-5 h-5 text-[#EF4444]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">YouTube Data API v3</div>
              <div className="text-xs text-[#9B9FB5] truncate">
                {settings.youtubeChannel
                  ? `${settings.youtubeChannel.title} · ${hasGoogleSession ? 'Connected' : 'Sign in to push'}${
                      automation?.pendingYouTubeUploads
                        ? ` · ${automation.pendingYouTubeUploads} pending`
                        : ''
                    }`
                  : hasGoogleSession
                  ? 'Google Session Active'
                  : 'Sign in with Google in Scheduler to link channel'}
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('scheduler')}
            className="px-3.5 py-2 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs font-medium text-white whitespace-nowrap shrink-0"
          >
            {hasGoogleSession ? 'Manage' : 'Connect'}
          </button>
        </div>

        <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#181924] border border-[#27293A] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-[#10B981]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">Excel &amp; Google Sheets</div>
              <div className="text-xs text-[#9B9FB5] truncate">
                {settings.connectedSpreadsheetId
                  ? `Linked Sheet · Auto-sync ${settings.autoSyncSheets ? 'On' : 'Manual'}`
                  : 'Local SQLite + 4-Tab .xlsx + Google Sheets'}
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('database')}
            className="px-3.5 py-2 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs font-medium text-white whitespace-nowrap shrink-0"
          >
            Open Sheet
          </button>
        </div>
      </section>

      {/* 6 KPI Metric Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Generated Today', value: String(kpis.generatedToday), sub: `Limit ${settings.dailyLimit}/day`, tone: 'text-white' },
          { label: 'Scheduled', value: String(kpis.scheduled), sub: 'Queued slots', tone: 'text-[#3B82F6]' },
          { label: 'Published', value: String(kpis.published), sub: 'Live on channel', tone: 'text-[#10B981]' },
          { label: 'Failed', value: String(kpis.failed), sub: 'Needs retry', tone: kpis.failed > 0 ? 'text-[#EF4444]' : 'text-[#8E92A8]' },
          { label: 'Local Storage Used', value: formatBytes(kpis.localStorageBytes), sub: 'SQLite + MP4s', tone: 'text-[#F59E0B]' },
          { label: 'Total Library', value: String(kpis.totalLibrary), sub: 'All Shorts', tone: 'text-[#8B5CF6]' },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl bg-[#12131A] border border-[#27293A] p-4 flex flex-col justify-between gap-2"
          >
            <span className="text-xs text-[#8E92A8]">{metric.label}</span>
            <span className={`text-2xl font-semibold font-mono-tabular ${metric.tone}`}>
              {metric.value}
            </span>
            <span className="text-[11px] text-[#6E728A]">{metric.sub}</span>
          </div>
        ))}
      </section>

      {/* Quick-Launch Studio Modules */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#D4D6E2]">Quick-Launch Studio Tools</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Logo Editor', desc: 'Watermark & crop', icon: Layers, route: 'editors' as NavRoute, tab: 'logo' },
            { label: '4-Side Gradients', desc: 'Edge vignettes', icon: Palette, route: 'editors' as NavRoute, tab: 'gradient' },
            { label: 'Quote Editor', desc: '9:16 typography', icon: Type, route: 'editors' as NavRoute, tab: 'quote' },
            { label: 'My Videos', desc: 'Library & MP4s', icon: Film, route: 'videos' as NavRoute },
            { label: 'Schedule', desc: 'Publish slots', icon: CalendarClock, route: 'scheduler' as NavRoute },
            { label: 'Excel Database', desc: '4-tab workbook', icon: Database, route: 'database' as NavRoute },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.label}
                onClick={() => onNavigate(card.route, card.tab)}
                className="rounded-xl bg-[#12131A] hover:bg-[#181924] border border-[#27293A] hover:border-[#8B5CF6]/50 p-4 text-left transition-colors flex flex-col gap-2.5"
              >
                <Icon className="w-4 h-4 text-[#8B5CF6]" />
                <div>
                  <div className="text-sm font-medium text-white">{card.label}</div>
                  <div className="text-xs text-[#8E92A8]">{card.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live 12-Stage Pipeline Progress Tracker & Recent Shorts */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">12-Stage Automation Pipeline</h2>
              <p className="text-xs text-[#8E92A8]">
                {job
                  ? `Job ${job.status.toUpperCase()} · ${job.completedVideos}/${job.totalVideos} Shorts · Provider ${job.activeProvider}`
                  : 'No batch run executed yet. Start a batch to observe real-time stage execution.'}
              </p>
            </div>
            {job && (
              <span
                className={`text-xs font-medium font-mono-tabular ${
                  job.status === 'running'
                    ? 'text-[#8B5CF6]'
                    : job.status === 'completed'
                    ? 'text-[#10B981]'
                    : 'text-[#EF4444]'
                }`}
              >
                Stage {job.currentStageIndex}/12
              </span>
            )}
          </div>

          {/* 12 Stages Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {PIPELINE_STAGES.map((stageName, idx) => {
              const num = idx + 1;
              const current = job?.currentStageIndex ?? 0;
              const done =
                job?.status === 'completed' || (job?.status === 'running' && num < current);
              const active = job?.status === 'running' && num === current;

              return (
                <div
                  key={stageName}
                  className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${
                    active
                      ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/50 text-white'
                      : done
                      ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#D1FAE5]'
                      : 'bg-[#181924] border-[#27293A] text-[#8E92A8]'
                  }`}
                >
                  <span className="font-mono-tabular text-[11px] shrink-0">
                    {String(num).padStart(2, '0')}
                  </span>
                  <span className="truncate">{stageName}</span>
                  {done && <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 ml-auto" />}
                </div>
              );
            })}
          </div>

          {/* Step Logs */}
          <div className="rounded-lg bg-[#09090E] border border-[#27293A] p-3.5 h-52 overflow-y-auto font-mono-tabular text-xs space-y-1.5">
            {job && job.logs.length > 0 ? (
              job.logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-[#5C6078] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                  </span>
                  <span
                    className={
                      log.level === 'error'
                        ? 'text-[#EF4444]'
                        : log.level === 'warn'
                        ? 'text-[#F59E0B]'
                        : log.level === 'success'
                        ? 'text-[#10B981]'
                        : 'text-[#C8CBDA]'
                    }
                  >
                    [{String(log.stageIndex).padStart(2, '0')} {log.stageName}] {log.message}
                  </span>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-[#6E728A]">
                Pipeline logs will stream here when a generation batch starts.
              </div>
            )}
          </div>
        </div>

        {/* Recent Shorts Preview */}
        <div className="xl:col-span-5 rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent Shorts</h2>
            <button
              onClick={() => onNavigate('videos')}
              className="text-xs text-[#8B5CF6] hover:underline font-medium"
            >
              View All ({kpis.totalLibrary})
            </button>
          </div>

          {recentVideos.length === 0 ? (
            <div className="py-14 text-center space-y-3 border border-dashed border-[#27293A] rounded-xl">
              <Wand2 className="w-6 h-6 text-[#8B5CF6] mx-auto" />
              <div className="text-sm text-[#D4D6E2]">No Shorts generated yet</div>
              <p className="text-xs text-[#8E92A8] max-w-xs mx-auto">
                Click &ldquo;GENERATE 5 SHORTS&rdquo; above or customize styles in the Generate Studio.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {recentVideos.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onNavigate('videos')}
                  className="group text-left rounded-lg overflow-hidden bg-[#181924] border border-[#27293A] hover:border-[#8B5CF6]/50 transition-colors"
                >
                  <div className="aspect-[9/16] bg-[#09090E] relative overflow-hidden">
                    <img
                      src={v.thumbnailUrl || v.backgroundImageUrl}
                      alt={v.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                    />
                  </div>
                  <div className="p-2.5 space-y-1">
                    <div className="text-xs font-medium text-white truncate">{v.title}</div>
                    <div className="text-[11px] text-[#8E92A8] truncate">
                      {v.status} · {v.aiEngineUsed}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* GENERATE MORE Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Generate Batch Quantity</h3>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1 text-[#8E92A8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#9B9FB5]">
              Select how many unique Shorts to synthesize, verify with the Non-Repetition Engine, and render to 9:16 MP4.
            </p>

            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setCustomQty(n)}
                  className={`py-2.5 rounded-lg border text-sm font-mono-tabular font-semibold transition-colors ${
                    customQty === n
                      ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                      : 'bg-[#181924] border-[#27293A] text-[#A0A4B8] hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="text-[#D4D6E2]">Custom Quantity (1–50)</label>
                <span className="font-mono-tabular text-[#8B5CF6] font-semibold">{customQty} Shorts</span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={customQty}
                onChange={(e) => setCustomQty(Number(e.target.value))}
                className="w-full accent-[#8B5CF6]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 rounded-lg border border-[#27293A] text-xs font-medium text-[#A0A4B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                disabled={launching}
                onClick={() => handleLaunch(customQty)}
                className="px-5 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold"
              >
                {launching ? 'Starting...' : `Start ${customQty} Shorts`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
