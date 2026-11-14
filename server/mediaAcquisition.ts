import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  type ImageSourceMode,
  STUDIO_SAMPLE_IMAGES,
  type VideoResolution,
} from '../src/shared/types.ts';
import { getGeminiClient } from './aiProviders.ts';
import {
  IMAGES_DIR,
  SAMPLES_DIR,
  UPLOADS_DIR,
  db,
  getUploadedAssets,
} from './db.ts';

function isUrlUsed(url: string): boolean {
  const row = db.prepare(`SELECT url FROM used_image_urls WHERE url = ?`).get(url);
  return Boolean(row);
}

function markUrlUsed(url: string, provider: string) {
  db.prepare(`INSERT OR IGNORE INTO used_image_urls (url, provider, used_at) VALUES (?, ?, ?)`).run(
    url,
    provider,
    new Date().toISOString()
  );
}

function getTargetDimensions(resolution: VideoResolution): { width: number; height: number } {
  return resolution === '720x1280' ? { width: 720, height: 1280 } : { width: 1080, height: 1920 };
}

async function processBufferTo916(
  inputBuffer: Buffer,
  outFileName: string,
  resolution: VideoResolution,
  bwMonochrome: boolean
): Promise<string> {
  const { width, height } = getTargetDimensions(resolution);
  const outPath = path.join(IMAGES_DIR, outFileName);

  let pipeline = sharp(inputBuffer).rotate().resize(width, height, {
    fit: 'cover',
    position: 'centre',
  });

  if (bwMonochrome) {
    pipeline = pipeline
      .grayscale()
      .linear(1.28, -28)
      .modulate({ brightness: 0.92 });
  } else {
    pipeline = pipeline.modulate({ saturation: 0.85, brightness: 0.9 });
  }

  await pipeline.jpeg({ quality: 92 }).toFile(outPath);
  return `/media/images/${outFileName}`;
}

async function fetchPexelsCandidate(query: string): Promise<{ url: string; provider: string } | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || key.trim().length < 8 || key.startsWith('MY_')) return null;

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=15`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const photos = Array.isArray(data?.photos) ? data.photos : [];
  for (const p of photos) {
    const srcUrl = p?.src?.large2x || p?.src?.portrait || p?.src?.original;
    if (srcUrl && !isUrlUsed(srcUrl)) {
      return { url: srcUrl, provider: 'pexels' };
    }
  }
  return null;
}

async function fetchOpenverseCandidate(query: string): Promise<{ url: string; provider: string } | null> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=20`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AI-Shorts-Studio/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const results = Array.isArray(data?.results) ? data.results : [];
  for (const item of results) {
    const imgUrl = item?.url;
    if (
      imgUrl &&
      typeof imgUrl === 'string' &&
      /\.(jpe?g|png|webp)(\?.*)?$/i.test(imgUrl) &&
      !isUrlUsed(imgUrl)
    ) {
      return { url: imgUrl, provider: 'openverse' };
    }
  }
  return null;
}

async function fetchWikimediaCandidate(query: string): Promise<{ url: string; provider: string } | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
    query
  )}&gsrlimit=15&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1200&format=json&origin=*`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AI-Shorts-Studio/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  for (const page of pages as any[]) {
    const info = page?.imageinfo?.[0];
    const imgUrl = info?.thumburl || info?.url;
    const mime = info?.mime || '';
    if (imgUrl && /^image\/(jpeg|png|webp)$/i.test(mime) && !isUrlUsed(imgUrl)) {
      return { url: imgUrl, provider: 'wikimedia' };
    }
  }
  return null;
}

async function generateWithGeminiImage(prompt: string): Promise<Buffer | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-image',
    contents: {
      parts: [
        {
          text: `${prompt}, dark moody cinematic photography, vertical 9:16 portrait composition, deep shadows, high contrast, editorial film grain`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: '9:16',
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  return null;
}

export function resolveLocalMediaPath(mediaUrl: string): string | null {
  if (!mediaUrl) return null;
  const cleanUrl = mediaUrl.split('?')[0].trim();
  if (!cleanUrl) return null;
  if (cleanUrl.startsWith('/media/images/')) {
    const base = path.basename(cleanUrl);
    return base && base !== 'images' ? path.join(IMAGES_DIR, base) : null;
  }
  if (cleanUrl.startsWith('/media/uploads/')) {
    const base = path.basename(cleanUrl);
    return base && base !== 'uploads' ? path.join(UPLOADS_DIR, base) : null;
  }
  if (cleanUrl.startsWith('/media/samples/')) {
    const base = path.basename(cleanUrl);
    return base && base !== 'samples' ? path.join(SAMPLES_DIR, base) : null;
  }
  if (cleanUrl.startsWith('/assets/')) {
    const rel = cleanUrl.replace(/^\/+/, '');
    const full = path.resolve(process.cwd(), 'public', rel);
    return fs.existsSync(full) && fs.statSync(full).isFile() ? full : null;
  }
  return null;
}

export async function acquireVerticalImage(params: {
  sourceMode: ImageSourceMode;
  visualPrompt: string;
  visualStyle: string;
  resolution: VideoResolution;
  bwMonochrome: boolean;
  indexSeed?: number;
  onLog?: (msg: string, level?: 'info' | 'warn') => void;
}): Promise<string> {
  const outFileName = `img_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.jpg`;

  // 1. User Uploaded Photos
  if (params.sourceMode === 'uploaded') {
    const uploaded = getUploadedAssets('photo');
    if (uploaded.length > 0) {
      const picked = uploaded[(params.indexSeed ?? 0) % uploaded.length];
      const diskPath = resolveLocalMediaPath(picked.fileUrl);
      if (diskPath && fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
        const buf = fs.readFileSync(diskPath);
        return processBufferTo916(buf, outFileName, params.resolution, params.bwMonochrome);
      }
    }
    params.onLog?.('No custom uploaded photos found; falling back to studio vertical library.', 'warn');
  }

  // 2. Gemini AI Image Generation
  if (params.sourceMode === 'gemini_ai') {
    try {
      const imgBuf = await generateWithGeminiImage(`${params.visualStyle}, ${params.visualPrompt}`);
      if (imgBuf) {
        return processBufferTo916(imgBuf, outFileName, params.resolution, params.bwMonochrome);
      }
    } catch (err: any) {
      params.onLog?.(
        `Gemini image generation unavailable (${err?.message || 'error'}); falling back to stock search.`,
        'warn'
      );
    }
  }

  // 3. Free Stock Web Photos (Pexels -> Openverse -> Wikimedia Commons)
  if (params.sourceMode === 'stock_web' || params.sourceMode === 'gemini_ai') {
    const queries = [
      `${params.visualPrompt} dark moody`,
      `${params.visualStyle} dark dramatic`,
      params.visualStyle,
    ];

    for (const q of queries) {
      try {
        const candidate =
          (await fetchPexelsCandidate(q)) ??
          (await fetchOpenverseCandidate(q)) ??
          (await fetchWikimediaCandidate(q));

        if (candidate) {
          const imgRes = await fetch(candidate.url, {
            headers: { 'User-Agent': 'AI-Shorts-Studio/1.0' },
            signal: AbortSignal.timeout(10000),
          });
          if (imgRes.ok) {
            const arr = await imgRes.arrayBuffer();
            const buf = Buffer.from(arr);
            if (buf.length > 8000) {
              markUrlUsed(candidate.url, candidate.provider);
              params.onLog?.(`Acquired stock photo via ${candidate.provider} for "${q}"`, 'info');
              return processBufferTo916(buf, outFileName, params.resolution, params.bwMonochrome);
            }
          }
        }
      } catch {
        // continue to next query or local studio sample
      }
    }
  }

  // 4. Local Studio Sample Fallback (always available offline)
  const matchingSample =
    STUDIO_SAMPLE_IMAGES.find((s) =>
      params.visualStyle.toLowerCase().includes(s.style.toLowerCase())
    ) ?? STUDIO_SAMPLE_IMAGES[(params.indexSeed ?? 0) % STUDIO_SAMPLE_IMAGES.length];

  const samplePath = resolveLocalMediaPath(matchingSample.fileUrl);
  if (samplePath && fs.existsSync(samplePath) && fs.statSync(samplePath).isFile()) {
    const buf = fs.readFileSync(samplePath);
    params.onLog?.(`Using local studio 9:16 artwork: ${matchingSample.name}`, 'info');
    return processBufferTo916(buf, outFileName, params.resolution, params.bwMonochrome);
  }

  throw new Error('Unable to acquire or load background image');
}
