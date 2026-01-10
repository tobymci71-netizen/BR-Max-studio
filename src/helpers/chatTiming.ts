import { Message } from "../types/constants";

export type RawMessage<
  T extends Record<string, unknown> = Record<string, never>
> = Omit<Message, 'appearAt'> & { appearAt?: number } & T;

type TimingOptions = {
  fps?: number; // frames per second
  charsPerSecond?: number; // reading speed
  baseDelay?: number; // gap *between* messages (in frames)
  initialDelay?: number; // delay before the first message (in frames)
  endBuffer?: number; // tail buffer after the last message (in frames)
  useAudioDuration?: boolean; // flag to use audio duration instead of text length
  forceRecalc?: boolean; // skip existing timing and recalculate
};

const hasAudioDuration = (msg: { audioDuration?: number | null }) =>
  typeof msg.audioDuration === "number" && !Number.isNaN(msg.audioDuration) && msg.audioDuration > 0;

export const getMessageDurationInFrames = (
  msg: { text: string; audioDuration?: number | null },
  fps: number,
  charsPerSecond: number,
  preferAudioDuration: boolean,
) => {
  const shouldUseAudio = preferAudioDuration && hasAudioDuration(msg);

  if (shouldUseAudio) {
    return Math.ceil((msg.audioDuration ?? 0) * fps);
  }

  return Math.ceil((msg.text.length / charsPerSecond) * fps);
};

/**
 * Prevents audio overlaps by adjusting when messages appear
 * Each message waits for the previous audio to finish before starting
 */
export const adjustMessageTimingForAudioOverlap = <T extends {
  appearAt: number;
  audioPath?: string | null;
  audioDuration?: number | null;
  text: string;
  type?: string;
  startsConversation?: boolean;
}>(
  messages: T[],
  fps: number,
  charsPerSecond: number,
  outroAnimationDurationMs: number = 0,
): T[] => {
  const messagesWithAudio = messages.filter((msg) => msg.audioPath && msg.type !== "promotion");

  if (messagesWithAudio.length === 0) {
    return messages;
  }

  const adjustedTimingMap = new Map<T, number>();
  let audioEndFrame = 0;
  const outroFrames = Math.round((outroAnimationDurationMs / 1000) * fps);

  // Adjust each message to start after the previous audio finishes
  messagesWithAudio.forEach((msg, idx) => {
    let startFrame = Math.max(msg.appearAt, audioEndFrame);

    // If starting a new conversation, wait for outro animation
    if (msg.startsConversation && idx > 0 && outroFrames > 0) {
      startFrame += outroFrames;
    }

    adjustedTimingMap.set(msg, startFrame);

    const msgDuration = hasAudioDuration(msg)
      ? Math.ceil((msg.audioDuration ?? 0) * fps)
      : getMessageDurationInFrames(msg, fps, charsPerSecond, true);

    audioEndFrame = startFrame + msgDuration;
  });

  // Apply adjusted timing
  return messages.map((msg) => {
    const adjusted = adjustedTimingMap.get(msg);
    return adjusted !== undefined ? { ...msg, appearAt: adjusted } : msg;
  });
};

export const addAppearTimes = <Extra extends Record<string, unknown>>(
  rawMessages: RawMessage<Extra>[],
  {
    fps = 30,
    charsPerSecond = 10,
    baseDelay = 0,
    initialDelay = 0,
    endBuffer = 60,
    useAudioDuration = false,
    forceRecalc = false,
  }: TimingOptions = {},
) => {
  const isCommand = (msg: RawMessage<Extra>) => msg.type === "command";
  const alreadyTimed = rawMessages.length > 0 && rawMessages.every(m => m.appearAt !== undefined);

  let currentFrame = initialDelay;

  const messagesWithTiming = rawMessages.map((msg, idx) => {
    const appearAt = Math.round(currentFrame);

    // Command messages don't take time
    if (!isCommand(msg)) {
      const useAudio = alreadyTimed && !forceRecalc ? hasAudioDuration(msg) : useAudioDuration;
      const duration = getMessageDurationInFrames(msg, fps, charsPerSecond, useAudio);
      const isLastMessage = idx === rawMessages.length - 1;

      currentFrame = appearAt + duration + (isLastMessage ? 0 : baseDelay);
    }

    return { ...msg, appearAt };
  });

  const totalFrames = Math.round(currentFrame + endBuffer);
  return { messagesWithTiming, totalFrames };
};
