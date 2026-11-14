export type ProductionMode = 'single_image' | 'multi_scene';
export type ImageSourceMode = 'stock_web' | 'uploaded' | 'gemini_ai';
export type AiEngine = 'auto' | 'groq' | 'openrouter' | 'deepseek' | 'gemini';
export type QuoteTone = 'secular_wisdom' | 'dark_cinema';
export type VideoStatus = 'generating' | 'completed' | 'scheduled' | 'published' | 'failed';
export type VideoResolution = '1080x1920' | '720x1280';
export type PrivacyStatus = 'private' | 'unlisted' | 'public';
export type CameraMotion =
  | 'slow_zoom_in'
  | 'slow_zoom_out'
  | 'ken_burns_drift'
  | 'horizontal_pan'
  | 'vertical_pan';

export type QuoteFontFamily =
  | 'Playfair Display'
  | 'Cinzel'
  | 'Cormorant Garamond'
  | 'Inter';

export type GradientPresetName =
  | 'Dark Cinematic'
  | 'Soft Black Vignette'
  | 'Moody Grey'
  | 'Deep Shadow'
  | 'Custom';

export interface LogoConfig {
  imageUrl: string;
  xPct: number; // 0..100
  yPct: number; // 0..100
  sizePct: number; // 4..35 (% of frame width)
  opacity: number; // 0..1
  circularCrop: boolean;
  cropZoom: number; // 1..2.5
  cropOffsetX: number; // -50..50
  cropOffsetY: number; // -50..50
  borderThickness: number; // 0..12 px
  borderColor: string;
  shadowEnabled: boolean;
  shadowIntensity: number; // 0..30 px blur
}

export interface GradientEdgeConfig {
  enabled: boolean;
  color: string;
  opacity: number; // 0..1
  widthPct: number; // 5..60
  featherPct: number; // 0..100
}

export interface GradientsConfig {
  preset: GradientPresetName;
  top: GradientEdgeConfig;
  bottom: GradientEdgeConfig;
  left: GradientEdgeConfig;
  right: GradientEdgeConfig;
}

export type QuoteBackdropStyle = 'cinematic_band' | 'radial_glow' | 'solid_soft';

export interface QuoteStyleConfig {
  fontFamily: QuoteFontFamily;
  fontSize: number; // 24..96 (scaled to 1080px base)
  fontWeight: 400 | 600 | 700;
  color: string;
  align: 'left' | 'center' | 'right';
  xPct: number; // 10..90
  yPct: number; // 10..90
  maxWidthPct: number; // 40..92
  letterSpacing: number; // -2..12 px
  lineHeight: number; // 1.0..2.0
  shadowEnabled: boolean;
  shadowBlur: number; // 0..32
  shadowColor: string;
  backdropEnabled: boolean;
  backdropStyle: QuoteBackdropStyle;
  backdropColor: string;
  backdropOpacity: number; // 0..1
  backdropPaddingPct: number; // 4..28
}

export interface SceneItem {
  sceneIndex: number;
  visualPrompt: string;
  overlayText: string;
  durationSec: number;
  motion: CameraMotion;
  imageUrl: string;
}

export interface VideoRecord {
  id: string;
  title: string;
  topic: string;
  quote: string;
  description: string;
  hashtags: string[];
  category: string;
  visualStyle: string;
  productionMode: ProductionMode;
  imageSource: ImageSourceMode;
  aiEngineUsed: string;
  resolution: VideoResolution;
  durationSec: number;
  status: VideoStatus;
  errorMessage?: string | null;
  backgroundImageUrl: string;
  thumbnailUrl: string;
  mp4Url: string;
  fileSizeBytes: number;
  scenes: SceneItem[];
  musicTrackId: string;
  musicVolume: number;
  logoConfig: LogoConfig;
  gradientsConfig: GradientsConfig;
  quoteStyleConfig: QuoteStyleConfig;
  scheduledAt?: string | null; // ISO UTC
  publishedAt?: string | null; // ISO UTC
  youtubeVideoId?: string | null;
  privacyStatus: PrivacyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UsedContentRecord {
  id: string;
  videoId: string;
  quote: string;
  topic: string;
  title: string;
  normalizedQuote: string;
  createdAt: string;
}

export interface MusicTrackRecord {
  id: string;
  title: string;
  mood: string;
  artist: string;
  license: string;
  durationSec: number;
  sourceType: 'builtin_synth' | 'uploaded';
  fileUrl: string;
  synthPreset?: string;
  createdAt: string;
}

export interface ScheduleConfig {
  intervalHours: number; // 1, 2, 3, 4, or custom
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  earliestHour: number; // 0..23
  latestHour: number; // 0..23
  preferredDays: string[]; // ['MON','TUE',...]
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  subscriberCount: string;
  videoCount: string;
  thumbnailUrl?: string;
}

export interface DailyAutomationConfig {
  enabled: boolean;
  runTime: string; // HH:mm 24h (e.g. '08:00')
  timezone: string; // IANA timezone (e.g. 'Asia/Kolkata')
  videosPerDay: number; // default 8 (7-8/day to respect YouTube limits)
  intervalHours: number; // default 2 ('two-two hours')
  firstPublishTime: string; // HH:mm 24h (e.g. '09:00')
  autoUploadToYouTube: boolean;
  autoSyncToSheets: boolean;
  lastRunDate: string | null; // YYYY-MM-DD in configured timezone
  lastRunAt: string | null; // ISO UTC
  lastRunStatus: 'idle' | 'running' | 'completed' | 'partial' | 'failed';
  lastRunMessage: string | null;
}

export interface StudioSettings {
  defaultProductionMode: ProductionMode;
  defaultImageSource: ImageSourceMode;
  resolution: VideoResolution;
  defaultPrivacy: PrivacyStatus;
  durationSec: number;
  dailyLimit: number;
  activeEngine: AiEngine;
  defaultQuoteTone: QuoteTone;
  bwMonochrome: boolean;
  autoUploadSchedule: boolean;
  autoSyncSheets: boolean;
  musicVolume: number; // 0..100
  autoSelectMoodTrack: boolean;
  activeMusicTrackId: string;
  jaccardThreshold: number;
  trigramThreshold: number;
  connectedSpreadsheetId: string;
  connectedSpreadsheetUrl: string;
  youtubeChannel: YouTubeChannelInfo | null;
  selectedCategories: string[];
  selectedVisualStyles: string[];
  categoryRotationIndex: number;
  styleRotationIndex: number;
  scheduleConfig: ScheduleConfig;
  dailyAutomation: DailyAutomationConfig;
  logoConfig: LogoConfig;
  gradientsConfig: GradientsConfig;
  quoteStyleConfig: QuoteStyleConfig;
}

export interface PipelineStepLog {
  timestamp: string;
  stageIndex: number;
  stageName: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

export interface PipelineJob {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  totalVideos: number;
  completedVideos: number;
  currentStageIndex: number; // 1..12
  currentStageName: string;
  activeProvider: string;
  logs: PipelineStepLog[];
  startedAt: string;
  finishedAt?: string | null;
}

export interface ProviderStatus {
  id: Exclude<AiEngine, 'auto'> | 'pexels';
  name: string;
  model: string;
  configured: boolean;
  role: 'text' | 'image' | 'stock';
  freeTierNote: string;
}

export interface UploadedAsset {
  id: string;
  name: string;
  kind: 'photo' | 'logo' | 'sample';
  fileUrl: string;
  sizeBytes: number;
  createdAt: string;
}

export const PIPELINE_STAGES: string[] = [
  'Generating topics',
  'Writing quotes',
  'Creating visual scripts',
  'Acquiring/generating images',
  'Applying typography',
  'Applying gradients',
  'Applying logo/watermark',
  'Adding music',
  'Rendering MP4',
  'Updating Excel/DB',
  'Uploading to YouTube',
  'Scheduling publication',
];

export const VISUAL_STYLES: string[] = [
  'Dark Cinematic Motivation',
  'Dark Wildlife',
  'Foggy Forest',
  'Black Panther',
  'Lone Wolf',
  'Powerful Eagle',
  'Cinematic Horse',
  'Dark Ocean',
  'Mountain Solitude',
  'Rainy City',
  'Philosophical Minimalism',
];

export const CONTENT_CATEGORIES: string[] = [
  'Timeless Wisdom',
  'Epic Strategy',
  'Life Lessons',
  'Psychology',
  'Philosophy',
  'Motivation',
  'Discipline',
  'Mental Strength',
  'Success',
  'Interesting Facts',
  'Science',
  'Technology',
  'Mystery',
  'Space',
];

export const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export const DEFAULT_LOGO_CONFIG: LogoConfig = {
  imageUrl: '',
  xPct: 50,
  yPct: 11,
  sizePct: 12,
  opacity: 0.85,
  circularCrop: true,
  cropZoom: 1,
  cropOffsetX: 0,
  cropOffsetY: 0,
  borderThickness: 2,
  borderColor: '#8B5CF6',
  shadowEnabled: true,
  shadowIntensity: 12,
};

export const GRADIENT_PRESETS: Record<GradientPresetName, Omit<GradientsConfig, 'preset'>> = {
  'Dark Cinematic': {
    top: { enabled: true, color: '#09090E', opacity: 0.88, widthPct: 34, featherPct: 85 },
    bottom: { enabled: true, color: '#09090E', opacity: 0.94, widthPct: 44, featherPct: 88 },
    left: { enabled: true, color: '#09090E', opacity: 0.45, widthPct: 18, featherPct: 80 },
    right: { enabled: true, color: '#09090E', opacity: 0.45, widthPct: 18, featherPct: 80 },
  },
  'Soft Black Vignette': {
    top: { enabled: true, color: '#000000', opacity: 0.65, widthPct: 28, featherPct: 90 },
    bottom: { enabled: true, color: '#000000', opacity: 0.78, widthPct: 35, featherPct: 90 },
    left: { enabled: true, color: '#000000', opacity: 0.35, widthPct: 15, featherPct: 85 },
    right: { enabled: true, color: '#000000', opacity: 0.35, widthPct: 15, featherPct: 85 },
  },
  'Moody Grey': {
    top: { enabled: true, color: '#14151D', opacity: 0.75, widthPct: 32, featherPct: 80 },
    bottom: { enabled: true, color: '#101118', opacity: 0.88, widthPct: 40, featherPct: 85 },
    left: { enabled: false, color: '#14151D', opacity: 0.3, widthPct: 14, featherPct: 75 },
    right: { enabled: false, color: '#14151D', opacity: 0.3, widthPct: 14, featherPct: 75 },
  },
  'Deep Shadow': {
    top: { enabled: true, color: '#050508', opacity: 0.95, widthPct: 38, featherPct: 78 },
    bottom: { enabled: true, color: '#050508', opacity: 0.98, widthPct: 48, featherPct: 82 },
    left: { enabled: true, color: '#050508', opacity: 0.62, widthPct: 24, featherPct: 80 },
    right: { enabled: true, color: '#050508', opacity: 0.62, widthPct: 24, featherPct: 80 },
  },
  Custom: {
    top: { enabled: true, color: '#09090E', opacity: 0.8, widthPct: 30, featherPct: 80 },
    bottom: { enabled: true, color: '#09090E', opacity: 0.9, widthPct: 40, featherPct: 85 },
    left: { enabled: false, color: '#09090E', opacity: 0.4, widthPct: 16, featherPct: 75 },
    right: { enabled: false, color: '#09090E', opacity: 0.4, widthPct: 16, featherPct: 75 },
  },
};

export const DEFAULT_GRADIENTS_CONFIG: GradientsConfig = {
  preset: 'Dark Cinematic',
  ...GRADIENT_PRESETS['Dark Cinematic'],
};

export const DEFAULT_QUOTE_STYLE: QuoteStyleConfig = {
  fontFamily: 'Playfair Display',
  fontSize: 54,
  fontWeight: 600,
  color: '#F8FAFC',
  align: 'center',
  xPct: 50,
  yPct: 56,
  maxWidthPct: 82,
  letterSpacing: 0.5,
  lineHeight: 1.32,
  shadowEnabled: true,
  shadowBlur: 20,
  shadowColor: 'rgba(0,0,0,0.95)',
  backdropEnabled: true,
  backdropStyle: 'cinematic_band',
  backdropColor: '#050509',
  backdropOpacity: 0.78,
  backdropPaddingPct: 14,
};

export const STUDIO_SAMPLE_IMAGES = [
  {
    id: 'sample-lone-wolf',
    name: 'Lone Wolf Ridge',
    style: 'Lone Wolf',
    fileUrl: '/media/samples/dark_lone_wolf_1794548198442.jpg',
  },
  {
    id: 'sample-black-panther',
    name: 'Black Panther Low-Key',
    style: 'Black Panther',
    fileUrl: '/media/samples/black_panther_shadow_1794548199075.jpg',
  },
  {
    id: 'sample-mountain-solitude',
    name: 'Mountain Solitude',
    style: 'Mountain Solitude',
    fileUrl: '/media/samples/mountain_solitude_fog_1794548199122.jpg',
  },
  {
    id: 'sample-rainy-city',
    name: 'Rainy City Noir',
    style: 'Rainy City',
    fileUrl: '/media/samples/rainy_city_noir_1794548198937.jpg',
  },
];
