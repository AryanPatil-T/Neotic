import React, { useEffect, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Layers,
  Palette,
  RefreshCw,
  Save,
  Type,
  Upload,
} from 'lucide-react';
import {
  GRADIENT_PRESETS,
  GradientEdgeConfig,
  GradientPresetName,
  GradientsConfig,
  LogoConfig,
  QuoteBackdropStyle,
  QuoteFontFamily,
  QuoteStyleConfig,
  STUDIO_SAMPLE_IMAGES,
  StudioSettings,
  VideoRecord,
} from '../shared/types';
import { api } from '../lib/api';
import { ShortsLivePreviewCanvas } from '../components/ShortsLivePreviewCanvas';

interface VisualEditorsPageProps {
  settings: StudioSettings;
  videos: VideoRecord[];
  initialTab?: string;
  initialVideoId?: string | null;
  onSettingsSaved: (updated: StudioSettings) => void;
  onVideoUpdated: (updated: VideoRecord) => void;
}

const FONT_OPTIONS: QuoteFontFamily[] = [
  'Playfair Display',
  'Cinzel',
  'Cormorant Garamond',
  'Inter',
];

const QUOTE_SWATCHES = ['#F8FAFC', '#E2E8F0', '#FDE68A', '#C4B5FD', '#93C5FD', '#FDA4AF'];

export const VisualEditorsPage: React.FC<VisualEditorsPageProps> = ({
  settings,
  videos,
  initialTab,
  initialVideoId,
  onSettingsSaved,
  onVideoUpdated,
}) => {
  const [editorTab, setEditorTab] = useState<'logo' | 'gradient' | 'quote'>(
    initialTab === 'gradient' || initialTab === 'quote' ? initialTab : 'logo'
  );
  const [targetId, setTargetId] = useState<string>(initialVideoId || 'global');

  const selectedVideo = targetId === 'global' ? null : videos.find((v) => v.id === targetId) ?? null;

  const [logo, setLogo] = useState<LogoConfig>(selectedVideo?.logoConfig ?? settings.logoConfig);
  const [gradients, setGradients] = useState<GradientsConfig>(
    selectedVideo?.gradientsConfig ?? settings.gradientsConfig
  );
  const [quoteStyle, setQuoteStyle] = useState<QuoteStyleConfig>(
    selectedVideo?.quoteStyleConfig ?? settings.quoteStyleConfig
  );
  const [quoteText, setQuoteText] = useState<string>(
    selectedVideo?.quote || 'Discipline is choosing between what you want now and what you want most.'
  );
  const [previewBg, setPreviewBg] = useState<string>(
    selectedVideo?.backgroundImageUrl || STUDIO_SAMPLE_IMAGES[0].fileUrl
  );

  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab === 'logo' || initialTab === 'gradient' || initialTab === 'quote') {
      setEditorTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialVideoId) setTargetId(initialVideoId);
  }, [initialVideoId]);

  useEffect(() => {
    const vid = targetId === 'global' ? null : videos.find((v) => v.id === targetId) ?? null;
    if (vid) {
      setLogo(vid.logoConfig);
      setGradients(vid.gradientsConfig);
      setQuoteStyle(vid.quoteStyleConfig);
      setQuoteText(vid.quote);
      setPreviewBg(vid.backgroundImageUrl);
    } else {
      setLogo(settings.logoConfig);
      setGradients(settings.gradientsConfig);
      setQuoteStyle(settings.quoteStyleConfig);
    }
  }, [targetId, videos, settings]);

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return;
    const { asset } = await api.uploadAsset(file, 'logo');
    setLogo((prev) => ({ ...prev, imageUrl: asset.fileUrl }));
  };

  const applyLogoPreset = (pos: 'tl' | 'tr' | 'bl' | 'br' | 'center') => {
    const map = {
      tl: { xPct: 15, yPct: 10 },
      tr: { xPct: 85, yPct: 10 },
      bl: { xPct: 15, yPct: 90 },
      br: { xPct: 85, yPct: 90 },
      center: { xPct: 50, yPct: 50 },
    };
    setLogo((prev) => ({ ...prev, ...map[pos] }));
  };

  const applyQuotePlacement = (pos: 'top' | 'upper' | 'center' | 'lower' | 'bottom') => {
    const map = { top: 20, upper: 36, center: 50, lower: 66, bottom: 80 };
    setQuoteStyle((prev) => ({ ...prev, yPct: map[pos], xPct: 50 }));
  };

  const applyGradientPreset = (preset: GradientPresetName) => {
    if (preset === 'Custom') {
      setGradients((prev) => ({ ...prev, preset: 'Custom' }));
      return;
    }
    setGradients({ preset, ...GRADIENT_PRESETS[preset] });
  };

  const updateEdge = (
    edge: 'top' | 'bottom' | 'left' | 'right',
    patch: Partial<GradientEdgeConfig>
  ) => {
    setGradients((prev) => ({
      ...prev,
      preset: 'Custom',
      [edge]: { ...prev[edge], ...patch },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      if (selectedVideo) {
        const { video } = await api.updateVideo(selectedVideo.id, {
          quote: quoteText,
          logoConfig: logo,
          gradientsConfig: gradients,
          quoteStyleConfig: quoteStyle,
        });
        onVideoUpdated(video);
        setStatusMessage('Saved visual edits to selected Short.');
      } else {
        const { settings: updated } = await api.updateSettings({
          logoConfig: logo,
          gradientsConfig: gradients,
          quoteStyleConfig: quoteStyle,
        });
        onSettingsSaved(updated);
        setStatusMessage('Saved global studio defaults.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReRender = async () => {
    if (!selectedVideo) return;
    setRendering(true);
    setStatusMessage(null);
    try {
      const { video } = await api.renderVideo(selectedVideo.id, {
        quote: quoteText,
        logoConfig: logo,
        gradientsConfig: gradients,
        quoteStyleConfig: quoteStyle,
      });
      onVideoUpdated(video);
      setStatusMessage('Re-rendered MP4 with updated typography, gradients & logo.');
    } catch (err: any) {
      setStatusMessage(err?.message || 'Re-render failed');
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Target Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl sm:text-3xl font-semibold text-white">
            Real-Time 9:16 Visual Editors
          </h1>
          <p className="text-sm text-[#9B9FB5] mt-1">
            Customize global defaults or tune a specific video&rsquo;s logo, 4-sided vignette gradients, and quote typography without regenerating artwork.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="px-3.5 py-2 rounded-lg bg-[#12131A] border border-[#27293A] text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
          >
            <option value="global">Target: Global Studio Defaults</option>
            {videos.map((v) => (
              <option key={v.id} value={v.id}>
                Video: {v.title}
              </option>
            ))}
          </select>

          <button
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Config'}</span>
          </button>

          {selectedVideo && (
            <button
              disabled={rendering}
              onClick={handleReRender}
              className="px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rendering ? 'animate-spin' : ''}`} />
              <span>{rendering ? 'Rendering MP4...' : 'Re-Render Video'}</span>
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 px-4 py-2.5 text-xs text-white">
          {statusMessage}
        </div>
      )}

      {/* Main Split: Controls Left + Interactive 9:16 Preview Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        <div className="xl:col-span-7 space-y-5">
          {/* Segmented Editor Tabs */}
          <div className="inline-flex p-1 rounded-xl bg-[#12131A] border border-[#27293A]">
            {[
              { id: 'logo' as const, label: 'Logo / Watermark', icon: Layers },
              { id: 'gradient' as const, label: '4-Sided Gradients', icon: Palette },
              { id: 'quote' as const, label: 'Quote Typography', icon: Type },
            ].map((t) => {
              const Icon = t.icon;
              const active = editorTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setEditorTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#8B5CF6] text-white'
                      : 'text-[#9B9FB5] hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* 1. LOGO / WATERMARK EDITOR */}
          {editorTab === 'logo' && (
            <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">Logo &amp; Watermark</h2>
                  <p className="text-xs text-[#8E92A8]">Upload PNG/JPG logo and drag directly on the 9:16 frame.</p>
                </div>
                <label className="px-3.5 py-2 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs font-medium text-white cursor-pointer flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span>Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-[#A0A4B8]">Snap Presets</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'tl' as const, label: 'Top-Left' },
                    { id: 'tr' as const, label: 'Top-Right' },
                    { id: 'center' as const, label: 'Center' },
                    { id: 'bl' as const, label: 'Bottom-Left' },
                    { id: 'br' as const, label: 'Bottom-Right' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyLogoPreset(p.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs text-[#D4D6E2]"
                    >
                      {p.label}
                    </button>
                  ))}
                  {logo.imageUrl && (
                    <button
                      onClick={() => setLogo((prev) => ({ ...prev, imageUrl: '' }))}
                      className="px-3 py-1.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-xs text-[#FCA5A5]"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SliderField
                  label="Size"
                  value={logo.sizePct}
                  min={5}
                  max={34}
                  unit="%"
                  onChange={(v) => setLogo((p) => ({ ...p, sizePct: v }))}
                />
                <SliderField
                  label="Opacity"
                  value={Math.round(logo.opacity * 100)}
                  min={10}
                  max={100}
                  unit="%"
                  onChange={(v) => setLogo((p) => ({ ...p, opacity: v / 100 }))}
                />
                <SliderField
                  label="Crop Zoom"
                  value={Math.round(logo.cropZoom * 100)}
                  min={100}
                  max={250}
                  unit="%"
                  onChange={(v) => setLogo((p) => ({ ...p, cropZoom: v / 100 }))}
                />
                <SliderField
                  label="Border Thickness"
                  value={logo.borderThickness}
                  min={0}
                  max={10}
                  unit="px"
                  onChange={(v) => setLogo((p) => ({ ...p, borderThickness: v }))}
                />
                <SliderField
                  label="Crop Offset X"
                  value={logo.cropOffsetX}
                  min={-40}
                  max={40}
                  unit="%"
                  onChange={(v) => setLogo((p) => ({ ...p, cropOffsetX: v }))}
                />
                <SliderField
                  label="Crop Offset Y"
                  value={logo.cropOffsetY}
                  min={-40}
                  max={40}
                  unit="%"
                  onChange={(v) => setLogo((p) => ({ ...p, cropOffsetY: v }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#27293A]">
                <label className="flex items-center gap-2 text-xs text-[#D4D6E2]">
                  <input
                    type="checkbox"
                    checked={logo.circularCrop}
                    onChange={(e) => setLogo((p) => ({ ...p, circularCrop: e.target.checked }))}
                    className="accent-[#8B5CF6]"
                  />
                  <span>Circular Crop</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[#D4D6E2]">
                  <input
                    type="checkbox"
                    checked={logo.shadowEnabled}
                    onChange={(e) => setLogo((p) => ({ ...p, shadowEnabled: e.target.checked }))}
                    className="accent-[#8B5CF6]"
                  />
                  <span>Drop Shadow</span>
                </label>

                <div className="flex items-center gap-2 text-xs text-[#D4D6E2]">
                  <span>Border:</span>
                  <input
                    type="color"
                    value={logo.borderColor}
                    onChange={(e) => setLogo((p) => ({ ...p, borderColor: e.target.value }))}
                    className="w-7 h-7 rounded bg-transparent border border-[#27293A] cursor-pointer"
                  />
                </div>
              </div>

              {logo.shadowEnabled && (
                <SliderField
                  label="Shadow Intensity"
                  value={logo.shadowIntensity}
                  min={0}
                  max={30}
                  unit="px"
                  onChange={(v) => setLogo((p) => ({ ...p, shadowIntensity: v }))}
                />
              )}
            </div>
          )}

          {/* 2. 4-SIDED GRADIENT EDITOR */}
          {editorTab === 'gradient' && (
            <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-5">
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-white">4-Sided Vignette Gradients</h2>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(GRADIENT_PRESETS) as GradientPresetName[]).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => applyGradientPreset(preset)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                        gradients.preset === preset
                          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                          : 'bg-[#181924] border-[#27293A] text-[#A0A4B8] hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
                  const cfg = gradients[side];
                  return (
                    <div
                      key={side}
                      className="rounded-xl bg-[#181924] border border-[#27293A] p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs font-semibold text-white capitalize cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cfg.enabled}
                            onChange={(e) => updateEdge(side, { enabled: e.target.checked })}
                            className="accent-[#8B5CF6]"
                          />
                          <span>{side} Edge</span>
                        </label>
                        <input
                          type="color"
                          value={cfg.color}
                          onChange={(e) => updateEdge(side, { color: e.target.value })}
                          className="w-6 h-6 rounded bg-transparent border border-[#27293A] cursor-pointer"
                        />
                      </div>

                      <SliderField
                        label="Opacity"
                        value={Math.round(cfg.opacity * 100)}
                        min={0}
                        max={100}
                        unit="%"
                        onChange={(v) => updateEdge(side, { opacity: v / 100 })}
                      />
                      <SliderField
                        label="Width Ratio"
                        value={cfg.widthPct}
                        min={5}
                        max={60}
                        unit="%"
                        onChange={(v) => updateEdge(side, { widthPct: v })}
                      />
                      <SliderField
                        label="Feathering"
                        value={cfg.featherPct}
                        min={10}
                        max={100}
                        unit="%"
                        onChange={(v) => updateEdge(side, { featherPct: v })}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. QUOTE TYPOGRAPHY EDITOR */}
          {editorTab === 'quote' && (
            <div className="rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white">Live Quote Text</label>
                <textarea
                  rows={3}
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#09090E] border border-[#27293A] text-sm text-white focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-[#A0A4B8]">Vertical Placement Presets</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'top' as const, label: 'Top' },
                    { id: 'upper' as const, label: 'Upper-Middle' },
                    { id: 'center' as const, label: 'Center' },
                    { id: 'lower' as const, label: 'Lower-Middle' },
                    { id: 'bottom' as const, label: 'Bottom' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyQuotePlacement(p.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs text-[#D4D6E2]"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-[#A0A4B8]">Font Family</label>
                  <select
                    value={quoteStyle.fontFamily}
                    onChange={(e) =>
                      setQuoteStyle((p) => ({ ...p, fontFamily: e.target.value as QuoteFontFamily }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-[#A0A4B8]">Font Weight &amp; Alignment</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={quoteStyle.fontWeight}
                      onChange={(e) =>
                        setQuoteStyle((p) => ({ ...p, fontWeight: Number(e.target.value) as 400 | 600 | 700 }))
                      }
                      className="flex-1 px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
                    >
                      <option value={400}>Regular (400)</option>
                      <option value={600}>SemiBold (600)</option>
                      <option value={700}>Bold (700)</option>
                    </select>
                    <div className="flex rounded-lg bg-[#09090E] border border-[#27293A] p-0.5">
                      {[
                        { id: 'left' as const, icon: AlignLeft },
                        { id: 'center' as const, icon: AlignCenter },
                        { id: 'right' as const, icon: AlignRight },
                      ].map((al) => {
                        const Icon = al.icon;
                        return (
                          <button
                            key={al.id}
                            onClick={() => setQuoteStyle((p) => ({ ...p, align: al.id }))}
                            className={`p-1.5 rounded ${
                              quoteStyle.align === al.id ? 'bg-[#8B5CF6] text-white' : 'text-[#8E92A8]'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-[#A0A4B8]">Text Color Swatches</div>
                <div className="flex items-center gap-2">
                  {QUOTE_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => setQuoteStyle((p) => ({ ...p, color: hex }))}
                      style={{ backgroundColor: hex }}
                      className={`w-6 h-6 rounded-full border ${
                        quoteStyle.color.toLowerCase() === hex.toLowerCase()
                          ? 'ring-2 ring-[#8B5CF6] ring-offset-2 ring-offset-[#12131A] border-white'
                          : 'border-[#27293A]'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={quoteStyle.color}
                    onChange={(e) => setQuoteStyle((p) => ({ ...p, color: e.target.value }))}
                    className="w-7 h-7 rounded bg-transparent border border-[#27293A] cursor-pointer ml-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SliderField
                  label="Font Size"
                  value={quoteStyle.fontSize}
                  min={28}
                  max={88}
                  unit="px"
                  onChange={(v) => setQuoteStyle((p) => ({ ...p, fontSize: v }))}
                />
                <SliderField
                  label="Max Width"
                  value={quoteStyle.maxWidthPct}
                  min={45}
                  max={92}
                  unit="%"
                  onChange={(v) => setQuoteStyle((p) => ({ ...p, maxWidthPct: v }))}
                />
                <SliderField
                  label="Letter Spacing"
                  value={quoteStyle.letterSpacing}
                  min={-2}
                  max={10}
                  unit="px"
                  onChange={(v) => setQuoteStyle((p) => ({ ...p, letterSpacing: v }))}
                />
                <SliderField
                  label="Line Height"
                  value={Math.round(quoteStyle.lineHeight * 100)}
                  min={105}
                  max={190}
                  unit="%"
                  onChange={(v) => setQuoteStyle((p) => ({ ...p, lineHeight: v / 100 }))}
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-[#27293A]">
                <label className="flex items-center gap-2 text-xs text-[#D4D6E2]">
                  <input
                    type="checkbox"
                    checked={quoteStyle.shadowEnabled}
                    onChange={(e) => setQuoteStyle((p) => ({ ...p, shadowEnabled: e.target.checked }))}
                    className="accent-[#8B5CF6]"
                  />
                  <span>Text Drop Shadow</span>
                </label>
                {quoteStyle.shadowEnabled && (
                  <div className="flex-1 min-w-[180px]">
                    <SliderField
                      label="Shadow Blur"
                      value={quoteStyle.shadowBlur}
                      min={2}
                      max={32}
                      unit="px"
                      onChange={(v) => setQuoteStyle((p) => ({ ...p, shadowBlur: v }))}
                    />
                  </div>
                )}
              </div>

              {/* Quote Backdrop Gradient / Legibility Scrim */}
              <div className="pt-4 border-t border-[#27293A] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quoteStyle.backdropEnabled !== false}
                      onChange={(e) =>
                        setQuoteStyle((p) => ({ ...p, backdropEnabled: e.target.checked }))
                      }
                      className="accent-[#8B5CF6]"
                    />
                    <span>Quote Backdrop Gradient Scrim (Legibility)</span>
                  </label>

                  <div className="flex items-center gap-2 text-xs text-[#A0A4B8]">
                    <span>Tint:</span>
                    <input
                      type="color"
                      value={quoteStyle.backdropColor || '#050509'}
                      onChange={(e) =>
                        setQuoteStyle((p) => ({ ...p, backdropColor: e.target.value }))
                      }
                      className="w-6 h-6 rounded bg-transparent border border-[#27293A] cursor-pointer"
                    />
                  </div>
                </div>

                {quoteStyle.backdropEnabled !== false && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'cinematic_band' as QuoteBackdropStyle, label: 'Cinematic Band' },
                        { id: 'radial_glow' as QuoteBackdropStyle, label: 'Radial Shadow' },
                        { id: 'solid_soft' as QuoteBackdropStyle, label: 'Soft Card' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setQuoteStyle((p) => ({ ...p, backdropStyle: opt.id }))}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                            (quoteStyle.backdropStyle || 'cinematic_band') === opt.id
                              ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                              : 'bg-[#181924] border-[#27293A] text-[#A0A4B8]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <SliderField
                        label="Backdrop Opacity"
                        value={Math.round((quoteStyle.backdropOpacity ?? 0.78) * 100)}
                        min={15}
                        max={98}
                        unit="%"
                        onChange={(v) =>
                          setQuoteStyle((p) => ({ ...p, backdropOpacity: v / 100 }))
                        }
                      />
                      <SliderField
                        label="Gradient Spread"
                        value={quoteStyle.backdropPaddingPct ?? 14}
                        min={6}
                        max={28}
                        unit="%"
                        onChange={(v) =>
                          setQuoteStyle((p) => ({ ...p, backdropPaddingPct: v }))
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sticky Live 9:16 Preview Canvas */}
        <div className="xl:col-span-5 flex flex-col items-center gap-4 xl:sticky xl:top-24">
          <ShortsLivePreviewCanvas
            backgroundImageUrl={previewBg}
            quoteText={quoteText}
            logoConfig={logo}
            gradientsConfig={gradients}
            quoteStyleConfig={quoteStyle}
            activeEditor={editorTab}
            onLogoMove={(xPct, yPct) => setLogo((p) => ({ ...p, xPct, yPct }))}
            onQuoteMove={(xPct, yPct) => setQuoteStyle((p) => ({ ...p, xPct, yPct }))}
          />

          {!selectedVideo && (
            <div className="flex items-center gap-2">
              {STUDIO_SAMPLE_IMAGES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => setPreviewBg(sample.fileUrl)}
                  className={`w-10 h-16 rounded-md overflow-hidden border transition-colors ${
                    previewBg === sample.fileUrl ? 'border-[#8B5CF6]' : 'border-[#27293A] opacity-65 hover:opacity-100'
                  }`}
                  title={`Preview on ${sample.name}`}
                >
                  <img src={sample.fileUrl} alt={sample.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SliderField: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, unit, onChange }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#A0A4B8]">{label}</span>
      <span className="font-mono-tabular text-[#D4D6E2]">
        {value}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[#8B5CF6]"
    />
  </div>
);
