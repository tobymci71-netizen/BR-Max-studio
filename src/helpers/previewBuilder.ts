import {
  DEFAULT_CHARS_PER_SECOND,
  FRAMES_AFTER_LAST_MESSAGE,
  VIDEO_FPS,
  defaultMyCompProps,
  CompositionPropsType,
  MonetizationSettings,
  ChatSettings,
  Message,
  getMonetizationCampaignConfig,
  RIZZ_MONETIZATION_CATEGORY,
} from "../types/constants";
import { applyMessageCommands } from "./messageCommands";
import { addAppearTimes, getMessageDurationInFrames, adjustMessageTimingForAudioOverlap } from "./chatTiming";

const MONETIZATION_INTERMISSION_FRAMES = 0;
const MONETIZATION_EXCHANGE_GAP = 0;
export const MONETIZATION_TRIGGER_REGEX = />\s*insert\s+monetization\s*</i;

const ensureText = (value?: string) => value ?? "";

const estimateDurationFrames = (
  text: string | undefined,
  audioDuration?: number,
  preferAudioDuration: boolean = false,
) =>
  getMessageDurationInFrames(
    {
      text: ensureText(text),
      audioDuration,
    },
    VIDEO_FPS,
    DEFAULT_CHARS_PER_SECOND,
    preferAudioDuration,
  );

type MonetizationTimeline = {
  messages: MonetizationSettings["messages"];
  durationInFrames: number;
  rizzReplyStartFrame?: number;
};

const EMPTY_MONETIZATION_TIMELINE: MonetizationTimeline = {
  messages: [],
  durationInFrames: 0,
};

const withCampaignDefaults = (settings: MonetizationSettings): MonetizationSettings => {
  const campaignConfig = getMonetizationCampaignConfig(settings.campaign);
  return {
    ...settings,
    meVoiceId: settings.meVoiceId?.trim() ?? "",
    compaignBotVoiceId: settings.compaignBotVoiceId?.trim()
      ? settings.compaignBotVoiceId
      : campaignConfig?.compaignBotVoiceId ?? settings.compaignBotVoiceId ?? "",
    profilePicture: settings.profilePicture?.trim()
      ? settings.profilePicture
      : campaignConfig?.profilePicture ?? settings.profilePicture ?? "",
  };
};

export type MonetizationPreviewContext = {
  enabled: boolean;
  beforeMessageCount: number;
};

export type PreviewBuildResult = {
  previewProps: CompositionPropsType;
  totalFrames: number;
  monetizationContext: MonetizationPreviewContext | null;
};

// Calculate how long intro/reply audio should play (in frames)
const calculateAudioFrames = (text: string, audioDuration?: number) => {
  const hasAudio = Boolean(audioDuration && audioDuration > 0);
  return estimateDurationFrames(text, audioDuration, hasAudio);
};

const buildMonetizationTimeline = (
  settings: MonetizationSettings,
): MonetizationTimeline => {
  // Rizz monetization: just intro + reply
  if (settings.category === RIZZ_MONETIZATION_CATEGORY) {
    const introFrames = calculateAudioFrames(
      settings.rizz_config?.intro_message ?? "",
      settings.startMessageAudioDuration
    );
    const replyText = settings.rizz_config?.reply?.trim() || settings.rizz_config?.reply_visual || "";
    const replyFrames = calculateAudioFrames(
      replyText,
      settings.rizz_config?.reply_audio_duration
    );

    const replyStartFrame = introFrames + MONETIZATION_EXCHANGE_GAP;
    const totalFrames = replyStartFrame + replyFrames;

    return {
      messages: [],
      durationInFrames: totalFrames,
      rizzReplyStartFrame: replyStartFrame,
    };
  }

  // Regular monetization: start message + conversation messages
  const startFrames = calculateAudioFrames(
    settings.startMessage ?? "",
    settings.startMessageAudioDuration
  );

  let currentFrame = startFrames > 0 ? startFrames + MONETIZATION_EXCHANGE_GAP : 0;

  const timedMessages = (settings.messages || []).map((msg) => {
    const msgFrames = calculateAudioFrames(msg.text, msg.audioDuration);
    const appearAt = currentFrame;
    currentFrame += msgFrames + MONETIZATION_EXCHANGE_GAP;
    return { ...msg, appearAt };
  });

  return {
    messages: timedMessages,
    durationInFrames: currentFrame,
  };
};

// Fill in missing message fields with defaults
const normalizeMessages = (msgs: Message[]): Message[] =>
  msgs.map((msg) => ({
    ...msg,
    text: msg.text || "",
    sender: (msg.sender || "them") as "me" | "them",
    type: msg.type || "text",
    audioPath: msg.audioPath || "",
    audioDuration: msg.audioDuration || 0,
    appearAt: msg.appearAt || 0,
    speaker: msg.speaker || (msg.sender === "me" ? "Me" : "Them"),
    showArrow: Boolean(msg.showArrow),
  }));

export const buildPreviewProps = (
  formValues: CompositionPropsType,
  options?: { forceMessageTiming?: boolean },
): PreviewBuildResult => {
  // ============ STEP 1: Setup monetization ============
  const monetization = withCampaignDefaults({
    ...(formValues.monetization ?? defaultMyCompProps.monetization),
    messages: formValues.monetization?.messages ?? defaultMyCompProps.monetization.messages,
  });

  // Find where "> insert monetization <" appears in the script
  const monetizationIndex = formValues.messages.findIndex(
    (msg) => msg.type === "command" && MONETIZATION_TRIGGER_REGEX.test(msg.text ?? ""),
  );

  const monetizationEnabled = monetization.enabled && monetizationIndex >= 0;

  // ============ STEP 2: Split messages into before/after monetization ============
  const chatSettings: ChatSettings = {
    ...defaultMyCompProps.CHAT_SETTINGS,
    ...(formValues.CHAT_SETTINGS ?? {}),
  };

  const messagesBeforeMono = monetizationIndex >= 0
    ? formValues.messages.slice(0, monetizationIndex)
    : formValues.messages;

  const messagesAfterMono = monetizationIndex >= 0
    ? formValues.messages.slice(monetizationIndex + 1)
    : [];

  const { messages: beforeProcessed, chatSettings: settingsAfterBefore } =
    applyMessageCommands(messagesBeforeMono, chatSettings);
  const { messages: afterProcessed, chatSettings: finalChatSettings } =
    applyMessageCommands(messagesAfterMono, settingsAfterBefore);

  const beforeMessages = normalizeMessages(beforeProcessed);
  const afterMessages = normalizeMessages(afterProcessed);

  // ============ STEP 3: Calculate timing ============
  const hasAudio = [...beforeMessages, ...afterMessages].some(m => m.audioDuration > 0);
  const forceRecalc = options?.forceMessageTiming ?? false;

  const timingOptions = {
    fps: VIDEO_FPS,
    charsPerSecond: DEFAULT_CHARS_PER_SECOND,
    useAudioDuration: hasAudio,
    forceRecalc,
  };

  // Time the messages before monetization
  const { messagesWithTiming: beforeTimed, totalFrames: beforeEndFrame } =
    addAppearTimes(beforeMessages, { ...timingOptions, endBuffer: 0 });

  // Calculate monetization duration
  const monoTimeline = monetizationEnabled
    ? buildMonetizationTimeline(monetization)
    : EMPTY_MONETIZATION_TIMELINE;

  const monoStartFrame = monetizationEnabled && monoTimeline.durationInFrames > 0
    ? beforeEndFrame + MONETIZATION_INTERMISSION_FRAMES
    : beforeEndFrame;

  const monoEndFrame = monoStartFrame + monoTimeline.durationInFrames;

  // Time the messages after monetization
  const afterTiming = afterMessages.length > 0
    ? addAppearTimes(afterMessages, {
        ...timingOptions,
        initialDelay: monoEndFrame,
        endBuffer: FRAMES_AFTER_LAST_MESSAGE,
      })
    : {
        messagesWithTiming: [],
        totalFrames: monoEndFrame + FRAMES_AFTER_LAST_MESSAGE,
      };

  let allMessages = [
    ...beforeTimed,
    ...afterTiming.messagesWithTiming,
  ];

  // ============ STEP 4: Adjust for audio overlaps ============
  const outroSettings = finalChatSettings.chatOutroAnimation ?? defaultMyCompProps.CHAT_SETTINGS.chatOutroAnimation;
  const outroDurationMs = finalChatSettings.chatOutroAnimationDurationMs ?? defaultMyCompProps.CHAT_SETTINGS.chatOutroAnimationDurationMs;

  if (hasAudio) {
    allMessages = adjustMessageTimingForAudioOverlap(
      allMessages,
      VIDEO_FPS,
      DEFAULT_CHARS_PER_SECOND,
      outroSettings !== 'none' ? outroDurationMs : 0,
    );
  }

  // ============ STEP 5: Calculate final video duration ============
  let videoEndFrame = afterTiming.totalFrames;

  // Make sure video is long enough for the last message to finish playing
  if (allMessages.length > 0) {
    const lastMsg = allMessages[allMessages.length - 1];
    const lastMsgDuration = hasAudio && lastMsg.audioDuration
      ? Math.ceil(lastMsg.audioDuration * VIDEO_FPS)
      : getMessageDurationInFrames(lastMsg, VIDEO_FPS, DEFAULT_CHARS_PER_SECOND, hasAudio);

    const lastMsgEndFrame = lastMsg.appearAt + lastMsgDuration + FRAMES_AFTER_LAST_MESSAGE;
    videoEndFrame = Math.max(videoEndFrame, lastMsgEndFrame);
  }

  // Make sure video is long enough for monetization to finish
  videoEndFrame = Math.max(videoEndFrame, monoEndFrame);

  // Add outro animation time
  const outroFrames = outroSettings !== 'none'
    ? Math.round((outroDurationMs / 1000) * VIDEO_FPS)
    : 0;

  const totalFrames = videoEndFrame + outroFrames;

  // ============ STEP 6: Return result ============
  return {
    previewProps: {
      ...formValues,
      durationInFrames: totalFrames,
      CHAT_SETTINGS: finalChatSettings,
      messages: allMessages,
      monetization: {
        ...monetization,
        enabled: monetizationEnabled,
        messages: monoTimeline.messages,
        startFrame: monoStartFrame,
        durationInFrames: monoTimeline.durationInFrames,
        rizzReplyStartFrame: monoTimeline.rizzReplyStartFrame,
      },
    },
    totalFrames,
    monetizationContext: monetizationEnabled
      ? { enabled: true, beforeMessageCount: beforeMessages.length }
      : null,
  };
};
