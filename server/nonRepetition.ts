import { db, getAllUsedContent } from './db.ts';
import crypto from 'crypto';

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(norm: string): Set<string> {
  if (!norm) return new Set();
  return new Set(norm.split(' ').filter((w) => w.length > 1));
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(normalizeText(a));
  const setB = tokenize(normalizeText(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function getTrigrams(norm: string): Map<string, number> {
  const padded = `  ${norm}  `;
  const map = new Map<string, number>();
  for (let i = 0; i <= padded.length - 3; i++) {
    const tri = padded.slice(i, i + 3);
    map.set(tri, (map.get(tri) ?? 0) + 1);
  }
  return map;
}

export function trigramCosineSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA || !normB) return 0;
  const mapA = getTrigrams(normA);
  const mapB = getTrigrams(normB);

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const [k, v] of mapA.entries()) {
    magA += v * v;
    const bv = mapB.get(k);
    if (bv) dot += v * bv;
  }
  for (const v of mapB.values()) {
    magB += v * v;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export interface RepetitionCheckResult {
  isDuplicate: boolean;
  reason?: string;
  matchedField?: 'quote' | 'topic' | 'title';
  matchedAgainst?: string;
  maxJaccard: number;
  maxTrigram: number;
}

export function checkNonRepetition(
  candidate: { quote: string; topic: string; title: string },
  extraBatchCandidates: Array<{ quote: string; topic: string; title: string }> = [],
  jaccardLimit = 0.58,
  trigramLimit = 0.72
): RepetitionCheckResult {
  const history = [
    ...getAllUsedContent().map((u) => ({
      quote: u.quote,
      topic: u.topic,
      title: u.title,
      normalizedQuote: u.normalizedQuote,
    })),
    ...extraBatchCandidates.map((c) => ({
      quote: c.quote,
      topic: c.topic,
      title: c.title,
      normalizedQuote: normalizeText(c.quote),
    })),
  ];

  const normQuote = normalizeText(candidate.quote);
  const normTopic = normalizeText(candidate.topic);
  const normTitle = normalizeText(candidate.title);

  let maxJaccard = 0;
  let maxTrigram = 0;

  for (const item of history) {
    if (normQuote && normQuote === item.normalizedQuote) {
      return {
        isDuplicate: true,
        reason: 'Exact quote match found in permanent history',
        matchedField: 'quote',
        matchedAgainst: item.quote,
        maxJaccard: 1,
        maxTrigram: 1,
      };
    }

    const fields: Array<{ field: 'quote' | 'topic' | 'title'; a: string; b: string; na: string; nb: string }> = [
      { field: 'quote', a: candidate.quote, b: item.quote, na: normQuote, nb: item.normalizedQuote },
      { field: 'topic', a: candidate.topic, b: item.topic, na: normTopic, nb: normalizeText(item.topic) },
      { field: 'title', a: candidate.title, b: item.title, na: normTitle, nb: normalizeText(item.title) },
    ];

    for (const f of fields) {
      if (!f.na || !f.nb) continue;
      if (f.na === f.nb) {
        return {
          isDuplicate: true,
          reason: `Exact ${f.field} match found`,
          matchedField: f.field,
          matchedAgainst: f.b,
          maxJaccard: 1,
          maxTrigram: 1,
        };
      }
      const jac = jaccardSimilarity(f.a, f.b);
      const tri = trigramCosineSimilarity(f.a, f.b);
      if (jac > maxJaccard) maxJaccard = jac;
      if (tri > maxTrigram) maxTrigram = tri;

      if (jac >= jaccardLimit) {
        return {
          isDuplicate: true,
          reason: `Jaccard token similarity ${(jac * 100).toFixed(1)}% >= ${(jaccardLimit * 100).toFixed(0)}% on ${f.field}`,
          matchedField: f.field,
          matchedAgainst: f.b,
          maxJaccard: jac,
          maxTrigram: tri,
        };
      }
      if (tri >= trigramLimit) {
        return {
          isDuplicate: true,
          reason: `Trigram cosine similarity ${(tri * 100).toFixed(1)}% >= ${(trigramLimit * 100).toFixed(0)}% on ${f.field}`,
          matchedField: f.field,
          matchedAgainst: f.b,
          maxJaccard: jac,
          maxTrigram: tri,
        };
      }
    }
  }

  return {
    isDuplicate: false,
    maxJaccard,
    maxTrigram,
  };
}

export function recordUsedContent(videoId: string, item: { quote: string; topic: string; title: string }) {
  db.prepare(`
    INSERT INTO used_content (id, video_id, quote, topic, title, normalized_quote, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    videoId,
    item.quote,
    item.topic,
    item.title,
    normalizeText(item.quote),
    new Date().toISOString()
  );
}
