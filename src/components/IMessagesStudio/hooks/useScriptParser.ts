import { addAppearTimes } from "@/helpers/chatTiming";
import { CONVERSATION_COMMAND_REGEX } from "@/helpers/messageCommands";
import {
  CompositionPropsType,
  DEFAULT_CHARS_PER_SECOND,
  Message,
  VIDEO_FPS,
} from "@/types/constants";
import { useCallback } from "react";

export function parseScriptText(rawText: string) {
  const lines = rawText.split("\n");
  const messages: Message[] = [];
  const speakerOrder: string[] = [];
  const addSpeaker = (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    const existingIndex = speakerOrder.findIndex(
      (name) => name.toLowerCase() === normalized,
    );
    if (existingIndex === -1) {
      speakerOrder.push(trimmed);
    } else if (speakerOrder[existingIndex] !== trimmed) {
      speakerOrder[existingIndex] = trimmed;
    }
  };

  let currentRecipientName = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith(">") && trimmed.endsWith("<")) {
      const conversationMatch = trimmed.match(CONVERSATION_COMMAND_REGEX);
      if (conversationMatch && conversationMatch[1]) {
        const nextRecipient = conversationMatch[1].trim();
        if (nextRecipient) {
          currentRecipientName = nextRecipient;
          addSpeaker(nextRecipient);
        }
      }

      messages.push({
        text: trimmed,
        sender: "them",
        type: "command",
        audioPath: "",
        audioDuration: 0,
        appearAt: 0,
        showArrow: false,
      });
      continue;
    }

    // Parse "Speaker: Message" format
    const match = trimmed.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const [, speaker, text] = match;
      const normalizedSpeaker = speaker.trim();
      const isMe = normalizedSpeaker.toLowerCase() === "me";
      const resolvedSpeaker = isMe ? "Me" : currentRecipientName || "Them";
      addSpeaker(resolvedSpeaker);

      // Check if text contains an image command pattern: > image filename < or {image: name}
      const imageMatch = text.match(/>\s*image\s+(.+?)\s*</i) || text.match(/\{image:\s*(.+?)\s*\}/);
      if (imageMatch && imageMatch[1]) {
        const imageName = imageMatch[1].trim();
        // Try to load image from localStorage
        let imageUrl = "";
        try {
          const saved = localStorage.getItem(`br-max-image-${imageName}`);
          if (saved) {
            imageUrl = saved;
          }
        } catch (error) {
          console.error("Failed to load image from localStorage:", error);
        }

        messages.push({
          text: `> Image ${imageName} <`,
          sender: isMe ? "me" : "them",
          speaker: resolvedSpeaker,
          type: "image",
          imageUrl,
          imageName,
          audioPath: "",
          audioDuration: 0,
          appearAt: 0,
          showArrow: false,
        });
        continue;
      }

      messages.push({
        text: text.trim(),
        sender: isMe ? "me" : "them",
        speaker: resolvedSpeaker,
        type: "text",
        audioPath: "",
        audioDuration: 0,
        appearAt: 0,
        showArrow: false,
      });
    } else {
      // Continuation of previous message
      if (messages.length > 0) {
        messages[messages.length - 1].text += "\n" + trimmed;
      }
    }
  }

  // Add timing
  const { messagesWithTiming } = addAppearTimes(messages, {
    fps: VIDEO_FPS,
    charsPerSecond: DEFAULT_CHARS_PER_SECOND,
    useAudioDuration: false,
  });

  // Create voice assignments
  const recipientSpeakers = speakerOrder.filter(
    (name) => name.toLowerCase() !== "me",
  );
  const finalSpeakers =
    recipientSpeakers.length > 0 ? ["Me", ...recipientSpeakers] : ["Me", "Them"];

  const voices: CompositionPropsType["voices"] = finalSpeakers.map((name) => ({
    name,
    voiceId: "",
  }));

  return { messages: messagesWithTiming as Message[], voices };
}

export function useScriptParser() {
  const parseScript = useCallback((rawText: string) => parseScriptText(rawText), []);

  const importFromFile = useCallback(
    (
      file: File,
      callback: (data: {
        messages: Message[];
        voices: CompositionPropsType["voices"];
        rawText: string;
      }) => void,
    ) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || "");
        const parsed = parseScript(text);
        callback({ ...parsed, rawText: text });
      };
      reader.readAsText(file);
    },
    [parseScript],
  );

  return { parseScript, importFromFile };
}
