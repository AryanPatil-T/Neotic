import crypto from 'crypto';
import {
  type AiEngine,
  type ImageSourceMode,
  PIPELINE_STAGES,
  type PipelineJob,
  type ProductionMode,
  type QuoteTone,
  type SceneItem,
  type VideoRecord,
} from '../src/shared/types.ts';
import { type GeneratedShortConcept, generateShortConcept, recommendTrackWithAI } from './aiProviders.ts';
import {
  getAllMusicTracks,
  getAllUsedContent,
  getAllVideos,
  getSettings,
  savePipelineJob,
  upsertVideo,
} from './db.ts';
import { syncToGoogleSheets } from './excelSync.ts';
import { acquireVerticalImage } from './mediaAcquisition.ts';
import { checkNonRepetition, recordUsedContent } from './nonRepetition.ts';
import { computeNextPublishSlots, uploadShortToYouTube } from './scheduler.ts';
import { renderShortVideoMp4 } from './videoRenderer.ts';

export interface CustomConceptInput {
  quote: string;
  title?: string;
  topic?: string;
  description?: string;
  hashtags?: string[];
  visualQuery?: string;
  category?: string;
  visualStyle?: string;
}

export interface BatchGenerateRequest {
  quantity: number;
  productionMode: ProductionMode;
  imageSource: ImageSourceMode;
  engine: AiEngine;
  quoteTone?: QuoteTone;
  visualStyles: string[];
  categories: string[];
  bwMonochrome: boolean;
  autoUploadSchedule: boolean;
  youtubeAccessToken?: string;
  customConcepts?: CustomConceptInput[];
  onComplete?: (job: PipelineJob) => void;
}

let activeRunningJob: PipelineJob | null = null;

export function getActiveOrLatestJob(latestFromDb: PipelineJob | null): PipelineJob | null {
  return activeRunningJob ?? latestFromDb;
}

function appendLog(
  job: PipelineJob,
  stageIndex: number,
  message: string,
  level: 'info' | 'warn' | 'error' | 'success' = 'info'
) {
  const stageName = PIPELINE_STAGES[stageIndex - 1] || 'Studio Pipeline';
  job.currentStageIndex = stageIndex;
  job.currentStageName = stageName;
  job.logs.push({
    timestamp: new Date().toISOString(),
    stageIndex,
    stageName,
    message,
    level,
  });
  savePipelineJob(job);
}

export function startBatchGenerationPipeline(req: BatchGenerateRequest): PipelineJob {
  const customList = Array.isArray(req.customConcepts) && req.customConcepts.length > 0 ? req.customConcepts : null;
  const qty = customList ? Math.min(50, customList.length) : Math.max(1, Math.min(50, Math.round(req.quantity || 5)));
  const settings = getSettings();

  const job: PipelineJob = {
    id: `job_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`,
    status: 'running',
    totalVideos: qty,
    completedVideos: 0,
    currentStageIndex: 1,
    currentStageName: PIPELINE_STAGES[0],
    activeProvider: customList ? 'curated-vault' : req.engine,
    logs: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  activeRunningJob = job;
  appendLog(
    job,
    1,
    customList
      ? `Started rendering ${qty} Short(s) from selected Wisdom Vault quote(s).`
      : `Started batch generation for ${qty} YouTube Short(s) using ${req.engine} engine (${req.quoteTone || settings.defaultQuoteTone}).`,
    'info'
  );

  // Execute asynchronously so HTTP response returns immediately while UI polls live progress
  (async () => {
    const batchAccepted: Array<{ quote: string; topic: string; title: string }> = [];
    const styles = req.visualStyles.length > 0 ? req.visualStyles : ['Dark Cinematic Motivation'];
    const cats = req.categories.length > 0 ? req.categories : ['Timeless Wisdom'];
    const tracks = getAllMusicTracks();

    try {
      for (let i = 0; i < qty; i++) {
        const customItem = customList ? customList[i] : null;
        const videoId = `vid_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
        const category = customItem?.category || cats[i % cats.length];
        const visualStyle = customItem?.visualStyle || styles[i % styles.length];
        const now = new Date().toISOString();

        const placeholder: VideoRecord = {
          id: videoId,
          title: customItem?.title || `Generating ${category} Short #${i + 1}`,
          topic: customItem?.topic || category,
          quote: customItem?.quote || 'Crafting original concept...',
          description: customItem?.description || '',
          hashtags: customItem?.hashtags || ['shorts'],
          category,
          visualStyle,
          productionMode: req.productionMode,
          imageSource: req.imageSource,
          aiEngineUsed: customItem ? 'curated-vault' : req.engine,
          resolution: settings.resolution,
          durationSec: settings.durationSec,
          status: 'generating',
          backgroundImageUrl: '/media/samples/dark_lone_wolf_1794548198442.jpg',
          thumbnailUrl: '/media/samples/dark_lone_wolf_1794548198442.jpg',
          mp4Url: '',
          fileSizeBytes: 0,
          scenes: [],
          musicTrackId: settings.activeMusicTrackId,
          musicVolume: settings.musicVolume,
          logoConfig: settings.logoConfig,
          gradientsConfig: settings.gradientsConfig,
          quoteStyleConfig: settings.quoteStyleConfig,
          privacyStatus: settings.defaultPrivacy,
          createdAt: now,
          updatedAt: now,
        };
        upsertVideo(placeholder);

        try {
          let acceptedConcept: GeneratedShortConcept | null = null;

          if (customItem) {
            appendLog(job, 1, `[${i + 1}/${qty}] Preparing curated quote "${customItem.title || customItem.topic || category}"...`, 'info');
            const cleanQuote = customItem.quote.trim();
            const words = cleanQuote.split(/\s+/);
            const scenesForMode: GeneratedShortConcept['scenes'] =
              req.productionMode === 'multi_scene'
                ? [0, 1, 2, 3].map((idx) => {
                    const chunkSize = Math.max(1, Math.ceil(words.length / 4));
                    const slice = words.slice(idx * chunkSize, (idx + 1) * chunkSize).join(' ') || cleanQuote;
                    const motions = ['slow_zoom_in', 'ken_burns_drift', 'slow_zoom_out', 'vertical_pan'] as const;
                    return {
                      visualPrompt: customItem.visualQuery || visualStyle,
                      overlayText: slice,
                      motion: motions[idx],
                    };
                  })
                : [
                    {
                      visualPrompt: customItem.visualQuery || visualStyle,
                      overlayText: cleanQuote,
                      motion: 'slow_zoom_in',
                    },
                  ];

            acceptedConcept = {
              topic: customItem.topic || category,
              title: customItem.title || `${category} Reflection`,
              quote: cleanQuote,
              description: customItem.description || cleanQuote,
              hashtags: customItem.hashtags?.length ? customItem.hashtags : ['shorts', 'wisdom', 'lifeadvice', 'mindset'],
              visualQuery: customItem.visualQuery || visualStyle,
              scenes: scenesForMode,
              engineUsed: 'curated-vault',
            };
            appendLog(job, 3, `[${i + 1}/${qty}] Curated Wisdom Vault script ready.`, 'success');
          } else {
            // Stages 1, 2, 3 + Non-Repetition Engine (up to 4 retries)
            appendLog(job, 1, `[${i + 1}/${qty}] Generating topic & concept (${category} / ${visualStyle})...`, 'info');
            const avoidQuotes = getAllUsedContent().map((u) => u.quote);

            let retryHint: string | undefined;

            for (let attempt = 1; attempt <= 5; attempt++) {
              const concept = await generateShortConcept({
                engine: req.engine,
                category,
                visualStyle,
                productionMode: req.productionMode,
                quoteTone: req.quoteTone || settings.defaultQuoteTone,
                avoidQuotes: [...avoidQuotes, ...batchAccepted.map((b) => b.quote)],
                retryHint,
                onAttemptLog: (msg, level) => appendLog(job, 2, msg, level || 'info'),
              });

              job.activeProvider = concept.engineUsed;
              appendLog(job, 2, `[${i + 1}/${qty}] Checking non-repetition (attempt ${attempt}/5)...`, 'info');

              const dupCheck = checkNonRepetition(
                { quote: concept.quote, topic: concept.topic, title: concept.title },
                batchAccepted,
                settings.jaccardThreshold,
                settings.trigramThreshold
              );

              if (!dupCheck.isDuplicate) {
                acceptedConcept = concept;
                appendLog(
                  job,
                  3,
                  `[${i + 1}/${qty}] Passed Non-Repetition Engine (max Jaccard ${(dupCheck.maxJaccard * 100).toFixed(0)}%, Trigram ${(dupCheck.maxTrigram * 100).toFixed(0)}%). Script ready.`,
                  'success'
                );
                break;
              }

              appendLog(
                job,
                2,
                `[${i + 1}/${qty}] Rejected candidate (${dupCheck.reason}). Retrying...`,
                'warn'
              );
              retryHint = `Previous attempt was too similar to "${dupCheck.matchedAgainst}". Pick a completely fresh angle, metaphor, and vocabulary.`;
            }

            if (!acceptedConcept) {
              throw new Error('Non-Repetition Engine exhausted 5 attempts without finding a unique quote.');
            }
          }

          batchAccepted.push({
            quote: acceptedConcept.quote,
            topic: acceptedConcept.topic,
            title: acceptedConcept.title,
          });

          // Stage 4: Acquire/generate vertical images
          appendLog(job, 4, `[${i + 1}/${qty}] Acquiring 9:16 artwork (${req.imageSource})...`, 'info');
          const scenes: SceneItem[] = [];
          const perSceneDuration = settings.durationSec / Math.max(1, acceptedConcept.scenes.length);

          for (let sIdx = 0; sIdx < acceptedConcept.scenes.length; sIdx++) {
            const sc = acceptedConcept.scenes[sIdx];
            const imageUrl = await acquireVerticalImage({
              sourceMode: req.imageSource,
              visualPrompt: sc.visualPrompt || acceptedConcept.visualQuery,
              visualStyle,
              resolution: settings.resolution,
              bwMonochrome: req.bwMonochrome,
              indexSeed: i * 5 + sIdx,
              onLog: (msg, lvl) => appendLog(job, 4, msg, lvl || 'info'),
            });
            scenes.push({
              sceneIndex: sIdx,
              visualPrompt: sc.visualPrompt,
              overlayText: sc.overlayText,
              durationSec: Number(perSceneDuration.toFixed(2)),
              motion: sc.motion,
              imageUrl,
            });
          }

          // Stages 5, 6, 7: Apply Typography, Gradients, Logo
          appendLog(job, 5, `[${i + 1}/${qty}] Applying ${settings.quoteStyleConfig.fontFamily} typography...`, 'info');
          appendLog(job, 6, `[${i + 1}/${qty}] Applying ${settings.gradientsConfig.preset} 4-sided vignette...`, 'info');
          appendLog(job, 7, `[${i + 1}/${qty}] Applying logo/watermark configuration...`, 'info');

          // Stage 8: Music selection
          let chosenTrackId = settings.activeMusicTrackId;
          if (settings.autoSelectMoodTrack && tracks.length > 0) {
            const rec = await recommendTrackWithAI(
              `${acceptedConcept.quote} ${visualStyle} ${category}`,
              tracks,
              req.engine
            );
            chosenTrackId = rec.trackId;
            appendLog(job, 8, `[${i + 1}/${qty}] Auto-selected soundtrack: ${rec.trackId} (${rec.reason})`, 'info');
          } else {
            appendLog(job, 8, `[${i + 1}/${qty}] Attaching soundtrack ${chosenTrackId} at ${settings.musicVolume}% volume.`, 'info');
          }

          const updatedVideo: VideoRecord = {
            ...placeholder,
            title: acceptedConcept.title,
            topic: acceptedConcept.topic,
            quote: acceptedConcept.quote,
            description: acceptedConcept.description,
            hashtags: acceptedConcept.hashtags,
            aiEngineUsed: acceptedConcept.engineUsed,
            backgroundImageUrl: scenes[0].imageUrl,
            thumbnailUrl: scenes[0].imageUrl,
            scenes,
            musicTrackId: chosenTrackId,
            updatedAt: new Date().toISOString(),
          };

          // Stage 9: Render real MP4 with FFmpeg
          appendLog(job, 9, `[${i + 1}/${qty}] Rendering ${settings.resolution} MP4 via FFmpeg...`, 'info');
          const renderResult = await renderShortVideoMp4(updatedVideo);

          updatedVideo.mp4Url = renderResult.mp4Url;
          updatedVideo.thumbnailUrl = renderResult.thumbnailUrl;
          updatedVideo.fileSizeBytes = renderResult.fileSizeBytes;
          updatedVideo.status = 'completed';
          updatedVideo.updatedAt = new Date().toISOString();

          // Stage 10: Update SQLite & Excel/Sheets
          appendLog(job, 10, `[${i + 1}/${qty}] Saving video & permanent used_content to SQLite...`, 'info');
          upsertVideo(updatedVideo);
          recordUsedContent(updatedVideo.id, {
            quote: updatedVideo.quote,
            topic: updatedVideo.topic,
            title: updatedVideo.title,
          });

          if (settings.autoSyncSheets && req.youtubeAccessToken) {
            try {
              await syncToGoogleSheets(req.youtubeAccessToken);
              appendLog(job, 10, `Synced database tabs to Google Sheets.`, 'success');
            } catch (syncErr: any) {
              appendLog(job, 10, `Google Sheets auto-sync skipped: ${syncErr?.message}`, 'warn');
            }
          }

          // Stages 11 & 12: Optional Auto-Upload & Schedule to YouTube
          if (req.autoUploadSchedule) {
            const scheduleCfg = {
              ...settings.scheduleConfig,
              intervalHours: settings.dailyAutomation?.intervalHours || settings.scheduleConfig.intervalHours,
              startTime: settings.dailyAutomation?.firstPublishTime || settings.scheduleConfig.startTime,
            };
            const slots = computeNextPublishSlots(
              scheduleCfg,
              1,
              getAllVideos(),
              settings.dailyAutomation?.timezone
            );
            const slot = slots[0];
            if (req.youtubeAccessToken && slot) {
              try {
                appendLog(job, 11, `[${i + 1}/${qty}] Uploading MP4 to YouTube Data API v3...`, 'info');
                const yt = await uploadShortToYouTube({
                  video: updatedVideo,
                  accessToken: req.youtubeAccessToken,
                  publishAtIso: slot.isoUtc,
                });
                updatedVideo.youtubeVideoId = yt.youtubeVideoId;
                updatedVideo.scheduledAt = slot.isoUtc;
                updatedVideo.status = 'scheduled';
                upsertVideo(updatedVideo);
                appendLog(
                  job,
                  12,
                  `[${i + 1}/${qty}] Scheduled on YouTube (${yt.youtubeVideoId}) for ${slot.localDisplay}.`,
                  'success'
                );
              } catch (ytErr: any) {
                // Keep local 2h schedule slot intact so user can retry upload later without losing the video
                updatedVideo.scheduledAt = slot.isoUtc;
                updatedVideo.status = 'scheduled';
                updatedVideo.errorMessage = `Queued locally (YouTube upload paused: ${ytErr?.message || 'quota/auth'})`;
                upsertVideo(updatedVideo);
                appendLog(
                  job,
                  11,
                  `[${i + 1}/${qty}] Saved 2h schedule slot (${slot.localDisplay}); YouTube upload deferred: ${ytErr?.message}`,
                  'warn'
                );
              }
            } else if (slot) {
              updatedVideo.scheduledAt = slot.isoUtc;
              updatedVideo.status = 'scheduled';
              upsertVideo(updatedVideo);
              appendLog(
                job,
                12,
                `[${i + 1}/${qty}] Assigned 2h schedule slot ${slot.localDisplay} (sign in with Google in Scheduler to push to YouTube).`,
                'info'
              );
            }
          } else {
            appendLog(job, 12, `[${i + 1}/${qty}] Short ready in My Videos library.`, 'success');
          }

          job.completedVideos++;
          savePipelineJob(job);
        } catch (itemErr: any) {
          placeholder.status = 'failed';
          placeholder.errorMessage = itemErr?.message || 'Generation failed';
          placeholder.updatedAt = new Date().toISOString();
          upsertVideo(placeholder);
          appendLog(job, 9, `[${i + 1}/${qty}] Failed: ${placeholder.errorMessage}`, 'error');
        }
      }

      job.status = 'completed';
      job.finishedAt = new Date().toISOString();
      appendLog(job, 12, `Batch pipeline finished: ${job.completedVideos}/${qty} Shorts completed.`, 'success');
    } catch (fatal: any) {
      job.status = 'failed';
      job.finishedAt = new Date().toISOString();
      appendLog(job, job.currentStageIndex, `Pipeline error: ${fatal?.message || fatal}`, 'error');
    } finally {
      activeRunningJob = null;
      req.onComplete?.(job);
    }
  })();

  return job;
}
