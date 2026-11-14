import { GoogleGenAI, Type } from '@google/genai';
import type {
  AiEngine,
  CameraMotion,
  MusicTrackRecord,
  ProductionMode,
  ProviderStatus,
  QuoteTone,
} from '../src/shared/types.ts';

function isRealKey(val: string | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.length > 6 &&
    !trimmed.startsWith('MY_') &&
    !trimmed.includes('PLACEHOLDER')
  );
}

export function getProviderStatuses(): ProviderStatus[] {
  return [
    {
      id: 'groq',
      name: 'Groq Free',
      model: 'llama-3.3-70b-versatile',
      configured: isRealKey(process.env.GROQ_API_KEY),
      role: 'text',
      freeTierNote: 'Ultra-fast free tier via GROQ_API_KEY',
    },
    {
      id: 'openrouter',
      name: 'OpenRouter Free',
      model: 'openrouter/free',
      configured: isRealKey(process.env.OPENROUTER_API_KEY),
      role: 'text',
      freeTierNote: 'Free model routing via OPENROUTER_API_KEY',
    },
    {
      id: 'deepseek',
      name: 'DeepSeek Direct',
      model: 'deepseek-chat',
      configured: isRealKey(process.env.DEEPSEEK_API_KEY),
      role: 'text',
      freeTierNote: 'Direct API via DEEPSEEK_API_KEY',
    },
    {
      id: 'gemini',
      name: 'Google Gemini API',
      model: 'gemini-4-hydrogen / gemini-3.1-flash-lite',
      configured: isRealKey(process.env.GEMINI_API_KEY),
      role: 'text',
      freeTierNote: 'Server-side Gemini SDK via GEMINI_API_KEY',
    },
    {
      id: 'pexels',
      name: 'Pexels Stock API',
      model: 'v1/search (vertical 9:16)',
      configured: isRealKey(process.env.PEXELS_API_KEY),
      role: 'stock',
      freeTierNote: 'Optional; falls back to 0-key Openverse & Wikimedia Commons',
    },
  ];
}

export function getGeminiClient(): GoogleGenAI | null {
  if (!isRealKey(process.env.GEMINI_API_KEY)) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface GeneratedShortConcept {
  topic: string;
  title: string;
  quote: string;
  description: string;
  hashtags: string[];
  visualQuery: string;
  scenes: Array<{
    visualPrompt: string;
    overlayText: string;
    motion: CameraMotion;
  }>;
  engineUsed: string;
}

const MOTIONS: CameraMotion[] = [
  'slow_zoom_in',
  'slow_zoom_out',
  'ken_burns_drift',
  'horizontal_pan',
  'vertical_pan',
];

function buildPrompt(params: {
  category: string;
  visualStyle: string;
  productionMode: ProductionMode;
  quoteTone?: QuoteTone;
  avoidQuotes: string[];
  retryHint?: string;
}): string {
  const avoidList = params.avoidQuotes.slice(0, 18).map((q) => `- "${q}"`).join('\n');
  const sceneCount = params.productionMode === 'multi_scene' ? 4 : 1;
  const useSecularWisdom =
    params.quoteTone === 'secular_wisdom' ||
    (!params.quoteTone &&
      /wisdom|epic|life lessons|philosophy|mental strength|psychology/i.test(params.category));

  const voiceSection = useSecularWisdom
    ? `You are a master distiller of timeless life wisdom for high-retention YouTube Shorts.
Craft ONE short, piercing life-advice quote inspired by the deeper philosophical truths found in classic epics and spiritual texts (such as the Mahabharata, Ramayana, Bhagavad Gita, Upanishads, Dhammapada, or Tao Te Ching) — translated into 100% SECULAR, modern, everyday human psychology.

Secular Epic Wisdom Rules (CRITICAL):
- Category: ${params.category}
- Visual Atmosphere: ${params.visualStyle}
- Production Mode: ${params.productionMode === 'multi_scene' ? 'Multi-Scene Storytelling (4 connected beats)' : 'Single Image Wisdom (1 sharp life lesson)'}
- MUST give clear, practical life advice AND explain *why* it is true (cause-and-effect in the second clause, e.g., "Do/avoid X; because Y" or "When you X, Y quietly happens").
- MUST carry a deeper second-layer truth that makes viewers pause, rewatch, and save/share.
- STRICTLY SECULAR LANGUAGE: NEVER mention God, religion, scriptures, Ramayana, Mahabharata, Gita, Buddha, Krishna, Rama, karma, dharma, soul, universe, prayer, sin, temple, or spiritual buzzwords. Anyone from any background must feel it as pure, grounded life insight.
- Quote length: 12 to 21 words. Short enough to read in 3–4 seconds on a phone screen. Zero emojis, zero hashtags inside the quote.
- BANNED clichés: Never use "work hard in silence", "never give up", "believe in yourself", "grind while they sleep", or generic hustle slogans.
- Examples of cadence & hidden-meaning structure (do NOT copy, create an original insight):
  * "Never explain yourself in anger; a calm mind sees the exit that rage tries to burn down."
  * "When you silence everyone who corrects you, your own pride finishes the job your enemies started."
  * "Every choice trades tomorrow for today; easy comfort steals your future while hard honesty quietly builds it."`
    : `You are an elite dark-cinema monologue writer whose short-form lines stop viewers mid-scroll and give genuine goosebumps.
Craft ONE unforgettable, emotionally piercing YouTube Short concept.

Tone & Craft Rules for Goosebumps-Inducing Writing:
- Category: ${params.category}
- Visual Atmosphere: ${params.visualStyle}
- Production Mode: ${params.productionMode === 'multi_scene' ? 'Multi-Scene Storytelling (4 connected beats)' : 'Single Image Motivation (1 razor-sharp aphorism)'}
- Write with stark psychological truth, visceral imagery, and an unexpected second-half turn that lands like a punch in the chest.
- Contrast quiet inner endurance against a loud, distracted world. Make the viewer feel seen in their darkest hour.
- BANNED clichés: Never use "work hard in silence", "never give up", "believe in yourself", "grind while they sleep", "sky is the limit", or generic hustle slogans.
- Quote length: 12 to 24 words. Zero emojis, zero hashtags inside the quote. Every single word must earn its place.
- Examples of cadence & weight (do NOT copy, match this emotional voltage):
  * "The heaviest chains are never iron; they are the versions of yourself you refused to outgrow."
  * "One day the noise stops, the crowd leaves, and all you have left is who you built when nobody watched."`;

  return `${voiceSection}
- Title: Magnetic, curiosity-driven YouTube Shorts title (4–8 words, e.g. "Why Silence Beats Anger Every Time").
- Topic: Concise 2–5 word core life lesson.
- Description: 2 grounded, insightful sentences explaining the hidden truth behind the quote for the YouTube Shorts caption.
- Hashtags: 5 lowercase tags without '#' (e.g. ["shorts","lifeadvice","wisdom","mindset","psychology"]).
- VisualQuery: 3–5 descriptive photography keywords matching "${params.visualStyle}" for dark high-contrast vertical framing.
- Scenes: Exactly ${sceneCount} scene(s). For multi_scene, each scene's overlayText is 4–9 words building a 4-beat realization. For single_image, 1 scene whose overlayText equals the quote.
${params.retryHint ? `\nIMPORTANT RETRY INSTRUCTION: ${params.retryHint}` : ''}
${avoidList ? `\nDO NOT repeat or paraphrase any of these existing quotes:\n${avoidList}` : ''}

Return strictly valid JSON:
{
  "topic": string,
  "title": string,
  "quote": string,
  "description": string,
  "hashtags": string[],
  "visualQuery": string,
  "scenes": [{ "visualPrompt": string, "overlayText": string, "motion": "slow_zoom_in" | "slow_zoom_out" | "ken_burns_drift" | "horizontal_pan" | "vertical_pan" }]
}`;
}

async function callOpenAICompatible(
  url: string,
  apiKey: string,
  model: string,
  prompt: string,
  extraHeaders: Record<string, string> = {}
): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You output strictly valid JSON matching the requested schema without markdown fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.95,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response content');
  return JSON.parse(stripCodeFences(content));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGeminiTextWithRetry(
  prompt: string,
  onAttemptLog?: (msg: string, level?: 'info' | 'warn') => void
): Promise<{ parsed: any; modelUsed: string }> {
  const ai = getGeminiClient();
  if (!ai) throw new Error('GEMINI_API_KEY is not configured');

  const models = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastErr: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                title: { type: Type.STRING },
                quote: { type: Type.STRING },
                description: { type: Type.STRING },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                visualQuery: { type: Type.STRING },
                scenes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      visualPrompt: { type: Type.STRING },
                      overlayText: { type: Type.STRING },
                      motion: { type: Type.STRING },
                    },
                    required: ['visualPrompt', 'overlayText', 'motion'],
                  },
                },
              },
              required: ['topic', 'title', 'quote', 'description', 'hashtags', 'visualQuery', 'scenes'],
            },
          },
        });

        const text = (response.text ?? '').trim();
        if (!text) throw new Error('Gemini returned empty response');
        return { parsed: JSON.parse(stripCodeFences(text)), modelUsed: model };
      } catch (err: any) {
        lastErr = err;
        const msg = err?.message || String(err);
        const isTransient = /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(msg);
        if (isTransient && attempt < 3) {
          const delayMs = attempt * 1400;
          onAttemptLog?.(`Gemini (${model}) transient spike (${attempt}/3); retrying in ${delayMs}ms...`, 'warn');
          await sleep(delayMs);
          continue;
        }
        break;
      }
    }
  }

  throw lastErr || new Error('Gemini generation failed');
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export async function generateShortConcept(params: {
  engine: AiEngine;
  category: string;
  visualStyle: string;
  productionMode: ProductionMode;
  quoteTone?: QuoteTone;
  avoidQuotes: string[];
  retryHint?: string;
  onAttemptLog?: (msg: string, level?: 'info' | 'warn') => void;
}): Promise<GeneratedShortConcept> {
  const prompt = buildPrompt(params);

  const order: Array<Exclude<AiEngine, 'auto'>> =
    params.engine === 'auto'
      ? ['groq', 'openrouter', 'deepseek', 'gemini']
      : [params.engine];

  const errors: string[] = [];

  for (const provider of order) {
    try {
      let raw: any;
      let engineLabel: string = provider;

      if (provider === 'groq') {
        const key = process.env.GROQ_API_KEY;
        if (!isRealKey(key)) throw new Error('GROQ_API_KEY not configured');
        raw = await callOpenAICompatible(
          'https://api.groq.com/openai/v1/chat/completions',
          key!,
          'llama-3.3-70b-versatile',
          prompt
        );
      } else if (provider === 'openrouter') {
        const key = process.env.OPENROUTER_API_KEY;
        if (!isRealKey(key)) throw new Error('OPENROUTER_API_KEY not configured');
        const orModels = ['meta-llama/llama-3.3-70b-instruct:free', 'openrouter/free'];
        let orErr: any = null;
        for (const orModel of orModels) {
          try {
            raw = await callOpenAICompatible(
              'https://openrouter.ai/api/v1/chat/completions',
              key!,
              orModel,
              prompt,
              {
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': 'AI Shorts Studio',
              }
            );
            engineLabel = `openrouter (${orModel.split('/')[0]})`;
            orErr = null;
            break;
          } catch (e) {
            orErr = e;
          }
        }
        if (orErr) throw orErr;
      } else if (provider === 'deepseek') {
        const key = process.env.DEEPSEEK_API_KEY;
        if (!isRealKey(key)) throw new Error('DEEPSEEK_API_KEY not configured');
        raw = await callOpenAICompatible(
          'https://api.deepseek.com/chat/completions',
          key!,
          'deepseek-chat',
          prompt
        );
      } else {
        const res = await callGeminiTextWithRetry(prompt, params.onAttemptLog);
        raw = res.parsed;
        engineLabel = res.modelUsed;
      }

      const normalizedScenes =
        Array.isArray(raw.scenes) && raw.scenes.length > 0
          ? raw.scenes.map((s: any, idx: number) => ({
              visualPrompt: String(s.visualPrompt || raw.visualQuery || params.visualStyle),
              overlayText: String(s.overlayText || raw.quote),
              motion: MOTIONS.includes(s.motion) ? (s.motion as CameraMotion) : MOTIONS[idx % MOTIONS.length],
            }))
          : [
              {
                visualPrompt: String(raw.visualQuery || params.visualStyle),
                overlayText: String(raw.quote || ''),
                motion: 'slow_zoom_in' as CameraMotion,
              },
            ];

      const hashtags = Array.isArray(raw.hashtags)
        ? raw.hashtags.map((h: string) => String(h).replace(/^#/, '').trim()).filter(Boolean).slice(0, 8)
        : ['shorts', 'motivation', 'mindset', 'philosophy'];

      return {
        topic: String(raw.topic || params.category).trim(),
        title: String(raw.title || `${params.category} Reflection`).trim(),
        quote: String(raw.quote || '').trim(),
        description: String(raw.description || '').trim(),
        hashtags,
        visualQuery: String(raw.visualQuery || params.visualStyle).trim(),
        scenes: normalizedScenes,
        engineUsed: engineLabel,
      };
    } catch (err: any) {
      const reason = err?.message || String(err);
      errors.push(`${provider}: ${reason}`);
      params.onAttemptLog?.(`Provider ${provider} failed (${reason.slice(0, 120)}), failing over...`, 'warn');
    }
  }

  throw new Error(`All selected AI providers failed: ${errors.join(' | ')}`);
}

export async function recommendTrackWithAI(
  quoteOrMood: string,
  tracks: MusicTrackRecord[],
  engine: AiEngine
): Promise<{ trackId: string; reason: string }> {
  const trackSummary = tracks.map((t) => `${t.id}: "${t.title}" (${t.mood})`).join('\n');
  const prompt = `Pick the single best matching soundtrack ID for this dark cinematic Short quote/mood:
"${quoteOrMood}"

Available tracks:
${trackSummary}

Return JSON: { "trackId": string, "reason": string }`;

  const ai = getGeminiClient();
  if (ai && (engine === 'auto' || engine === 'gemini')) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              trackId: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ['trackId', 'reason'],
          },
        },
      });
      const parsed = JSON.parse(stripCodeFences(response.text ?? '{}'));
      if (tracks.some((t) => t.id === parsed.trackId)) {
        return { trackId: parsed.trackId, reason: parsed.reason || 'Matched atmosphere and pacing.' };
      }
    } catch {
      // fall through to deterministic mood scoring
    }
  }

  const lower = quoteOrMood.toLowerCase();
  let chosen = tracks[0];
  let reason = 'Dark ambient balance suited for contemplative Shorts.';
  if (/(wolf|night|lone|hunt|wild|dark|shadow|panther)/.test(lower)) {
    chosen = tracks.find((t) => t.id === 'synth-midnight-wolf') ?? chosen;
    reason = 'Deep sub-drone complements solitary wildlife & nocturnal visuals.';
  } else if (/(discipline|iron|habit|focus|work|build|strength|stoic|mind)/.test(lower)) {
    chosen = tracks.find((t) => t.id === 'synth-iron-discipline') ?? chosen;
    reason = 'Minimal piano cadence reinforces focus and deliberate discipline.';
  } else if (/(rain|city|ocean|storm|horizon|mystery|space)/.test(lower)) {
    chosen = tracks.find((t) => t.id === 'synth-shadow-horizon') ?? chosen;
    reason = 'Rain texture and sub-bass add atmospheric depth to moody environments.';
  } else if (/(life|lesson|soul|hope|rise|ascend|time|philosophy|peace)/.test(lower)) {
    chosen = tracks.find((t) => t.id === 'synth-silent-ascension') ?? chosen;
    reason = 'Emotional strings pad elevates philosophical storytelling.';
  }

  return { trackId: chosen.id, reason };
}

export async function testProviderConnection(providerId: Exclude<AiEngine, 'auto'> | 'pexels'): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = Date.now();
  try {
    if (providerId === 'gemini') {
      const ai = getGeminiClient();
      if (!ai) return { ok: false, latencyMs: 0, message: 'GEMINI_API_KEY not set in environment' };
      const r = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: 'Reply with single word: OK',
      });
      return {
        ok: Boolean(r.text),
        latencyMs: Date.now() - start,
        message: 'Connected to Gemini API',
      };
    }
    if (providerId === 'groq') {
      const key = process.env.GROQ_API_KEY;
      if (!isRealKey(key)) return { ok: false, latencyMs: 0, message: 'GROQ_API_KEY not set in .env' };
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      return {
        ok: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? 'Groq API reachable' : `HTTP ${res.status}`,
      };
    }
    if (providerId === 'openrouter') {
      const key = process.env.OPENROUTER_API_KEY;
      if (!isRealKey(key)) return { ok: false, latencyMs: 0, message: 'OPENROUTER_API_KEY not set in .env' };
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      return {
        ok: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? 'OpenRouter API reachable' : `HTTP ${res.status}`,
      };
    }
    if (providerId === 'deepseek') {
      const key = process.env.DEEPSEEK_API_KEY;
      if (!isRealKey(key)) return { ok: false, latencyMs: 0, message: 'DEEPSEEK_API_KEY not set in .env' };
      const res = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      return {
        ok: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? 'DeepSeek API reachable' : `HTTP ${res.status}`,
      };
    }
    if (providerId === 'pexels') {
      const key = process.env.PEXELS_API_KEY;
      if (!isRealKey(key)) return { ok: false, latencyMs: 0, message: 'PEXELS_API_KEY not set (Openverse/Wikimedia fallback active)' };
      const res = await fetch('https://api.pexels.com/v1/search?query=dark+mountain&per_page=1', {
        headers: { Authorization: key! },
      });
      return {
        ok: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? 'Pexels API reachable' : `HTTP ${res.status}`,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: err?.message || 'Connection failed',
    };
  }
  return { ok: false, latencyMs: 0, message: 'Unknown provider' };
}
