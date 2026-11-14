import { useCallback, useEffect, useState } from 'react';
import {
  AiEngine,
  ImageSourceMode,
  PipelineJob,
  ProductionMode,
  ProviderStatus,
  QuoteTone,
  StudioSettings,
  VideoRecord,
} from './shared/types';
import { OverviewResponse, api } from './lib/api';
import { initAuth } from './lib/googleOAuth';
import { Layout, NavRoute } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { GenerateShortsPage } from './pages/GenerateShortsPage';
import { VisualEditorsPage } from './pages/VisualEditorsPage';
import { MusicLibraryPage } from './pages/MusicLibraryPage';
import { VideosLibraryPage } from './pages/VideosLibraryPage';
import { SchedulerPage } from './pages/SchedulerPage';
import { DatabasePage } from './pages/DatabasePage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const [route, setRoute] = useState<NavRoute>('dashboard');
  const [editorSubTab, setEditorSubTab] = useState<string>('logo');
  const [editorVideoId, setEditorVideoId] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshStudio = useCallback(async () => {
    try {
      const [ov, vids] = await Promise.all([api.getOverview(), api.getVideos()]);
      setOverview(ov);
      setVideos(vids.videos);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to connect to local AI Shorts Studio backend');
    }
  }, []);

  useEffect(() => {
    refreshStudio();
  }, [refreshStudio]);

  // Listen to Firebase Auth state and clear in-memory token on sign-out
  useEffect(() => {
    const unsub = initAuth(
      (_user, token) => {
        setGoogleToken(token);
      },
      () => {
        setGoogleToken(null);
      }
    );
    return () => unsub();
  }, []);

  // Sync active in-memory token to server RAM when signed in (never wipe server session on initial mount)
  useEffect(() => {
    if (googleToken) {
      api.setAutomationSessionToken(googleToken).catch(() => {});
    }
  }, [googleToken]);

  // Auto-sync browser timezone on first load if server defaulted to UTC
  useEffect(() => {
    if (!overview) return;
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz && browserTz !== 'UTC' && overview.settings.dailyAutomation?.timezone === 'UTC') {
      api
        .updateSettings({
          dailyAutomation: {
            ...overview.settings.dailyAutomation,
            timezone: browserTz,
          },
        })
        .then(({ settings }) => {
          setOverview((prev) => (prev ? { ...prev, settings } : prev));
        })
        .catch(() => {});
    }
  }, [overview?.settings.dailyAutomation?.timezone]);

  // Poll pipeline progress smoothly while running
  const isRunning = overview?.job?.status === 'running';
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      refreshStudio();
    }, 1500);
    return () => clearInterval(timer);
  }, [isRunning, refreshStudio]);

  const handleNavigate = (nextRoute: NavRoute, subTab?: string) => {
    setRoute(nextRoute);
    if (nextRoute === 'editors') {
      if (subTab) setEditorSubTab(subTab);
    }
  };

  const handleOpenEditorForVideo = (videoId: string, tab: 'logo' | 'gradient' | 'quote') => {
    setEditorVideoId(videoId);
    setEditorSubTab(tab);
    setRoute('editors');
  };

  const handleQuickGenerate = async (qty: number) => {
    if (!overview) return;
    await api.startGeneration(
      {
        quantity: qty,
        productionMode: overview.settings.defaultProductionMode,
        imageSource: overview.settings.defaultImageSource,
        engine: overview.settings.activeEngine,
        quoteTone: overview.settings.defaultQuoteTone,
        visualStyles:
          overview.settings.selectedVisualStyles && overview.settings.selectedVisualStyles.length > 0
            ? overview.settings.selectedVisualStyles
            : ['Dark Cinematic Motivation', 'Lone Wolf', 'Mountain Solitude'],
        categories:
          overview.settings.selectedCategories && overview.settings.selectedCategories.length > 0
            ? overview.settings.selectedCategories
            : ['Timeless Wisdom', 'Epic Strategy', 'Life Lessons'],
        bwMonochrome: overview.settings.bwMonochrome,
        autoUploadSchedule: overview.settings.autoUploadSchedule,
      },
      googleToken
    );
    await refreshStudio();
  };

  const handleCustomBatchGenerate = async (payload: {
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
  }) => {
    await api.startGeneration(payload, googleToken);
    await refreshStudio();
    setRoute('dashboard');
  };

  const handleSettingsUpdated = (updated: StudioSettings) => {
    setOverview((prev) => (prev ? { ...prev, settings: updated } : prev));
    refreshStudio();
  };

  const handleVideoUpdated = (updated: VideoRecord) => {
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    refreshStudio();
  };

  if (!overview) {
    return (
      <div className="min-h-screen bg-[#09090E] text-[#F4F4F6] flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="font-playfair text-xl font-semibold text-white">AI Shorts Studio</div>
          <p className="text-xs text-[#9B9FB5]">
            {loadError ? loadError : 'Initializing local SQLite database and studio modules...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Layout
      activeRoute={route}
      onNavigate={(r) => handleNavigate(r)}
      activeProvider={overview.settings.activeEngine}
      pipelineJob={overview.job as PipelineJob | null}
      storageBytes={overview.kpis.localStorageBytes}
    >
      {route === 'dashboard' && (
        <DashboardPage
          kpis={overview.kpis}
          settings={overview.settings}
          job={overview.job}
          providers={overview.providers as ProviderStatus[]}
          recentVideos={overview.recentVideos}
          automation={overview.automation}
          accessToken={googleToken}
          onNavigate={handleNavigate}
          onQuickGenerate={handleQuickGenerate}
        />
      )}

      {route === 'generate' && (
        <GenerateShortsPage
          settings={overview.settings}
          providers={overview.providers}
          isRunning={isRunning}
          onStartBatch={handleCustomBatchGenerate}
        />
      )}

      {route === 'editors' && (
        <VisualEditorsPage
          settings={overview.settings}
          videos={videos}
          initialTab={editorSubTab}
          initialVideoId={editorVideoId}
          onSettingsSaved={handleSettingsUpdated}
          onVideoUpdated={handleVideoUpdated}
        />
      )}

      {route === 'music' && (
        <MusicLibraryPage
          settings={overview.settings}
          onSettingsUpdated={handleSettingsUpdated}
        />
      )}

      {route === 'videos' && (
        <VideosLibraryPage
          videos={videos}
          onVideosChanged={refreshStudio}
          onOpenEditor={handleOpenEditorForVideo}
          onNavigateScheduler={() => setRoute('scheduler')}
        />
      )}

      {route === 'scheduler' && (
        <SchedulerPage
          settings={overview.settings}
          videos={videos}
          automation={overview.automation}
          accessToken={googleToken}
          onTokenChange={setGoogleToken}
          onSettingsUpdated={handleSettingsUpdated}
          onVideosUpdated={refreshStudio}
        />
      )}

      {route === 'database' && (
        <DatabasePage
          settings={overview.settings}
          automation={overview.automation}
          accessToken={googleToken}
          onTokenChange={setGoogleToken}
          onSettingsUpdated={handleSettingsUpdated}
          onDataImported={refreshStudio}
        />
      )}

      {route === 'settings' && (
        <SettingsPage
          settings={overview.settings}
          providers={overview.providers}
          onSettingsUpdated={handleSettingsUpdated}
        />
      )}
    </Layout>
  );
}
