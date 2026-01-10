import { z } from "zod";
import { CompositionProps, THEME, Theme } from "../types/constants";

type CompositionPropsType = z.infer<typeof CompositionProps>;

type Message = CompositionPropsType["messages"][number];

export type MessageSection = {
  messages: Message[];
  showTopBar: boolean;
  conversationRecipientName?: string;
  conversationId?: number;
  theme: Theme;
};

export const chunkMessages = (
  messages: Message[],
  size: number
): Message[][] => {
  const chunks: Message[][] = [];
  for (let i = 0; i < messages.length; i += size) {
    chunks.push(messages.slice(i, i + size));
  }
  return chunks;
};

/**
 * Estimates the height of a message bubble in pixels
 * Made conservative to prevent overflow
 */
const estimateMessageHeight = (message: Message): number => {
  // Base padding and styling
  const BUBBLE_PADDING_VERTICAL = 12 * 2; // top + bottom padding
  const LINE_HEIGHT = 60; // Updated to match lineHeight: 1.6 (base font ~37px * 1.6 ≈ 60px)
  const CHARS_PER_LINE = 42; // Balanced estimate
  const TAIL_HEIGHT = 6; // Reduced height for bubble tail

  const textLines = Math.ceil(message.text.length / CHARS_PER_LINE);
  const textHeight = textLines * LINE_HEIGHT;

  return BUBBLE_PADDING_VERTICAL + textHeight + TAIL_HEIGHT;
};

/**
 * Estimates the height of a message group (consecutive messages from same sender)
 */
const estimateGroupHeight = (messages: Message[]): number => {
  if (messages.length === 0) return 0;

  const MESSAGE_GAP = 6; // gap between messages in a group
  const GROUP_MARGIN = 12; // marginBottom for each group
  const EXTRA_BUFFER = 0; // No extra buffer - fill to the edge

  let totalHeight = 0;
  for (let i = 0; i < messages.length; i++) {
    totalHeight += estimateMessageHeight(messages[i]);
    if (i < messages.length - 1) {
      totalHeight += MESSAGE_GAP;
    }
  }

  return totalHeight + GROUP_MARGIN + EXTRA_BUFFER;
};

/**
 * Chunks messages based on maximum available height instead of fixed count
 */
export const chunkMessagesByHeight = (
  messages: Message[],
  maxHeight: number,
  showTopBarFirstOnly: boolean = true
): MessageSection[] => {
  if (messages.length === 0) return [];

  const getAvailableMessageHeight = (withTopBar: boolean) => {
    const TOPBAR_HEIGHT = withTopBar ? 60 : 0;
    const TIMESTAMP_HEIGHT = withTopBar ? 30 : 0;
    const LIST_PADDING = 20; // Only top padding (20px top + 0px bottom)
    const BOTTOM_GAP = 0; // No bottom padding in messages container
    const SAFETY_MARGIN = 0; // No safety margin - fill exactly to the bottom

    const chromeHeight = TOPBAR_HEIGHT + TIMESTAMP_HEIGHT;
    return maxHeight - chromeHeight - LIST_PADDING - BOTTOM_GAP - SAFETY_MARGIN;
  };

  const GAP_BETWEEN_GROUPS = 14;

  const sections: MessageSection[] = [];
  let currentSection: MessageSection | null = null;
  let currentHeight = 0;
  let currentAvailableHeight = getAvailableMessageHeight(false);

  const finalizeSection = () => {
    if (currentSection && currentSection.messages.length > 0) {
      sections.push({ ...currentSection, messages: [...currentSection.messages] });
    }
    currentSection = null;
    currentHeight = 0;
    currentAvailableHeight = getAvailableMessageHeight(false);
  };

  const startSectionForMessage = (message: Message) => {
    const showTopBar = !showTopBarFirstOnly || !!message.startsConversation;
    currentSection = {
      messages: [],
      showTopBar,
      conversationRecipientName: message.conversationRecipientName,
      conversationId: message.conversationId,
      theme: (message.activeTheme ?? THEME.LIGHT) as Theme,
    };
    currentHeight = 0;
    currentAvailableHeight = getAvailableMessageHeight(showTopBar);
  };

  for (let i = 0; i < messages.length; ) {
    const currentMessage = messages[i];
    const currentSender = currentMessage.sender;

    if (currentSection !== null) {
      const section = currentSection as MessageSection;
      if (
        section.messages.length > 0 &&
        currentMessage.activeTheme &&
        currentMessage.activeTheme !== section.theme
      ) {
        finalizeSection();
      }
    }

    if (currentMessage.startsConversation && currentSection !== null) {
      const section = currentSection as MessageSection;
      if (section.messages.length > 0) {
        finalizeSection();
      }
    }

    if (currentSection === null) {
      startSectionForMessage(currentMessage);
    }

    // Collect all consecutive messages from the same sender (a "group")
    const senderGroup: Message[] = [];
    let j = i;
    while (j < messages.length && messages[j].sender === currentSender) {
      const candidate = messages[j];
      if (
        senderGroup.length === 0 &&
        !candidate.startsConversation &&
        currentSection !== null
      ) {
        const section = currentSection as MessageSection;
        if (
          section.messages.length === 0 &&
          candidate.conversationId !== section.conversationId
        ) {
          // Conversation changed without explicit start flag — treat as new section safeguard
          finalizeSection();
          startSectionForMessage(candidate);
        }
      }

      senderGroup.push(candidate);
      j++;

      if (j < messages.length && messages[j].startsConversation) {
        break;
      }
    }

    const groupHeight = estimateGroupHeight(senderGroup);
    const gapHeight = currentSection !== null && (currentSection as MessageSection).messages.length > 0 ? GAP_BETWEEN_GROUPS : 0;
    const totalHeightWithGroup = currentHeight + gapHeight + groupHeight;

    if (currentSection !== null && totalHeightWithGroup <= currentAvailableHeight) {
      const section = currentSection as MessageSection;
      section.messages.push(...senderGroup);
      currentHeight = totalHeightWithGroup;
      i = j;
      continue;
    }

    // Check if the sender group itself is too large for a single section
    if (groupHeight > currentAvailableHeight) {
      // Need to split the sender group across multiple sections
      let groupIndex = 0;

      while (groupIndex < senderGroup.length) {
        // Finalize current section if it has messages
        if (currentSection !== null && (currentSection as MessageSection).messages.length > 0) {
          finalizeSection();
        }

        // Start a new section if needed
        if (currentSection === null) {
          startSectionForMessage(senderGroup[groupIndex]);
        }

        // Add as many messages from the group as will fit in this section
        let sectionHeight = 0;
        const messagesInThisChunk: Message[] = [];

        while (groupIndex < senderGroup.length) {
          const messageHeight = estimateMessageHeight(senderGroup[groupIndex]);
          const messageGap = messagesInThisChunk.length > 0 ? 6 : 0; // MESSAGE_GAP
          const newHeight = sectionHeight + messageGap + messageHeight;

          // Always add at least one message, even if it's too tall
          // This prevents infinite loops for extremely large single messages
          if (messagesInThisChunk.length === 0 || newHeight + 12 <= currentAvailableHeight) {
            messagesInThisChunk.push(senderGroup[groupIndex]);
            sectionHeight = newHeight;
            groupIndex++;
          } else {
            break;
          }
        }

        if (currentSection !== null && messagesInThisChunk.length > 0) {
          const section = currentSection as MessageSection;
          section.messages.push(...messagesInThisChunk);
          currentHeight = sectionHeight + 12; // GROUP_MARGIN only, no extra buffer
        }

        // If there are more messages in the group, finalize this section
        if (groupIndex < senderGroup.length) {
          finalizeSection();
        }
      }

      i = j;
      continue;
    }

    if (currentSection === null || (currentSection as MessageSection).messages.length === 0) {
      if (currentSection === null) {
        startSectionForMessage(senderGroup[0]);
      }
      if (currentSection !== null) {
        const section = currentSection as MessageSection;
        section.messages.push(...senderGroup);
      }
      finalizeSection();
      i = j;
      continue;
    }

    finalizeSection();
    startSectionForMessage(senderGroup[0]);
    if (currentSection !== null) {
      const section = currentSection as MessageSection;
      section.messages.push(...senderGroup);
      currentHeight = estimateGroupHeight(senderGroup);
    }
    i = j;
  }

  finalizeSection();

  const totalMessages = sections.reduce((sum, section) => sum + section.messages.length, 0);

  sections.forEach((section) => {
    const chunkMessages = section.messages;
    if (chunkMessages.length === 0) {
      return;
    }
  });

  if (totalMessages !== messages.length) {
    console.error(`\n❌ CRITICAL: Lost ${messages.length - totalMessages} messages!`);
    return [
      {
        messages,
        showTopBar: true,
        conversationRecipientName: messages[0]?.conversationRecipientName,
        conversationId: messages[0]?.conversationId,
        theme: (messages[0]?.activeTheme ?? THEME.LIGHT) as Theme,
      },
    ];
  }

  return sections;
};
