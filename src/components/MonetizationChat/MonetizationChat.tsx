import React, { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import {
  Html5Audio,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { chunkMessagesByHeight, MessageSection } from "../../helpers/sectionUtils";
import { getMessageDurationInFrames } from "../../helpers/chatTiming";
import {
  DEFAULT_CHARS_PER_SECOND,
  FRAMES_AFTER_LAST_MESSAGE,
  VIDEO_FPS,
  getMonetizationCampaignConfig,
} from "../../types/constants";

type MonetizationChatMessage = {
  id: string;
  text: string;
  sender: "me" | "them";
  appearAt?: number;
  audioDuration?: number;
  audioPath?: string;
};

type MonetizationSectionMessage = MessageSection["messages"][number] & { id?: string };
type MonetizationSection = MessageSection & {
  messages: MonetizationSectionMessage[];
  startFrame: number;
  endFrame: number;
};

export type MonetizationChatProps = {
  category: string;
  campaign: string;
  profilePicture?: string;
  messages: MonetizationChatMessage[];
  startMessageAudioPath?: string;
  maxContainerHeight: number;
  textAnimation?: boolean;
};

const APP_LOGO_SRC =
  "https://br-max.s3.ap-south-1.amazonaws.com/CantinaAppLogo.png";
const DEFAULT_BOT_AVATAR_SRC =
  "https://br-max.s3.ap-south-1.amazonaws.com/RoastBotLogo.webp";
const MESSAGE_PADDING_TOP = 40;
const MESSAGE_PADDING_BOTTOM = 52;

export const MonetizationChat: React.FC<MonetizationChatProps> = ({
  category,
  campaign,
  profilePicture,
  messages,
  maxContainerHeight,
  startMessageAudioPath,
  textAnimation = true,
}) => {
  const botName = campaign || category || "Roast bot";
  const campaignConfig = getMonetizationCampaignConfig(campaign);
  const botAvatar = (profilePicture ?? campaignConfig?.profilePicture)?.trim() || DEFAULT_BOT_AVATAR_SRC;

  const messageSections = useMemo<MonetizationSection[]>(() => {
    // Normalize messages to match the format expected by chunkMessagesByHeight
    const normalized: MonetizationSectionMessage[] = messages.map((msg, idx) => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender,
      type: "text" as const,
      audioDuration: msg.audioDuration ?? 0,
      audioPath: msg.audioPath ?? "",
      appearAt: msg.appearAt ?? 0,
      startsConversation: idx === 0,
      showArrow: false,
      conversationRecipientName: botName,
      activeTheme: "dark" as const,
    }));

    // Use the EXACT SAME chunking logic as iMessage - pass the full container height
    const sections = chunkMessagesByHeight(normalized, maxContainerHeight, false).map(
      (section) => ({ ...section, messages: section.messages as MonetizationSectionMessage[] }),
    );

    // Calculate frame ranges for each section (SAME as iMessage)
    return sections.map((section, idx) => {
      const sectionMessages = section.messages;
      if (!sectionMessages.length) {
        return { ...section, startFrame: 0, endFrame: 0 };
      }

      const startFrame = sectionMessages[0].appearAt;
      const lastMessage = sectionMessages[sectionMessages.length - 1];
      const lastMessageDuration = getMessageDurationInFrames(
        lastMessage,
        VIDEO_FPS,
        DEFAULT_CHARS_PER_SECOND,
        true,
      );
      const endFrame = lastMessage.appearAt + lastMessageDuration + FRAMES_AFTER_LAST_MESSAGE;

      const nextStart = idx < sections.length - 1
        ? sections[idx + 1].messages[0]?.appearAt ?? Infinity
        : Infinity;

      const duration = idx < sections.length - 1
        ? nextStart + 1 - startFrame // Always extend to next section + 1 frame overlap
        : endFrame - startFrame; // Last section: use natural duration

      console.log(`Section ${idx}: frames ${startFrame}-${startFrame + duration}, ${sectionMessages.length} messages`);

      return {
        ...section,
        startFrame,
        endFrame: startFrame + duration,
      };
    });
  }, [messages, botName, maxContainerHeight]);

  const introDuration = messageSections.length > 0 ? messageSections[0].startFrame : 0;

  const audioTracks = useMemo(() => {
    const tracks: Array<{ key: string; from: number; src: string }> = [];

    if (startMessageAudioPath?.trim()) {
      tracks.push({
        key: "monetization-start",
        from: 0,
        src: startMessageAudioPath,
      });
    }

    for (const msg of messages) {
      if (!msg.audioPath) continue;
      const source = msg.audioPath.trim();
      if (!source) continue;
      tracks.push({
        key: msg.id,
        from: msg.appearAt ?? 0,
        src: source,
      });
    }

    return tracks;
  }, [messages, startMessageAudioPath]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {audioTracks.map((track) => (
        <Sequence key={track.key} from={track.from}>
          <Html5Audio src={track.src.startsWith("http") ? track.src : staticFile(track.src)} />
        </Sequence>
      ))}

      {introDuration > 0 && (
        <Sequence key="monetization-intro" from={0} durationInFrames={introDuration}>
          <MonetizationChatSection
            messages={[]}
            botName={botName}
            botAvatar={botAvatar}
            sectionIndex={-1}
            sectionStartFrame={0}
            showMessages={false}
            enableAnimation={textAnimation}
          />
        </Sequence>
      )}

      {messageSections.map((section, sectionIndex) => {
        const sectionMessages = section.messages;
        if (!sectionMessages.length) return null;

        return (
          <Sequence
            key={`monetization-section-${sectionIndex}`}
            from={section.startFrame}
            durationInFrames={section.endFrame - section.startFrame}
          >
            <MonetizationChatSection
              messages={sectionMessages}
              botName={botName}
            botAvatar={botAvatar}
            sectionIndex={sectionIndex}
            sectionStartFrame={section.startFrame}
            enableAnimation={textAnimation}
          />
        </Sequence>
      );
    })}
    </div>
  );
};

// Section component - FIXED HEIGHT like iMessage
const MonetizationChatSection: React.FC<{
  messages: MonetizationSectionMessage[];
  botName: string;
  botAvatar: string;
  sectionIndex: number;
  sectionStartFrame: number;
  showMessages?: boolean;
  enableAnimation?: boolean;
}> = ({
  messages,
  botName,
  botAvatar,
  sectionIndex,
  sectionStartFrame,
  showMessages = true,
  enableAnimation = true,
}) => {
  const frame = useCurrentFrame();

  // Calculate the relative frame within this section
  const relativeFrame = frame + sectionStartFrame;

  const visibleMessages = useMemo(
    () => messages.filter((msg) => relativeFrame >= msg.appearAt - 1),
    [messages, relativeFrame]
  );

  return (
    <div style={{ width: "100%", height: showMessages ? "100%" : "auto" }}>
      <div
        style={{
          width: "100%",
          maxHeight: "100%",
          height: "auto",
          backgroundColor: "#1b1b1a",
          overflow: "hidden",
          color: "white",
          border: "1px solid #27272a",
          boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header Logo */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "12px 0",
            flexShrink: 0,
          }}
        >
          <Img
            src={APP_LOGO_SRC}
            alt="Cantina App"
            style={{ height: 40, width: "auto", objectFit: "cover" }}
          />
        </div>

        {/* Chat Header */}
        <div
          style={{
            padding: "0 16px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
            }}
          >
            {/* Back + Chats */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <ChevronLeft size={42} strokeWidth={2.2} color="white" />
              <span style={{ marginLeft: -6, fontSize: 22, fontWeight: 500 }}>
                Chats
              </span>
            </div>

            {/* Avatar */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  overflow: "hidden",
                  backgroundColor: "#27272a",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <Img
                  src={botAvatar}
                  alt={`${botName} avatar`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>

            <div />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "6px 0",
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 500 }}>{botName}</span>
          </div>
        </div>

        {/* Messages - SAME structure as iMessage */}
        {showMessages && (
          <div
            style={{
              flex: 1,
              padding: `${MESSAGE_PADDING_TOP}px 16px ${MESSAGE_PADDING_BOTTOM}px`,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {visibleMessages.map((message, index) => {
              const isBot = message.sender === "them";
              const nextSender = visibleMessages[index + 1]?.sender;
              const isLastInGroup = nextSender !== message.sender;

              // Animation - use relativeFrame for proper timing
              let rise = 0;
              let opacity = 1;
              if (enableAnimation) {
                const delay = Math.max(0, (message.appearAt ?? 0) - relativeFrame + 12);
                rise = interpolate(delay, [0, 12], [0, 12], {
                  extrapolateLeft: "clamp",
                });
                opacity = interpolate(delay, [0, 12], [1, 0], {
                  extrapolateLeft: "clamp",
                });
              }

              return (
                <div
                  key={message.id || `msg-${sectionIndex}-${index}`}
                  style={{
                    display: "flex",
                    width: "100%",
                    justifyContent: isBot ? "flex-start" : "flex-end",
                    marginBottom: isLastInGroup ? 12 : 3,
                  }}
                >
                  {/* Left Avatar Bubble */}
                  {isBot && (
                    <div
                      style={{
                        width: 55,
                        marginRight: 8,
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isLastInGroup && (
                        <div
                          style={{
                            width: 55,
                            height: 55,
                            borderRadius: "30%",
                            overflow: "hidden",
                            backgroundColor: "#27272a",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          <Img
                            src={botAvatar}
                            alt={`${botName} avatar`}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "10px 17px",
                      backgroundColor: isBot ? "#2c2c2d" : "#00929e",
                      color: "white",
                      border: isBot ? "1px solid #414144" : "none",
                      borderRadius: isBot ? 18 : 12,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                      lineHeight: 1.4,
                      transform: `translateY(${rise}px)`,
                      opacity,
                      wordBreak: "break-word",
                    }}
                  >
                    {isBot && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontWeight: 600,
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ fontSize: 20, color: "#0b8f96" }}>
                          {botName}
                        </span>
                        <Img
                          src={staticFile("/RoastBotIcon.svg")}
                          alt="Robot Icon"
                          style={{
                            width: 18,
                            height: 18,
                            objectFit: "cover",
                          }}
                        />
                      </div>
                    )}

                    <div style={{ whiteSpace: "pre-wrap", fontSize: 29 }}>{message.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
