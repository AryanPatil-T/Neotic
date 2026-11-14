import React, { useState } from 'react';
import { Activity, CheckCircle2, Save, ShieldAlert } from 'lucide-react';
import {
  AiEngine,
  ImageSourceMode,
  PrivacyStatus,
  ProductionMode,
  ProviderStatus,
  QuoteTone,
  StudioSettings,
  VideoResolution,
} from '../shared/types';
import { api } from '../lib/api';

interface SettingsPageProps {
  settings: StudioSettings;
  providers: ProviderStatus[];
  onSettingsUpdated: (s: StudioSettings) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  providers,
  onSettingsUpdated,
}) => {
  const [form, setForm] = useState<StudioSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; latencyMs: number; message: string }>
  >({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg(null);
    try {
      const { settings: updated } = await api.updateSettings({
        defaultProductionMode: form.defaultProductionMode,
        defaultImageSource: form.defaultImageSource,
        resolution: form.resolution,
        defaultPrivacy: form.defaultPrivacy,
        durationSec: form.durationSec,
        dailyLimit: form.dailyLimit,
        activeEngine: form.activeEngine,
        defaultQuoteTone: form.defaultQuoteTone,
        bwMonochrome: form.bwMonochrome,
        jaccardThreshold: form.jaccardThreshold,
        trigramThreshold: form.trigramThreshold,
      });
      onSettingsUpdated(updated);
      setSavedMsg('Studio settings persisted to local SQLite.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestProvider = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api.testProvider(id);
      setTestResults((prev) => ({ ...prev, [id]: res }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl sm:text-3xl font-semibold text-white">
            Studio Settings &amp; Provider Diagnostics
          </h1>
          <p className="text-sm text-[#9B9FB5] mt-1">
            Configure local defaults, MP4 rendering specs, non-repetition strictness, and inspect server-side AI &amp; stock providers.
          </p>
        </div>

        <button
          disabled={saving}
          onClick={handleSave}
          className="px-5 py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {savedMsg && (
        <div className="rounded-lg bg-[#10B981]/10 border border-[#10B981]/35 px-4 py-2.5 text-xs text-[#D1FAE5]">
          {savedMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Render & Pipeline Defaults */}
        <div className="lg:col-span-6 rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-5">
          <h2 className="text-base font-semibold text-white">Production &amp; Render Defaults</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[#A0A4B8]">Default Production Mode</label>
              <select
                value={form.defaultProductionMode}
                onChange={(e) =>
                  setForm((p) => ({ ...p, defaultProductionMode: e.target.value as ProductionMode }))
                }
                className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
              >
                <option value="single_image">Mode A: Single Image Motivation</option>
                <option value="multi_scene">Mode B: Multi-Scene Storytelling</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#A0A4B8]">Default Image Source</label>
              <select
                value={form.defaultImageSource}
                onChange={(e) =>
                  setForm((p) => ({ ...p, defaultImageSource: e.target.value as ImageSourceMode }))
                }
                className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
              >
                <option value="stock_web">Free Stock Web Photos</option>
                <option value="uploaded">My Uploaded Photos</option>
                <option value="gemini_ai">Gemini AI Image Generation</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#A0A4B8]">MP4 Resolution</label>
              <select
                value={form.resolution}
                onChange={(e) =>
                  setForm((p) => ({ ...p, resolution: e.target.value as VideoResolution }))
                }
                className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white"
              >
                <option value="1080x1920">1080x1920 (Full HD 9:16)</option>
                <option value="720x1280">720x1280 (Fast Render 9:16)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#A0A4B8]">Default Upload Privacy</label>
              <select
                value={form.defaultPrivacy}
                onChange={(e) =>
                  setForm((p) => ({ ...p, defaultPrivacy: e.target.value as PrivacyStatus }))
                }
                className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
              >
                <option value="private">Private (Required for scheduled publishAt)</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#A0A4B8]">Default AI Engine</label>
              <select
                value={form.activeEngine}
                onChange={(e) =>
                  setForm((p) => ({ ...p, activeEngine: e.target.value as AiEngine }))
                }
                className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
              >
                <option value="auto">Auto Failover (Groq → OpenRouter → DeepSeek → Gemini)</option>
                <option value="groq">Groq Free</option>
                <option value="openrouter">OpenRouter DeepSeek Free</option>
                <option value="deepseek">DeepSeek Direct</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#A0A4B8]">Default Quote Voice</label>
              <select
                value={form.defaultQuoteTone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, defaultQuoteTone: e.target.value as QuoteTone }))
                }
                className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs text-white"
              >
                <option value="secular_wisdom">Secular Epic &amp; Life Wisdom (Advice + Reason)</option>
                <option value="dark_cinema">Dark Cinema Monologue</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#A0A4B8]">Daily Generation Limit</label>
              <input
                type="number"
                min={1}
                max={200}
                value={form.dailyLimit}
                onChange={(e) => setForm((p) => ({ ...p, dailyLimit: Number(e.target.value) || 25 }))}
                className="w-full px-3 py-2 rounded-lg bg-[#09090E] border border-[#27293A] text-xs font-mono-tabular text-white"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#A0A4B8]">Video Duration</span>
              <span className="font-mono-tabular text-white">{form.durationSec}s</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              value={form.durationSec}
              onChange={(e) => setForm((p) => ({ ...p, durationSec: Number(e.target.value) }))}
              className="w-full accent-[#8B5CF6]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#27293A]">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[#A0A4B8]">Jaccard Rejection</span>
                <span className="font-mono-tabular text-white">
                  {Math.round(form.jaccardThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={35}
                max={85}
                value={Math.round(form.jaccardThreshold * 100)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, jaccardThreshold: Number(e.target.value) / 100 }))
                }
                className="w-full accent-[#8B5CF6]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[#A0A4B8]">Trigram Cosine Rejection</span>
                <span className="font-mono-tabular text-white">
                  {Math.round(form.trigramThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={45}
                max={92}
                value={Math.round(form.trigramThreshold * 100)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, trigramThreshold: Number(e.target.value) / 100 }))
                }
                className="w-full accent-[#8B5CF6]"
              />
            </div>
          </div>
        </div>

        {/* Server-Side Provider Environment Status */}
        <div className="lg:col-span-6 rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Server-Side AI &amp; Stock Providers</h2>
            <p className="text-xs text-[#8E92A8] mt-1">
              Keys are read securely from server environment variables (<span className="font-mono-tabular">.env</span>) and never exposed to the browser.
            </p>
          </div>

          <div className="divide-y divide-[#27293A] border border-[#27293A] rounded-xl overflow-hidden">
            {providers.map((p) => {
              const test = testResults[p.id];
              return (
                <div key={p.id} className="p-4 bg-[#12131A] space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{p.name}</span>
                        {p.configured ? (
                          <span className="text-[11px] text-[#10B981] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Configured
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#8E92A8] inline-flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> Not set in .env
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8E92A8] font-mono-tabular mt-0.5">
                        {p.model} · {p.freeTierNote}
                      </div>
                    </div>

                    <button
                      disabled={testingId === p.id}
                      onClick={() => handleTestProvider(p.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-[11px] font-medium text-white inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Activity className="w-3 h-3 text-[#8B5CF6]" />
                      <span>{testingId === p.id ? 'Testing...' : 'Test'}</span>
                    </button>
                  </div>

                  {test && (
                    <div
                      className={`text-[11px] font-mono-tabular ${
                        test.ok ? 'text-[#10B981]' : 'text-[#F59E0B]'
                      }`}
                    >
                      {test.message} {test.latencyMs > 0 ? `(${test.latencyMs}ms)` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
