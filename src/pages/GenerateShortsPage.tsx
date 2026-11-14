import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Play,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AiEngine,
  CONTENT_CATEGORIES,
  ImageSourceMode,
  ProductionMode,
  ProviderStatus,
  QuoteTone,
  StudioSettings,
  UploadedAsset,
  VISUAL_STYLES,
} from '../shared/types';
import {
  CURATED_WISDOM_QUOTES,
  CuratedWisdomQuote,
  WisdomTradition,
} from '../shared/curatedQuotes';
import { api } from '../lib/api';

interface GenerateShortsPageProps {
  settings: StudioSettings;
  providers: ProviderStatus[];
  isRunning: boolean;
  onStartBatch: (payload: {
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
  }) => Promise<void>;
}

export const GenerateShortsPage: React.FC<GenerateShortsPageProps> = ({
  settings,
  providers,
  isRunning,
  onStartBatch,
}) => {
  const [quantity, setQuantity] = useState(5);
  const [productionMode, setProductionMode] = useState<ProductionMode>(settings.defaultProductionMode);
  const [imageSource, setImageSource] = useState<ImageSourceMode>(settings.defaultImageSource);
  const [engine, setEngine] = useState<AiEngine>(settings.activeEngine);
  const [quoteTone, setQuoteTone] = useState<QuoteTone>(settings.defaultQuoteTone || 'secular_wisdom');
  const [bwMonochrome, setBwMonochrome] = useState(settings.bwMonochrome);
  const [autoUploadSchedule, setAutoUploadSchedule] = useState(settings.autoUploadSchedule);

  const [selectedStyles, setSelectedStyles] = useState<string[]>([
    'Dark Cinematic Motivation',
    'Lone Wolf',
    'Mountain Solitude',
  ]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Timeless Wisdom',
    'Epic Strategy',
    'Life Lessons',
  ]);

  const [traditionFilter, setTraditionFilter] = useState<'All' | WisdomTradition>('All');
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredQuotes = useMemo(() => {
    if (traditionFilter === 'All') return CURATED_WISDOM_QUOTES;
    return CURATED_WISDOM_QUOTES.filter((q) => q.tradition === traditionFilter);
  }, [traditionFilter]);

  useEffect(() => {
    api.getAssets('photo').then((res) => setUploadedPhotos(res.assets)).catch(() => {});
  }, []);

  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    if (list.includes(item)) {
      if (list.length > 1) setter(list.filter((x) => x !== item));
    } else {
      setter([...list, item]);
    }
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { asset } = await api.uploadAsset(file, 'photo');
        setUploadedPhotos((prev) => [asset, ...prev]);
      }
      setImageSource('uploaded');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    await api.deleteAsset(id);
    setUploadedPhotos((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    setLaunching(true);
    try {
      await onStartBatch({
        quantity,
        productionMode,
        imageSource,
        engine,
        quoteTone,
        visualStyles: selectedStyles,
        categories: selectedCategories,
        bwMonochrome,
        autoUploadSchedule,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to launch generation pipeline');
    } finally {
      setLaunching(false);
    }
  };

  const handleRenderCuratedQuotes = async (quotesToRender: CuratedWisdomQuote[]) => {
    if (quotesToRender.length === 0) return;
    setErrorMsg(null);
    setLaunching(true);
    try {
      await onStartBatch({
        quantity: quotesToRender.length,
        productionMode,
        imageSource,
        engine,
        quoteTone,
        visualStyles: selectedStyles,
        categories: selectedCategories,
        bwMonochrome,
        autoUploadSchedule,
        customConcepts: quotesToRender.map((item) => ({
          quote: item.quote,
          title: item.title,
          topic: item.topic,
          description: item.description,
          hashtags: item.hashtags,
          visualQuery: item.visualQuery,
          category: item.category,
          visualStyle: item.visualStyle,
        })),
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to render selected quotes');
    } finally {
      setLaunching(false);
    }
  };

  const handleCopyQuote = async (item: CuratedWisdomQuote) => {
    try {
      await navigator.clipboard.writeText(item.quote);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((curr) => (curr === item.id ? null : curr)), 1800);
    } catch {
      // ignore clipboard errors in restricted frames
    }
  };

  const toggleQuoteSelect = (id: string) => {
    setSelectedQuoteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl sm:text-3xl font-semibold text-white">
            Generate Shorts Studio
          </h1>
          <p className="text-sm text-[#9B9FB5] mt-1">
            Configure batch quantity, storytelling mode, visual aesthetics, AI failover engine, and non-repetition checks.
          </p>
        </div>

        <button
          disabled={launching || isRunning}
          onClick={handleSubmit}
          className="px-6 py-3 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{isRunning ? 'Pipeline Running...' : `Launch Batch (${quantity} Shorts)`}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/35 px-4 py-3 text-xs text-[#FCA5A5]">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Configuration Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Batch Quantity */}
          <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">1. Batch Quantity</h2>
              <span className="font-mono-tabular text-xs text-[#8B5CF6] font-semibold">
                {quantity} Video{quantity === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setQuantity(n)}
                  className={`px-4 py-2 rounded-lg border text-xs font-mono-tabular font-semibold transition-colors ${
                    quantity === n
                      ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                      : 'bg-[#181924] border-[#27293A] text-[#A0A4B8] hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="w-24 px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white focus:outline-none focus:border-[#8B5CF6]"
                aria-label="Custom batch quantity"
              />
            </div>
          </div>

          {/* 2. Quote Voice & Production Mode */}
          <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">2. Quote Voice &amp; Production Mode</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'secular_wisdom' as QuoteTone,
                  title: 'Secular Epic & Life Wisdom',
                  desc: 'Short advice + hidden reason drawn from Ramayana, Mahabharata & classics — zero religious jargon.',
                },
                {
                  id: 'dark_cinema' as QuoteTone,
                  title: 'Dark Cinema Monologue',
                  desc: 'Visceral psychological lines built for stark solitude and disciplined endurance.',
                },
              ].map((qt) => (
                <button
                  key={qt.id}
                  onClick={() => setQuoteTone(qt.id)}
                  className={`p-3.5 rounded-xl border text-left transition-colors space-y-1 ${
                    quoteTone === qt.id
                      ? 'bg-[#8B5CF6]/15 border-[#8B5CF6] text-white'
                      : 'bg-[#181924] border-[#27293A] text-[#A0A4B8] hover:text-white'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">{qt.title}</div>
                  <div className="text-[11px] text-[#8E92A8] leading-relaxed">{qt.desc}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {[
                {
                  id: 'single_image' as ProductionMode,
                  title: 'Mode A: Single Image Wisdom',
                  desc: `1 vertical 9:16 image · ${settings.durationSec}s · smooth camera zoom/drift & central quote`,
                },
                {
                  id: 'multi_scene' as ProductionMode,
                  title: 'Mode B: Multi-Scene Storytelling',
                  desc: `4 connected scenes · ${settings.durationSec}s total · per-scene overlay text & motion`,
                },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setProductionMode(m.id)}
                  className={`p-3.5 rounded-xl border text-left transition-colors space-y-1 ${
                    productionMode === m.id
                      ? 'bg-[#8B5CF6]/15 border-[#8B5CF6] text-white'
                      : 'bg-[#181924] border-[#27293A] text-[#A0A4B8] hover:text-white'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">{m.title}</div>
                  <div className="text-[11px] text-[#8E92A8] leading-relaxed">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Background Image Source */}
          <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">3. Background Image Source</h2>
              <label className="flex items-center gap-2 text-xs text-[#D4D6E2] cursor-pointer">
                <input
                  type="checkbox"
                  checked={bwMonochrome}
                  onChange={(e) => setBwMonochrome(e.target.checked)}
                  className="accent-[#8B5CF6] rounded"
                />
                <span>High-Contrast B&amp;W Monochrome Grading</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'stock_web' as ImageSourceMode,
                  title: 'Free Stock Web Photos',
                  desc: 'Openverse, Wikimedia & Pexels (repeat-URL blocked)',
                },
                {
                  id: 'uploaded' as ImageSourceMode,
                  title: 'My Uploaded Photos',
                  desc: `${uploadedPhotos.length} local photo(s) ready`,
                },
                {
                  id: 'gemini_ai' as ImageSourceMode,
                  title: 'AI Image Generation',
                  desc: 'Gemini 9:16 vertical artwork synthesis',
                },
              ].map((src) => (
                <button
                  key={src.id}
                  onClick={() => setImageSource(src.id)}
                  className={`p-3.5 rounded-xl border text-left transition-colors space-y-1 ${
                    imageSource === src.id
                      ? 'bg-[#8B5CF6]/15 border-[#8B5CF6] text-white'
                      : 'bg-[#181924] border-[#27293A] text-[#A0A4B8] hover:text-white'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">{src.title}</div>
                  <div className="text-[11px] text-[#8E92A8]">{src.desc}</div>
                </button>
              ))}
            </div>

            {/* Drag-and-drop / multi-file photo uploader */}
            <div className="space-y-3 pt-1">
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handlePhotoUpload(e.dataTransfer.files);
                }}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-[#343850] hover:border-[#8B5CF6] bg-[#09090E]/60 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-xs text-[#D4D6E2]">
                  {uploading ? 'Uploading photos...' : 'Drop vertical photos here or click to upload locally'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handlePhotoUpload(e.target.files)}
                />
              </label>

              {uploadedPhotos.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {uploadedPhotos.map((asset) => (
                    <div
                      key={asset.id}
                      className="relative aspect-[9/16] rounded-lg overflow-hidden border border-[#27293A] group"
                    >
                      <img
                        src={asset.fileUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="absolute top-1 right-1 p-1 rounded bg-black/70 text-[#EF4444] opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete uploaded photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 4. Text AI Engine */}
          <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">4. Text AI Engine</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {[
                { id: 'auto' as AiEngine, name: 'Auto Failover', note: 'Groq → OpenRouter → DeepSeek → Gemini' },
                { id: 'groq' as AiEngine, name: 'Groq Free', note: 'llama-3.3-70b-versatile' },
                { id: 'openrouter' as AiEngine, name: 'OpenRouter Free', note: 'deepseek/deepseek-chat:free' },
                { id: 'deepseek' as AiEngine, name: 'DeepSeek Direct', note: 'deepseek-chat' },
                { id: 'gemini' as AiEngine, name: 'Google Gemini', note: 'gemini-4-hydrogen' },
              ].map((eng) => {
                const statusObj = providers.find((p) => p.id === eng.id);
                const ready = eng.id === 'auto' ? providers.some((p) => p.role === 'text' && p.configured) : statusObj?.configured;
                return (
                  <button
                    key={eng.id}
                    onClick={() => setEngine(eng.id)}
                    className={`p-3 rounded-lg border text-left transition-colors space-y-1 ${
                      engine === eng.id
                        ? 'bg-[#8B5CF6]/15 border-[#8B5CF6] text-white'
                        : 'bg-[#181924] border-[#27293A] text-[#A0A4B8] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white">{eng.name}</span>
                      <span className={`text-[10px] font-mono-tabular ${ready ? 'text-[#10B981]' : 'text-[#8E92A8]'}`}>
                        {ready ? 'Ready' : 'Env Unset'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#8E92A8] truncate">{eng.note}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Styles, Categories & Guardrails Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* 5. 11 Dark Cinematic Visual Styles */}
          <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">5. Visual Styles (11)</h2>
              <span className="text-xs text-[#8E92A8] font-mono-tabular">
                {selectedStyles.length} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {VISUAL_STYLES.map((style) => {
                const active = selectedStyles.includes(style);
                return (
                  <button
                    key={style}
                    onClick={() => toggleItem(selectedStyles, style, setSelectedStyles)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      active
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                        : 'bg-[#181924] border-[#27293A] text-[#A0A4B8] hover:text-white'
                    }`}
                  >
                    {active && <Check className="w-3 h-3 text-[#8B5CF6]" />}
                    <span>{style}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Content Categories */}
          <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                6. Content Categories ({CONTENT_CATEGORIES.length})
              </h2>
              <span className="text-xs text-[#8E92A8] font-mono-tabular">
                {selectedCategories.length} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CONTENT_CATEGORIES.map((cat) => {
                const active = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleItem(selectedCategories, cat, setSelectedCategories)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      active
                        ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-white'
                        : 'bg-[#181924] border-[#27293A] text-[#A0A4B8] hover:text-white'
                    }`}
                  >
                    {active && <Check className="w-3 h-3 text-[#3B82F6]" />}
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. Non-Repetition Engine & Auto-Schedule */}
          <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-5 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-white">Non-Repetition Engine Active</h2>
                <p className="text-xs text-[#9B9FB5] leading-relaxed">
                  Every generated quote, topic, and title is verified against the permanent SQLite{' '}
                  <span className="font-mono-tabular text-[#D4D6E2]">used_content</span> archive using exact match,
                  normalized Jaccard token similarity (&ge; {Math.round(settings.jaccardThreshold * 100)}%),
                  and character trigram cosine (&ge; {Math.round(settings.trigramThreshold * 100)}%). Auto-retries up to 4 times.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#27293A] flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-white">
                  Auto-Upload &amp; Schedule to YouTube
                </div>
                <div className="text-[11px] text-[#8E92A8]">
                  Assigns next collision-free slot after rendering MP4
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoUploadSchedule((v) => !v)}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 ${
                  autoUploadSchedule ? 'bg-[#8B5CF6]' : 'bg-[#27293A]'
                }`}
                aria-label="Toggle Auto-Upload & Schedule"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    autoUploadSchedule ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Curated High-Retention Wisdom Quote Vault */}
      <section className="rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-playfair text-xl font-semibold text-white">
              Secular Wisdom Quote Vault
            </h2>
            <p className="text-xs text-[#9B9FB5]">
              Short life-advice quotes distilled from the Mahabharata, Ramayana, Bhagavad Gita, Upanishads &amp; Eastern classics — phrased without religious wording so any viewer connects instantly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {selectedQuoteIds.length > 0 && (
              <button
                disabled={launching || isRunning}
                onClick={() =>
                  handleRenderCuratedQuotes(
                    CURATED_WISDOM_QUOTES.filter((q) => selectedQuoteIds.includes(q.id))
                  )
                }
                className="px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Render {selectedQuoteIds.length} Selected</span>
              </button>
            )}
          </div>
        </div>

        {/* Tradition Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#27293A] pb-4">
          {(['All', 'Mahabharata', 'Ramayana', 'Gita & Upanishads', 'Eastern Classics'] as const).map(
            (trad) => (
              <button
                key={trad}
                onClick={() => setTraditionFilter(trad)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  traditionFilter === trad
                    ? 'bg-[#8B5CF6] text-white'
                    : 'bg-[#181924] text-[#9B9FB5] hover:text-white border border-[#27293A]'
                }`}
              >
                {trad}
              </button>
            )
          )}
        </div>

        {/* Quote List */}
        <div className="divide-y divide-[#27293A]">
          {filteredQuotes.map((item) => {
            const checked = selectedQuoteIds.includes(item.id);
            return (
              <div
                key={item.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleQuoteSelect(item.id)}
                    aria-label={`Select quote: ${item.title}`}
                    className="mt-1 accent-[#8B5CF6] shrink-0 cursor-pointer"
                  />
                  <div className="space-y-1.5 min-w-0">
                    <p className="font-playfair text-base sm:text-lg text-white leading-snug">
                      &ldquo;{item.quote}&rdquo;
                    </p>
                    <p className="text-xs text-[#9B9FB5] leading-relaxed">
                      {item.deeperMeaning}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7E8299]">
                      <span>{item.inspirationNote}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.title}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.visualStyle}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-6 lg:pl-0">
                  <button
                    onClick={() => handleCopyQuote(item)}
                    className="px-3 py-2 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs font-medium text-[#D4D6E2] flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    disabled={launching || isRunning}
                    onClick={() => handleRenderCuratedQuotes([item])}
                    className="px-3.5 py-2 rounded-lg bg-[#8B5CF6]/15 hover:bg-[#8B5CF6] border border-[#8B5CF6]/40 disabled:opacity-50 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Render Short</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
