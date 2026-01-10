import { ChatSettings, Message, THEME } from "../types/constants";

export const THEME_COMMAND_REGEX = />\s*change\s+theme\s+to\s+(light|dark)\s*</i;
export const CONVERSATION_COMMAND_REGEX = />\s*conversation\s+with\s+(.+?)\s*</i;
export const ARROW_COMMAND_REGEX = />\s*(arrow\s*down|show\s*arrow)\s*</i;
export const IMAGE_COMMAND_REGEX = /^\s*(?:me:|them:).*?>\s*image\s+(.+?)\s*</i;

type ApplyCommandsResult = {
  messages: Message[];
  chatSettings: ChatSettings;
};

export const applyMessageCommands = (
  messages: Message[],
  chatSettings: ChatSettings,
): ApplyCommandsResult => {
  const nextSettings: ChatSettings = { ...chatSettings };

  const hasCommands = messages.some((msg) => msg.type === "command");
  const hasConversationMetadata = messages.some(
    (msg) =>
      msg.conversationId !== undefined ||
      msg.startsConversation !== undefined ||
      msg.conversationRecipientName !== undefined ||
      msg.activeTheme !== undefined,
  );

  if (!hasCommands && hasConversationMetadata) {
    const normalizedMessages = messages.map((msg, index) => {
      if (index === 0 && msg.startsConversation !== true) {
        return { ...msg, startsConversation: true };
      }
      return msg;
    });

    const lastWithRecipient = [...normalizedMessages]
      .reverse()
      .find((msg) => msg.conversationRecipientName);
    if (lastWithRecipient?.conversationRecipientName) {
      nextSettings.recipientName = lastWithRecipient.conversationRecipientName;
    }

    const lastWithTheme = [...normalizedMessages]
      .reverse()
      .find((msg) => msg.activeTheme);
    if (lastWithTheme?.activeTheme) {
      nextSettings.theme = lastWithTheme.activeTheme;
    }

    return { messages: normalizedMessages, chatSettings: nextSettings };
  }

  const renderableMessages: Message[] = [];

  let currentRecipientName = chatSettings.recipientName ?? "";
  let currentTheme = chatSettings.theme ?? THEME.LIGHT;
  let pendingConversationStart = true;
  let conversationId = -1;
  let markNextWithArrow = false;

  for (const message of messages) {
    if (message.type === "command") {
      const trimmed = message.text?.trim() ?? "";

      const themeMatch = trimmed.match(THEME_COMMAND_REGEX);
      if (themeMatch) {
        const requestedTheme = themeMatch[1].toLowerCase();
        if (requestedTheme === THEME.DARK || requestedTheme === THEME.LIGHT) {
          currentTheme = requestedTheme;
        }
      }

      const conversationMatch = trimmed.match(CONVERSATION_COMMAND_REGEX);
      if (conversationMatch) {
        const requestedName = conversationMatch[1].trim();
        if (requestedName) {
          currentRecipientName = requestedName;
          pendingConversationStart = true;
        }
      }

      if (ARROW_COMMAND_REGEX.test(trimmed)) {
        markNextWithArrow = true;
      }

      continue;
    }

    if (pendingConversationStart) {
      conversationId += 1;
    }

    const messageTheme = message.activeTheme ?? currentTheme;
    const conversationRecipientName =
      message.conversationRecipientName ?? currentRecipientName;

    const startsConversation =
      message.startsConversation ?? pendingConversationStart;
    pendingConversationStart = false;
    const showArrow = Boolean(message.showArrow || markNextWithArrow);
    markNextWithArrow = false;

    const nextMessage: Message = {
      ...message,
      startsConversation,
      conversationId,
      conversationRecipientName,
      activeTheme: messageTheme,
      showArrow,
    };

    renderableMessages.push(nextMessage);

    if (conversationRecipientName) {
      currentRecipientName = conversationRecipientName;
    }
    currentTheme = messageTheme;
  }

  if (renderableMessages.length > 0 && renderableMessages[0].startsConversation !== true) {
    renderableMessages[0] = {
      ...renderableMessages[0],
      startsConversation: true,
    };
  }

  if (renderableMessages.length > 0) {
    const lastMessage = renderableMessages[renderableMessages.length - 1];
    if (lastMessage.conversationRecipientName) {
      nextSettings.recipientName = lastMessage.conversationRecipientName;
    } else if (currentRecipientName) {
      nextSettings.recipientName = currentRecipientName;
    }
    if (lastMessage.activeTheme) {
      nextSettings.theme = lastMessage.activeTheme;
    } else {
      nextSettings.theme = currentTheme;
    }
  } else {
    nextSettings.theme = currentTheme;
    if (currentRecipientName) {
      nextSettings.recipientName = currentRecipientName;
    }
  }

  return { messages: renderableMessages, chatSettings: nextSettings };
};
