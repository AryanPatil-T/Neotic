import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type {
  CameraMotion,
  GradientsConfig,
  LogoConfig,
  QuoteStyleConfig,
  SceneItem,
  VideoRecord,
} from '../src/shared/types.ts';
import {
  MUSIC_DIR,
  THUMBS_DIR,
  VIDEOS_DIR,
  getAllMusicTracks,
} from './db.ts';
import { resolveLocalMediaPath } from './mediaAcquisition.ts';

// Serialize concurrent renders on the same video ID to prevent temp-dir collisions
const renderQueues = new Map<string, Promise<any>>();

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapTextLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxCharsPerLine) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function mapFontFamily(fontFamily: QuoteStyleConfig['fontFamily']): string {
  switch (fontFamily) {
    case 'Playfair Display':
    case 'Cormorant Garamond':
    case 'Cinzel':
      return '"DejaVu Serif", Georgia, serif';
    case 'Inter':
    default:
      return '"DejaVu Sans", Arial, sans-serif';
  }
}

function isExistingFile(p: string | null | undefined): p is string {
  if (!p) return false;
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function buildLogoDataUri(logoConfig: LogoConfig): { dataUri: string; mime: string } | null {
  if (!logoConfig.imageUrl) return null;
  if (logoConfig.imageUrl.startsWith('data:image/')) {
    const match = logoConfig.imageUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    return { dataUri: logoConfig.imageUrl, mime: match?.[1] || 'image/png' };
  }
  const diskPath = resolveLocalMediaPath(logoConfig.imageUrl);
  if (!isExistingFile(diskPath)) return null;
  const ext = path.extname(diskPath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const b64 = fs.readFileSync(diskPath).toString('base64');
  return { dataUri: `data:${mime};base64,${b64}`, mime };
}

export async function renderOverlayPng(params: {
  width: number;
  height: number;
  quoteText: string;
  gradients: GradientsConfig;
  quoteStyle: QuoteStyleConfig;
  logo: LogoConfig;
  outPath: string;
}): Promise<void> {
  const { width, height, quoteText, gradients, quoteStyle, logo, outPath } = params;
  const scale = width / 1080;

  const defs: string[] = [];
  const layers: string[] = [];

  // 1. 4-Sided Gradients
  const addEdge = (
    side: 'top' | 'bottom' | 'left' | 'right',
    cfg: GradientsConfig['top']
  ) => {
    if (!cfg.enabled || cfg.opacity <= 0) return;
    const id = `grad_${side}`;
    const featherStop = Math.max(5, Math.min(95, 100 - cfg.featherPct * 0.7));
    let x1 = '0%', y1 = '0%', x2 = '0%', y2 = '0%';
    let rx = 0, ry = 0, rw = width, rh = height;

    if (side === 'top') {
      y2 = '100%';
      rh = Math.round((cfg.widthPct / 100) * height);
    } else if (side === 'bottom') {
      y1 = '100%';
      y2 = '0%';
      rh = Math.round((cfg.widthPct / 100) * height);
      ry = height - rh;
    } else if (side === 'left') {
      x2 = '100%';
      rw = Math.round((cfg.widthPct / 100) * width);
    } else {
      x1 = '100%';
      x2 = '0%';
      rw = Math.round((cfg.widthPct / 100) * width);
      rx = width - rw;
    }

    defs.push(`
      <linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
        <stop offset="0%" stop-color="${escapeXml(cfg.color)}" stop-opacity="${cfg.opacity}" />
        <stop offset="${featherStop}%" stop-color="${escapeXml(cfg.color)}" stop-opacity="${(cfg.opacity * 0.35).toFixed(3)}" />
        <stop offset="100%" stop-color="${escapeXml(cfg.color)}" stop-opacity="0" />
      </linearGradient>
    `);
    layers.push(`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="url(#${id})" />`);
  };

  addEdge('top', gradients.top);
  addEdge('bottom', gradients.bottom);
  addEdge('left', gradients.left);
  addEdge('right', gradients.right);

  // 2. Logo / Watermark
  const logoInfo = buildLogoDataUri(logo);
  if (logoInfo) {
    const logoSize = Math.round((logo.sizePct / 100) * width);
    const cx = Math.round((logo.xPct / 100) * width);
    const cy = Math.round((logo.yPct / 100) * height);
    const lx = cx - logoSize / 2;
    const ly = cy - logoSize / 2;
    const r = logoSize / 2;

    if (logo.shadowEnabled && logo.shadowIntensity > 0) {
      const blur = Math.max(1, Math.round(logo.shadowIntensity * scale * 0.5));
      defs.push(`
        <filter id="logoShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="${Math.round(4 * scale)}" stdDeviation="${blur}" flood-color="#000000" flood-opacity="0.75" />
        </filter>
      `);
    }

    if (logo.circularCrop) {
      defs.push(`
        <clipPath id="logoClip">
          <circle cx="${cx}" cy="${cy}" r="${r}" />
        </clipPath>
      `);
    }

    const zoom = Math.max(1, logo.cropZoom || 1);
    const imgSize = logoSize * zoom;
    const offX = ((logo.cropOffsetX || 0) / 100) * logoSize;
    const offY = ((logo.cropOffsetY || 0) / 100) * logoSize;
    const imgX = cx - imgSize / 2 + offX;
    const imgY = cy - imgSize / 2 + offY;

    const filterAttr = logo.shadowEnabled ? `filter="url(#logoShadow)"` : '';
    const clipAttr = logo.circularCrop ? `clip-path="url(#logoClip)"` : '';

    layers.push(`<g opacity="${logo.opacity}" ${filterAttr}>`);
    layers.push(
      `<image href="${logoInfo.dataUri}" x="${imgX}" y="${imgY}" width="${imgSize}" height="${imgSize}" preserveAspectRatio="xMidYMid slice" ${clipAttr} />`
    );
    if (logo.borderThickness > 0) {
      const bw = logo.borderThickness * scale;
      if (logo.circularCrop) {
        layers.push(
          `<circle cx="${cx}" cy="${cy}" r="${Math.max(1, r - bw / 2)}" fill="none" stroke="${escapeXml(
            logo.borderColor
          )}" stroke-width="${bw}" />`
        );
      } else {
        layers.push(
          `<rect x="${lx}" y="${ly}" width="${logoSize}" height="${logoSize}" fill="none" stroke="${escapeXml(
            logo.borderColor
          )}" stroke-width="${bw}" />`
        );
      }
    }
    layers.push(`</g>`);
  }

  // 3. Dedicated Quote Backdrop Scrim + Quote Typography
  if (quoteText.trim()) {
    const fontSizePx = Math.round(quoteStyle.fontSize * scale);
    const maxWidthPx = (quoteStyle.maxWidthPct / 100) * width;
    const avgCharWidth = fontSizePx * 0.54 + quoteStyle.letterSpacing * scale;
    const maxChars = Math.max(10, Math.floor(maxWidthPx / Math.max(8, avgCharWidth)));
    const lines = wrapTextLines(quoteText, maxChars);

    const lineHeightPx = fontSizePx * quoteStyle.lineHeight;
    const totalTextHeight = lines.length * lineHeightPx;
    const centerY = (quoteStyle.yPct / 100) * height;
    const centerX = (quoteStyle.xPct / 100) * width;

    // Render dedicated legibility backdrop gradient behind the quote
    if (quoteStyle.backdropEnabled !== false) {
      const bColor = escapeXml(quoteStyle.backdropColor || '#050509');
      const bOpacity = Math.max(0, Math.min(1, quoteStyle.backdropOpacity ?? 0.78));
      const padPx = ((quoteStyle.backdropPaddingPct ?? 14) / 100) * height;
      const bandH = totalTextHeight + padPx * 2;
      const bandY = Math.max(0, centerY - bandH / 2);

      if (quoteStyle.backdropStyle === 'radial_glow') {
        defs.push(`
          <radialGradient id="quoteRadialScrim" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${bColor}" stop-opacity="${bOpacity}" />
            <stop offset="60%" stop-color="${bColor}" stop-opacity="${(bOpacity * 0.72).toFixed(3)}" />
            <stop offset="100%" stop-color="${bColor}" stop-opacity="0" />
          </radialGradient>
        `);
        const radW = Math.min(width, maxWidthPx * 1.28);
        const radX = Math.max(0, centerX - radW / 2);
        layers.push(
          `<ellipse cx="${radX + radW / 2}" cy="${centerY}" rx="${radW / 2}" ry="${bandH / 2}" fill="url(#quoteRadialScrim)" />`
        );
      } else if (quoteStyle.backdropStyle === 'solid_soft') {
        const boxW = Math.min(width - 48 * scale, maxWidthPx + 64 * scale);
        const boxH = totalTextHeight + padPx * 0.9;
        const boxX = Math.max(24 * scale, centerX - boxW / 2);
        const boxY = Math.max(0, centerY - boxH / 2);
        layers.push(
          `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="${Math.round(
            24 * scale
          )}" fill="${bColor}" fill-opacity="${(bOpacity * 0.85).toFixed(3)}" />`
        );
      } else {
        // Default: full-width soft feathered cinematic band
        defs.push(`
          <linearGradient id="quoteBandScrim" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${bColor}" stop-opacity="0" />
            <stop offset="28%" stop-color="${bColor}" stop-opacity="${(bOpacity * 0.85).toFixed(3)}" />
            <stop offset="50%" stop-color="${bColor}" stop-opacity="${bOpacity}" />
            <stop offset="72%" stop-color="${bColor}" stop-opacity="${(bOpacity * 0.85).toFixed(3)}" />
            <stop offset="100%" stop-color="${bColor}" stop-opacity="0" />
          </linearGradient>
        `);
        layers.push(
          `<rect x="0" y="${bandY}" width="${width}" height="${bandH}" fill="url(#quoteBandScrim)" />`
        );
      }
    }

    const anchorX =
      quoteStyle.align === 'left'
        ? ((quoteStyle.xPct - quoteStyle.maxWidthPct / 2) / 100) * width
        : quoteStyle.align === 'right'
        ? ((quoteStyle.xPct + quoteStyle.maxWidthPct / 2) / 100) * width
        : centerX;

    const textAnchor =
      quoteStyle.align === 'left' ? 'start' : quoteStyle.align === 'right' ? 'end' : 'middle';

    const startY = centerY - totalTextHeight / 2 + fontSizePx * 0.82;

    if (quoteStyle.shadowEnabled && quoteStyle.shadowBlur > 0) {
      const blur = Math.max(1, Math.round(quoteStyle.shadowBlur * scale * 0.45));
      defs.push(`
        <filter id="textShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="${Math.round(4 * scale)}" stdDeviation="${blur}" flood-color="#000000" flood-opacity="0.98" />
        </filter>
      `);
    }

    const filterAttr = quoteStyle.shadowEnabled ? `filter="url(#textShadow)"` : '';
    const fontFamilyCss = mapFontFamily(quoteStyle.fontFamily);
    const letterSpacingPx = quoteStyle.letterSpacing * scale;

    layers.push(
      `<text x="${anchorX}" text-anchor="${textAnchor}" fill="${escapeXml(
        quoteStyle.color
      )}" font-family='${fontFamilyCss}' font-size="${fontSizePx}" font-weight="${
        quoteStyle.fontWeight
      }" letter-spacing="${letterSpacingPx}" ${filterAttr}>`
    );

    lines.forEach((line, idx) => {
      const y = startY + idx * lineHeightPx;
      layers.push(`<tspan x="${anchorX}" y="${y}">${escapeXml(line)}</tspan>`);
    });
    layers.push(`</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>${defs.join('\n')}</defs>
    ${layers.join('\n')}
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(outPath);
}

function getZoompanExpr(
  motion: CameraMotion,
  frames: number,
  width: number,
  height: number,
  fps = 30
): string {
  switch (motion) {
    case 'slow_zoom_out':
      return `zoompan=z='max(1.0,1.16-0.16*on/${frames})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case 'ken_burns_drift':
      return `zoompan=z='min(1.16,1.0+0.16*on/${frames})':x='(iw-iw/zoom)*(0.25+0.5*on/${frames})':y='(ih-ih/zoom)*(0.35+0.3*on/${frames})':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case 'horizontal_pan':
      return `zoompan=z='1.12':x='(iw-iw/zoom)*on/${frames}':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case 'vertical_pan':
      return `zoompan=z='1.12':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*on/${frames}':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case 'slow_zoom_in':
    default:
      return `zoompan=z='min(1.16,1.0+0.16*on/${frames})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function performRender(video: VideoRecord): Promise<{
  mp4Url: string;
  thumbnailUrl: string;
  fileSizeBytes: number;
}> {
  const [wStr, hStr] = video.resolution.split('x');
  const width = parseInt(wStr, 10) || 1080;
  const height = parseInt(hStr, 10) || 1920;

  // Unique temp directory per invocation avoids concurrent collision ENOENT
  const tmpDir = path.join(
    VIDEOS_DIR,
    `_tmp_${video.id}_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });

  const outMp4File = `${video.id}.mp4`;
  const outMp4Path = path.join(VIDEOS_DIR, outMp4File);
  const outThumbFile = `${video.id}.jpg`;
  const outThumbPath = path.join(THUMBS_DIR, outThumbFile);

  try {
    const scenes: SceneItem[] =
      video.scenes.length > 0
        ? video.scenes
        : [
            {
              sceneIndex: 0,
              visualPrompt: video.visualStyle,
              overlayText: video.quote,
              durationSec: video.durationSec,
              motion: 'slow_zoom_in',
              imageUrl: video.backgroundImageUrl,
            },
          ];

    const tracks = getAllMusicTracks();
    const track = tracks.find((t) => t.id === video.musicTrackId) ?? tracks[0];
    let audioPath: string | null = null;
    if (track) {
      if (track.fileUrl.startsWith('/media/music/')) {
        audioPath = path.join(MUSIC_DIR, path.basename(track.fileUrl));
      } else {
        audioPath = resolveLocalMediaPath(track.fileUrl);
      }
      if (!isExistingFile(audioPath)) audioPath = null;
    }

    const totalDuration = Math.max(5, Math.min(30, video.durationSec || 30));
    const perSceneSec = totalDuration / scenes.length;
    const segmentFiles: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const bgDisk =
        resolveLocalMediaPath(sc.imageUrl || video.backgroundImageUrl) ??
        resolveLocalMediaPath(video.backgroundImageUrl);

      if (!isExistingFile(bgDisk)) {
        throw new Error(`Missing background image on disk for scene ${i + 1}`);
      }

      const preppedBg = path.join(tmpDir, `bg_${i}.jpg`);
      await sharp(bgDisk)
        .resize(Math.round(width * 1.2), Math.round(height * 1.2), { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 92 })
        .toFile(preppedBg);

      const overlayPng = path.join(tmpDir, `overlay_${i}.png`);
      await renderOverlayPng({
        width,
        height,
        quoteText: sc.overlayText || video.quote,
        gradients: video.gradientsConfig,
        quoteStyle: video.quoteStyleConfig,
        logo: video.logoConfig,
        outPath: overlayPng,
      });

      if (i === 0) {
        await sharp(bgDisk)
          .resize(width, height, { fit: 'cover', position: 'centre' })
          .composite([{ input: overlayPng, top: 0, left: 0 }])
          .jpeg({ quality: 88 })
          .toFile(outThumbPath);
      }

      const isLowResource = process.env.LOW_MEMORY === 'true' || process.env.RENDER === 'true';
      const fps = isLowResource ? 24 : 30;
      const frames = Math.max(24, Math.round(perSceneSec * fps));
      const zp = getZoompanExpr(sc.motion || 'slow_zoom_in', frames, width, height, fps);
      const segOut = path.join(tmpDir, `seg_${i}.mp4`);

      const lowMemThreads = isLowResource ? ['-threads', '2'] : [];
      const x264Preset = isLowResource ? 'ultrafast' : 'veryfast';
      const x264Crf = isLowResource ? '24' : '22';

      await runFfmpeg([
        '-y',
        '-loop',
        '1',
        '-i',
        preppedBg,
        '-i',
        overlayPng,
        '-filter_complex',
        `[0:v]${zp},setsar=1[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]`,
        '-map',
        '[v]',
        '-t',
        perSceneSec.toFixed(2),
        '-c:v',
        'libx264',
        '-preset',
        x264Preset,
        '-crf',
        x264Crf,
        '-pix_fmt',
        'yuv420p',
        ...lowMemThreads,
        segOut,
      ]);

      segmentFiles.push(segOut);
    }

    const videoOnlyPath = path.join(tmpDir, 'combined_video.mp4');
    if (segmentFiles.length === 1) {
      fs.copyFileSync(segmentFiles[0], videoOnlyPath);
    } else {
      const concatListPath = path.join(tmpDir, 'concat.txt');
      fs.writeFileSync(
        concatListPath,
        segmentFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
      );
      await runFfmpeg([
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatListPath,
        '-c',
        'copy',
        videoOnlyPath,
      ]);
    }

    if (audioPath) {
      const vol = Math.max(0.1, Math.min(1.25, ((video.musicVolume ?? 75) / 100) * 1.1));
      const fadeOutStart = Math.max(0, totalDuration - 1.5);
      await runFfmpeg([
        '-y',
        '-i',
        videoOnlyPath,
        '-stream_loop',
        '-1',
        '-i',
        audioPath,
        '-filter_complex',
        `[1:a]volume=${vol.toFixed(2)},afade=t=out:st=${fadeOutStart.toFixed(2)}:d=1.5[a]`,
        '-map',
        '0:v',
        '-map',
        '[a]',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-ac',
        '2',
        '-ar',
        '44100',
        '-b:a',
        '192k',
        '-shortest',
        '-movflags',
        '+faststart',
        outMp4Path,
      ]);
    } else {
      await runFfmpeg([
        '-y',
        '-i',
        videoOnlyPath,
        '-c:v',
        'copy',
        '-movflags',
        '+faststart',
        outMp4Path,
      ]);
    }

    const stats = fs.statSync(outMp4Path);
    return {
      mp4Url: `/media/videos/${outMp4File}?v=${Date.now()}`,
      thumbnailUrl: `/media/thumbs/${outThumbFile}?v=${Date.now()}`,
      fileSizeBytes: stats.size,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function renderShortVideoMp4(video: VideoRecord): Promise<{
  mp4Url: string;
  thumbnailUrl: string;
  fileSizeBytes: number;
}> {
  const prev = renderQueues.get(video.id) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => performRender(video));
  renderQueues.set(video.id, next);
  try {
    return await next;
  } finally {
    if (renderQueues.get(video.id) === next) {
      renderQueues.delete(video.id);
    }
  }
}
