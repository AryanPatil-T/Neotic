import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { MUSIC_DIR, db } from './db.ts';
import type { MusicTrackRecord } from '../src/shared/types.ts';

export interface SynthTrackParams {
  filename: string;
  rootHz: number;
  scaleRatios: number[];
  progressionSemitones: number[];
  bpm: number;
  rainLevel: number;
  bellIntensity: number;
  padWarmth: number;
}

const BUILTIN_PRESETS: Record<string, SynthTrackParams> = {
  obsidian_pulse: {
    filename: 'obsidian_pulse.wav',
    rootHz: 110.0, // A2 minor
    scaleRatios: [1, 1.1892, 1.3348, 1.4983, 1.7818, 2.0, 2.3784],
    progressionSemitones: [0, -4, -2, -5],
    bpm: 72,
    rainLevel: 0.06,
    bellIntensity: 0.42,
    padWarmth: 0.68,
  },
  midnight_wolf: {
    filename: 'midnight_wolf.wav',
    rootHz: 98.0, // G2 minor
    scaleRatios: [1, 1.1225, 1.1892, 1.4983, 1.5874, 2.0, 2.3784],
    progressionSemitones: [0, -2, -4, -5],
    bpm: 64,
    rainLevel: 0.08,
    bellIntensity: 0.35,
    padWarmth: 0.74,
  },
  iron_discipline: {
    filename: 'iron_discipline.wav',
    rootHz: 130.81, // C3
    scaleRatios: [1, 1.1892, 1.3348, 1.4983, 1.7818, 2.0, 2.6697],
    progressionSemitones: [0, -5, -4, -2],
    bpm: 84,
    rainLevel: 0.02,
    bellIntensity: 0.58,
    padWarmth: 0.55,
  },
  shadow_horizon: {
    filename: 'shadow_horizon.wav',
    rootHz: 82.41, // E2
    scaleRatios: [1, 1.1892, 1.3348, 1.4983, 1.5874, 2.0, 2.3784],
    progressionSemitones: [0, -4, -5, -7],
    bpm: 60,
    rainLevel: 0.14,
    bellIntensity: 0.38,
    padWarmth: 0.72,
  },
  silent_ascension: {
    filename: 'silent_ascension.wav',
    rootHz: 146.83, // D3
    scaleRatios: [1, 1.1225, 1.1892, 1.4983, 1.7818, 2.0, 2.2449],
    progressionSemitones: [0, -3, -5, -2],
    bpm: 68,
    rainLevel: 0.03,
    bellIntensity: 0.48,
    padWarmth: 0.8,
  },
};

export function synthesizeCinematicWavToFile(outPath: string, spec: SynthTrackParams, durationSec = 30) {
  const sampleRate = 44100;
  const channels = 2;
  const numFrames = sampleRate * durationSec;

  const left = new Float32Array(numFrames);
  const right = new Float32Array(numFrames);

  const beatSec = 60 / Math.max(40, spec.bpm);
  const barSec = beatSec * 4;
  const noteInterval = beatSec / 2; // 8th-note felt piano / cinematic bell motif

  // Precompute felt-piano / bell hits across the 30s timeline
  const pattern = [0, 2, 3, 5, 4, 2, 1, 3];
  const events: Array<{ startFrame: number; freq: number; amp: number; pan: number }> = [];
  let stepIdx = 0;

  for (let t = 0.25; t < durationSec - 1.5; t += noteInterval) {
    // Leave subtle breathing space on beat 7 of every bar
    if (stepIdx % 8 !== 6) {
      const barIdx = Math.floor(t / barSec) % spec.progressionSemitones.length;
      const semitoneShift = spec.progressionSemitones[barIdx];
      const chordMul = Math.pow(2, semitoneShift / 12);
      const degree = pattern[stepIdx % pattern.length];
      const ratio = spec.scaleRatios[degree % spec.scaleRatios.length];
      const freq = spec.rootHz * 2 * chordMul * ratio; // Put melody clearly in 180-750Hz range
      events.push({
        startFrame: Math.floor(t * sampleRate),
        freq,
        amp: stepIdx % 4 === 0 ? 0.34 : 0.22,
        pan: stepIdx % 2 === 0 ? -0.28 : 0.28,
      });
    }
    stepIdx++;
  }

  let seed = 424242;
  let lpNoiseL = 0;
  let lpNoiseR = 0;

  // Render pads + bass + texture
  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    const fadeIn = Math.min(1, t / 1.4);
    const fadeOut = Math.min(1, (durationSec - t) / 1.8);
    const masterEnv = fadeIn * fadeOut;

    const barIdx = Math.floor(t / barSec) % spec.progressionSemitones.length;
    const semitoneShift = spec.progressionSemitones[barIdx];
    const chordMul = Math.pow(2, semitoneShift / 12);
    const bassFreq = (spec.rootHz / 2) * chordMul;
    const padFreq1 = spec.rootHz * chordMul;
    const padFreq2 = padFreq1 * spec.scaleRatios[1]; // minor third
    const padFreq3 = padFreq1 * spec.scaleRatios[3]; // fifth
    const padFreq4 = padFreq1 * 2; // octave shimmer

    const swell = 0.68 + 0.32 * Math.sin(2 * Math.PI * (1 / barSec) * t - Math.PI / 2);

    // Warm sub + upper bass harmonic so phone/laptop speakers hear it clearly
    const bass =
      Math.sin(2 * Math.PI * bassFreq * t) * 0.42 +
      Math.sin(2 * Math.PI * bassFreq * 2 * t) * 0.24;

    // Detuned stereo pads
    const padL =
      (Math.sin(2 * Math.PI * padFreq1 * 0.997 * t) * 0.3 +
        Math.sin(2 * Math.PI * padFreq2 * 1.002 * t) * 0.24 +
        Math.sin(2 * Math.PI * padFreq3 * 0.998 * t) * 0.22 +
        Math.sin(2 * Math.PI * padFreq4 * 1.003 * t) * 0.14) *
      spec.padWarmth *
      swell;

    const padR =
      (Math.sin(2 * Math.PI * padFreq1 * 1.003 * t) * 0.3 +
        Math.sin(2 * Math.PI * padFreq2 * 0.998 * t) * 0.24 +
        Math.sin(2 * Math.PI * padFreq3 * 1.002 * t) * 0.22 +
        Math.sin(2 * Math.PI * padFreq4 * 0.997 * t) * 0.14) *
      spec.padWarmth *
      swell;

    // Soft atmospheric rain / room noise
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const wL = (seed / 0xffffffff) * 2 - 1;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const wR = (seed / 0xffffffff) * 2 - 1;
    lpNoiseL = lpNoiseL * 0.94 + wL * 0.06;
    lpNoiseR = lpNoiseR * 0.94 + wR * 0.06;

    left[i] = (bass + padL + lpNoiseL * spec.rainLevel) * masterEnv;
    right[i] = (bass + padR + lpNoiseR * spec.rainLevel) * masterEnv;
  }

  // Mix in felt-piano / cinematic bell arpeggio notes with natural exponential decay
  const noteFrames = Math.floor(sampleRate * 2.2);
  for (const ev of events) {
    const end = Math.min(numFrames, ev.startFrame + noteFrames);
    const gainL = ev.amp * spec.bellIntensity * (0.5 - ev.pan * 0.4);
    const gainR = ev.amp * spec.bellIntensity * (0.5 + ev.pan * 0.4);
    for (let f = ev.startFrame; f < end; f++) {
      const dt = (f - ev.startFrame) / sampleRate;
      const attack = Math.min(1, dt / 0.015);
      const decay = Math.exp(-dt * 2.1);
      const tone =
        (Math.sin(2 * Math.PI * ev.freq * dt) * 0.72 +
          Math.sin(2 * Math.PI * ev.freq * 2 * dt) * 0.2 +
          Math.sin(2 * Math.PI * ev.freq * 3 * dt) * 0.08) *
        attack *
        decay;
      left[f] += tone * gainL;
      right[f] += tone * gainR;
    }
  }

  // Peak normalize cleanly to -1.5 dB (~0.84) so every track is loud and distortion-free
  let peak = 0.001;
  for (let i = 0; i < numFrames; i++) {
    const aL = Math.abs(left[i]);
    const aR = Math.abs(right[i]);
    if (aL > peak) peak = aL;
    if (aR > peak) peak = aR;
  }
  const norm = 0.84 / peak;

  const dataBytes = numFrames * channels * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const sL = Math.max(-0.98, Math.min(0.98, left[i] * norm));
    const sR = Math.max(-0.98, Math.min(0.98, right[i] * norm));
    buffer.writeInt16LE(Math.round(sL * 32767), offset);
    buffer.writeInt16LE(Math.round(sR * 32767), offset + 2);
    offset += 4;
  }

  fs.writeFileSync(outPath, buffer);
}

export function ensureBuiltInSynthWavs() {
  for (const spec of Object.values(BUILTIN_PRESETS)) {
    const outPath = path.join(MUSIC_DIR, spec.filename);
    // Upgrade legacy small mono files (< 3MB) to rich 44.1kHz stereo (~5.29MB)
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 3_500_000) {
      continue;
    }
    synthesizeCinematicWavToFile(outPath, spec, 30);
  }
}

export function generateCustomSynthTrack(params: {
  title: string;
  mood: string;
  bpm?: number;
  rootHz?: number;
  rainLevel?: number;
  bellIntensity?: number;
}): MusicTrackRecord {
  const id = `synth_custom_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const filename = `${id}.wav`;
  const outPath = path.join(MUSIC_DIR, filename);

  const moodLower = params.mood.toLowerCase();
  const rootHz =
    params.rootHz ??
    (moodLower.includes('epic') || moodLower.includes('intense')
      ? 130.81
      : moodLower.includes('dark') || moodLower.includes('wolf')
      ? 98.0
      : moodLower.includes('rain') || moodLower.includes('noir')
      ? 87.31
      : 110.0);

  const bpm = Math.max(48, Math.min(115, Number(params.bpm) || 70));
  const rainLevel = Math.max(0, Math.min(0.25, params.rainLevel ?? (moodLower.includes('rain') ? 0.14 : 0.05)));
  const bellIntensity = Math.max(0.1, Math.min(0.8, params.bellIntensity ?? 0.5));

  synthesizeCinematicWavToFile(
    outPath,
    {
      filename,
      rootHz,
      scaleRatios: [1, 1.1892, 1.3348, 1.4983, 1.7818, 2.0, 2.3784],
      progressionSemitones: [0, -4, -5, -2],
      bpm,
      rainLevel,
      bellIntensity,
      padWarmth: 0.72,
    },
    30
  );

  const track: MusicTrackRecord = {
    id,
    title: params.title.trim() || `Generated ${params.mood}`,
    mood: params.mood.trim() || 'Dark Cinematic',
    artist: 'AI Shorts Synth Engine',
    license: 'CC0 Royalty-Free (Generated)',
    durationSec: 30,
    sourceType: 'uploaded', // uses direct WAV playback URL
    fileUrl: `/media/music/${filename}`,
    synthPreset: 'custom',
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO music_tracks (id, title, mood, artist, license, duration_sec, source_type, file_url, synth_preset, created_at)
    VALUES (@id, @title, @mood, @artist, @license, @durationSec, @sourceType, @fileUrl, @synthPreset, @createdAt)
  `).run(track);

  return track;
}
