import { useCallback, useMemo } from "react";
import type { CompositionPropsType, Message, MonetizationSettings } from "@/types/constants";
import { VIDEO_FPS, DEFAULT_CHARS_PER_SECOND, defaultMyCompProps } from "@/types/constants";
import { addAppearTimes } from "@/helpers/chatTiming";
import type { PreviewBuildResult } from "@/helpers/previewBuilder";
import { buildPreviewProps } from "@/helpers/previewBuilder";
import { DEFAULT_SCRIPT_TEMPLATE } from "../constants";
import { parseScriptText } from "./useScriptParser";

export function usePreviewBuilder() {
  const fallbackMessages = useMemo(
    () => parseScriptText(DEFAULT_SCRIPT_TEMPLATE).messages,
    [],
  );

  const buildPreview = useCallback(
    (formValues: CompositionPropsType): PreviewBuildResult => {
      const monetizationSettings: MonetizationSettings =
        formValues.monetization ?? defaultMyCompProps.monetization;
      const messages =
        formValues.messages && formValues.messages.length > 0
          ? formValues.messages
          : fallbackMessages;

      return buildPreviewProps({
        ...formValues,
        messages,
        monetization: monetizationSettings,
      });
    },
    [fallbackMessages],
  );

  const retimeMessages = useCallback((messages: Message[]): Message[] => {
    const normalizedMessages = messages.map((msg) => ({
      ...msg,
      text: msg.text || "",
      sender: (msg.sender || "them") as "me" | "them",
    }));

    const { messagesWithTiming } = addAppearTimes(normalizedMessages, {
      fps: VIDEO_FPS,
      charsPerSecond: DEFAULT_CHARS_PER_SECOND,
      useAudioDuration: messages.some(
        (msg) => msg.audioDuration && msg.audioDuration > 0,
      ),
    });

    return messagesWithTiming as Message[];
  }, []);

  const estimateDuration = useCallback((messages: Message[]): number => {
    let totalDuration = 0;

    for (const msg of messages) {
      if (msg.audioDuration && msg.audioDuration > 0) {
        totalDuration += msg.audioDuration;
      } else {
        const textLength = msg.text?.length || 0;
        const estimatedSeconds = textLength / DEFAULT_CHARS_PER_SECOND;
        totalDuration += estimatedSeconds;
      }
      totalDuration += 0.5; // 500ms pause
    }

    return Math.ceil(totalDuration * VIDEO_FPS);
  }, []);

  /**
   * Get a simplified preview summary for display
   */
  const getPreviewSummary = useCallback(
    (formValues: CompositionPropsType) => {
      const messageCount = formValues.messages.filter((m) => m.type === "text").length;
      const estimatedFrames = estimateDuration(formValues.messages);
      const estimatedSeconds = Math.round(estimatedFrames / VIDEO_FPS);

      return {
        messageCount,
        estimatedFrames,
        estimatedSeconds,
        estimatedMinutes: Math.floor(estimatedSeconds / 60),
        speakerCount: formValues.voices.length,
        hasAudio: formValues.messages.some((m) => m.audioDuration > 0),
      };
    },
    [estimateDuration],
  );

  return {
    buildPreview,
    retimeMessages,
    estimateDuration,
    getPreviewSummary,
  };
}
