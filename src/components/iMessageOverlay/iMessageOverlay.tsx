import React, { useMemo } from "react";
import Image from "next/image";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  Sequence,
  Html5Audio,
  staticFile,
  getRemotionEnvironment,
} from "remotion";
import {
  Message,
  ChatSettings,
  ChatIntroAnimation,
  THEME_MAP,
  FRAMES_AFTER_LAST_MESSAGE,
  IMESSAGE_FONT_SIZE_PERCENT,
  defaultMyCompProps,
  VIDEO_HEIGHT,
  VIDEO_FPS,
  DEFAULT_CHARS_PER_SECOND,
  MonetizationSettings,
  CHAT_SHADOW_PRESETS,
  CHAT_INTRO_ANIMATIONS,
  RIZZ_MONETIZATION_CATEGORY,
} from "../../types/constants";
import { chunkMessagesByHeight, MessageSection } from "../../helpers/sectionUtils";
import { Topbar } from "./Topbar";
import { groupMessagesBySender } from "./groupMessagesBySender";
import { getMessageDurationInFrames } from "../../helpers/chatTiming";
import { ArrowDown } from "../ArrowDown";
import { MonetizationChat } from "../MonetizationChat/MonetizationChat";
import { RizzMonetization } from "../MonetizationChat/RizzMonetization";

const CENSOR_MARKER = "*";
const CENSOR_BLUR_STYLE: React.CSSProperties = {
  filter: "blur(8px)",
  WebkitFilter: "blur(8px)",
  display: "inline-block",
};

type CensoredSegment = {
  text: string;
  blurred: boolean;
};

const getCensoredSegments = (text: string): CensoredSegment[] => {
  const segments: CensoredSegment[] = [];
  let buffer = "";
  let blurred = false;

  const flushBuffer = () => {
    if (buffer) {
      segments.push({ text: buffer, blurred });
      buffer = "";
    }
  };

  for (const char of text) {
    if (char === CENSOR_MARKER) {
      flushBuffer();
      blurred = !blurred;
      continue;
    }

    buffer += char;
  }

  flushBuffer();
  return segments;
};

const renderCensoredText = (text: string) => {
  return getCensoredSegments(text).map((segment, index) => (
    <React.Fragment key={`censor-${index}`}>
      {segment.blurred ? (
        <span style={CENSOR_BLUR_STYLE}>{segment.text || "\u00A0"}</span>
      ) : (
        segment.text
      )}
    </React.Fragment>
  ));
};


type IMessageOverlayProps = {
  messages: Message[];
  CHAT_SETTINGS?: ChatSettings;
  hiddenRanges?: { start: number; end: number }[];
  monetization?: MonetizationSettings;
};


/** ====== Small presentational piece ====== */
const MessageBubble: React.FC<{
  msg: Message;
  frame: number;
  isMe: boolean;
  colors: ReturnType<typeof pickBubbleColors>;
  isLastInGroup: boolean;
  enableAnimation: boolean;
  nextMessageAppearAt?: number;
}> = ({ msg, frame, isMe, colors, isLastInGroup, enableAnimation, nextMessageAppearAt }) => {
  let fade = 1;
  let y = 0;
  const arrowOffset = Math.sin(frame / 10) * 4;

  // appearAt is already adjusted in previewBuilder, no need to add sectionDelay
  const adjustedAppearAt = msg.appearAt;

  if (enableAnimation) {
    const entrance = spring({
      frame: frame - adjustedAppearAt,
      fps: VIDEO_FPS,
      config: { damping: 200, stiffness: 100 },
    });


    fade = interpolate(entrance, [0, 1], [0, 1]);
    y = interpolate(entrance, [0, 1], [20, 0]);
  }


  const shouldShowArrow = msg.showArrow &&
    frame >= adjustedAppearAt &&
    (nextMessageAppearAt === undefined || frame < nextMessageAppearAt);

  const isImageMessage = msg.type === "image" && msg.imageUrl;

  return (
    <>
      {shouldShowArrow && (
        <div
          style={{
            position: "absolute",
            bottom: "30%",
            left: "10%",
            transform: `translateX(-50%) translateY(${arrowOffset}px)`,
            color: isMe ? colors.textMe : colors.textThem,
            fontWeight: 700,
            fontSize: "0.9em",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            textShadow: "0 4px 12px rgba(0,0,0,0.35)",
          }}
          aria-label="Down arrow call-out"
        >
          <ArrowDown />
        </div>
      )}
      <div
        style={{
          alignSelf: isMe ? "flex-end" : "flex-start",
          backgroundColor: isMe ? colors.bubbleMe : colors.bubbleThem,
          color: isMe ? colors.textMe : colors.textThem,
          padding: isImageMessage ? "4px" : "9px 20px",
          borderRadius: isImageMessage ? 16 : 32,
          maxWidth: "75%",
          width: "fit-content",
          fontSize: "1em",
          opacity: fade,
          transform: `translateY(${y}px)`,
          lineHeight: "1.3",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          position: "relative",
          fontWeight: isMe ? 300 : 400,
          overflow: "visible",
        }}
      >
        {isImageMessage && msg.imageUrl ? (
          <Image
            src={msg.imageUrl}
            alt={msg.imageName || "Image"}
            width={400}
            height={400}
            unoptimized
            style={{
              maxWidth: "100%",
              maxHeight: 400,
              borderRadius: 12,
              display: "block",
            }}
          />
        ) : (
          renderCensoredText(msg.text)
        )}
        {isLastInGroup && (
          <>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                width: 20,
                height: 27,
                backgroundColor: isMe ? colors.bubbleMe : colors.bubbleThem,
                ...(isMe
                  ? {
                      right: -7,
                      borderBottomLeftRadius: "16px 14px",
                    }
                  : {
                      left: -7,
                      borderBottomRightRadius: "16px 14px",
                    }),
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                width: 26,
                height: 27,
                backgroundColor: colors.cardBg,
                ...(isMe
                  ? {
                      right: -26,
                      borderBottomLeftRadius: 10,
                    }
                  : {
                      left: -26,
                      borderBottomRightRadius: 10,
                    }),
              }}
            />
          </>
        )}
      </div>
    </>
  );
};


const pickBubbleColors = (settings: ChatSettings) => {
  const theme = THEME_MAP[settings.theme];
  return {
    bubbleMe: theme.meBubble!,
    bubbleThem: theme.themBubble!,
    textMe: theme.textMe!,
    textThem: theme.textThem!,
    timestamp: theme.timestamp!,
    cardBg: theme.background,
    shadow: theme.shadow!,
  };
};

const getShadowForChat = (settings: ChatSettings, fallbackShadow?: string) => {
  const preset = CHAT_SHADOW_PRESETS.find(
    (item) => item.value === settings.chatShadowPreset
  );
  if (preset) {
    return preset.shadow;
  }
  return fallbackShadow ?? "none";
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const getIntroAnimationStyle = (
  animation: ChatIntroAnimation,
  frameOffset: number,
  durationMs: number,
): React.CSSProperties => {
  if (animation === CHAT_INTRO_ANIMATIONS.NONE) {
    return {};
  }

  const durationInFrames = Math.max(
    1,
    Math.round((durationMs / 1000) * VIDEO_FPS),
  );

  const progress = clamp01(
    spring({
      frame: Math.max(frameOffset, 0),
      fps: VIDEO_FPS,
      durationInFrames,
      config: { damping: 18, stiffness: 160, mass: 0.9 },
    }),
  );

  switch (animation) {
    case CHAT_INTRO_ANIMATIONS.FADE_IN:
      return { opacity: progress };
    case CHAT_INTRO_ANIMATIONS.SCALE_DOWN: {
      const scale = interpolate(progress, [0, 1], [1.15, 1]);
      return { opacity: progress, transform: `scale(${scale})` };
    }
    case CHAT_INTRO_ANIMATIONS.SLIDE_DOWN: {
      const translateY = interpolate(progress, [0, 1], [-14, 0]);
      return { opacity: progress, transform: `translateY(${translateY}px)` };
    }
    case CHAT_INTRO_ANIMATIONS.SLIDE_IN_FADE: {
      const translateY = interpolate(progress, [0, 1], [16, 0]);
      return { opacity: progress, transform: `translateY(${translateY}px)` };
    }
    case CHAT_INTRO_ANIMATIONS.BLUR_IN: {
      const blur = interpolate(progress, [0, 1], [4, 0]);
      return { opacity: progress, filter: `blur(${blur}px)` };
    }
    default:
      return {};
  }
};

const getOutroAnimationStyle = (
  animation: ChatIntroAnimation,
  frame: number,
  outroStartFrame: number,
  durationMs: number,
): React.CSSProperties => {
  if (animation === CHAT_INTRO_ANIMATIONS.NONE) {
    return {};
  }

  const durationInFrames = Math.max(
    1,
    Math.round((durationMs / 1000) * VIDEO_FPS),
  );
  const localFrame = frame - outroStartFrame;
  if (localFrame < 0) {
    return {};
  }

  const progress = clamp01(
    spring({
      frame: localFrame,
      fps: VIDEO_FPS,
      durationInFrames,
      config: { damping: 18, stiffness: 160, mass: 0.9 },
    }),
  );

  switch (animation) {
    case CHAT_INTRO_ANIMATIONS.FADE_IN:
      return { opacity: 1 - progress };
    case CHAT_INTRO_ANIMATIONS.SCALE_DOWN: {
      const scale = interpolate(progress, [0, 1], [1, 1.15]);
      return { opacity: 1 - progress, transform: `scale(${scale})` };
    }
    case CHAT_INTRO_ANIMATIONS.SLIDE_DOWN: {
      const translateY = interpolate(progress, [0, 1], [0, -14]);
      return { opacity: 1 - progress, transform: `translateY(${translateY}px)` };
    }
    case CHAT_INTRO_ANIMATIONS.SLIDE_IN_FADE: {
      const translateY = interpolate(progress, [0, 1], [0, 16]);
      return { opacity: 1 - progress, transform: `translateY(${translateY}px)` };
    }
    case CHAT_INTRO_ANIMATIONS.BLUR_IN: {
      const blur = interpolate(progress, [0, 1], [0, 4]);
      return { opacity: 1 - progress, filter: `blur(${blur}px)` };
    }
    default:
      return {};
  }
};


export const IMessageOverlay: React.FC<IMessageOverlayProps> = ({
  messages,
  CHAT_SETTINGS,
  hiddenRanges,
  monetization,
}) => {
  const frame = useCurrentFrame();
  const remotionEnv = useMemo(() => getRemotionEnvironment(), []);
  const gapOpacity = remotionEnv.isRendering ? 0 : 1;


  const settings = useMemo<ChatSettings>(
    () => ({
      ...defaultMyCompProps.CHAT_SETTINGS,
      ...(CHAT_SETTINGS ?? {}),
    }),
    [CHAT_SETTINGS],
  );


  const marginTop =
    settings.marginTop ?? defaultMyCompProps.CHAT_SETTINGS.marginTop;
  const marginBottom =
    settings.marginBottom ?? defaultMyCompProps.CHAT_SETTINGS.marginBottom;


  /** Split into screens based on available height */
  const messageSections = useMemo<MessageSection[]>(() => {
    // Calculate max height for message container
    const maxContainerHeight = VIDEO_HEIGHT - marginTop - marginBottom;


    return chunkMessagesByHeight(
      messages,
      maxContainerHeight,
      CHAT_SETTINGS?.showTopBarFirstOnly ?? true,
    );
  }, [messages, marginTop, marginBottom, CHAT_SETTINGS?.showTopBarFirstOnly]);


  const monetizationRange = useMemo(() => {
    if (!monetization || !monetization.durationInFrames || monetization.durationInFrames <= 0) {
      return null;
    }
    const start = monetization.startFrame ?? 0;
    const end = start + monetization.durationInFrames;
    return { start, end };
  }, [monetization]);


  const rizzConfig = monetization?.rizz_config;
  const isRizzMonetization =
    monetization?.category === RIZZ_MONETIZATION_CATEGORY;

  // For Rizz monetization, extract audio paths and display content
  const rizzImage = rizzConfig?.image?.trim() || "";
  const rizzReplyText = rizzConfig?.reply_visual?.trim() || "";
  const rizzReplyAudioPath = rizzConfig?.reply_audio_path?.trim() || undefined;

  // Note: Intro audio is stored in monetization.startMessageAudioPath (not in rizz_config)
  // because it's shared with the regular monetization flow
  const rizzIntroMessageAudioPath = monetization?.startMessageAudioPath?.trim() || undefined;

  const isChatHidden =
    (hiddenRanges?.some((range) => frame >= range.start && frame < range.end) ?? false) ||
    Boolean(monetizationRange && frame >= monetizationRange.start && frame < monetizationRange.end);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
        backgroundColor: "transparent",
        fontFamily: "Inter, 'Noto Color Emoji', 'Apple Color Emoji', 'Inter', 'Segoe UI Emoji', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
      }}
    >
      {monetizationRange ? (
        <Sequence
          from={monetizationRange.start}
          durationInFrames={monetizationRange.end - monetizationRange.start}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Top Gap */}
          <div
            style={{
              background: "rgba(0,0,0,0.7)",
              color: "white",
              fontSize: "2rem",
              overflow: "hidden",
              height: marginTop,
              width: "100%",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              opacity: gapOpacity,
            }}
          >
            <div>
              Top Gap
              <div className="note" style={{ opacity: 0.7 }}>
                (Will be transparent in final render)
              </div>
            </div>
          </div>

          {/* Monetization Chat Container */}
          <div
            style={{
              width: "60%",
              height: VIDEO_HEIGHT - marginTop - marginBottom,
              flexShrink: 0,
            }}
          >
            {isRizzMonetization ? (
              <RizzMonetization
                image={rizzImage}
                replyText={rizzReplyText}
                replyStartFrame={monetization?.rizzReplyStartFrame}
                introMessageAudioPath={rizzIntroMessageAudioPath}
                replyAudioPath={rizzReplyAudioPath}
              />
            ) : (
              <MonetizationChat
                category={monetization?.category ?? "Monetization"}
                campaign={monetization?.campaign ?? ""}
                profilePicture={monetization?.profilePicture}
                messages={monetization?.messages ?? []}
                startMessageAudioPath={monetization?.startMessageAudioPath}
                maxContainerHeight={VIDEO_HEIGHT - marginTop - marginBottom}
                textAnimation={settings.textAnimation}
              />
            )}
          </div>

          {/* Bottom Gap */}
          <div
            style={{
              background: "rgba(0,0,0,0.7)",
              color: "white",
              fontSize: "2rem",
              overflow: "hidden",
              height: marginBottom,
              width: "100%",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              opacity: gapOpacity,
            }}
          >
            <div>
              Bottom Gap
              <div className="note" style={{ opacity: 0.7 }}>
                (Will be transparent in final render)
              </div>
            </div>
          </div>
        </Sequence>
      ) : null}


      {!isChatHidden && (
        <>
          {/* Render audio sequences - timing is already adjusted in messages */}
          {messages
            .filter((msg) => msg.audioPath && msg.type !== "promotion")
            .map((msg, idx) => {
              // Use the pre-adjusted appearAt directly
              return (
                <Sequence key={`audio-${idx}`} from={msg.appearAt}>
                  <Html5Audio src={msg.audioPath!.startsWith("http") ? msg.audioPath! : staticFile(msg.audioPath!)} />
                </Sequence>
              );
            })}


          {messageSections.map((section, index) => {
            const sectionMessages = section.messages;
            if (!sectionMessages.length) {
              return null;
            }

            const showTopBar = section.showTopBar;

            // CRITICAL LOGGING: Log section rendering info
            if (remotionEnv.isRendering && frame === 0) {
              console.log(`\n[SECTION ${index}] ${sectionMessages.length} messages, first: "${sectionMessages[0]?.text?.substring(0, 30)}"`);
            }

            const sectionThemeKey = section.theme ?? settings.theme;
            const sectionTheme = THEME_MAP[sectionThemeKey];
            const sectionSettings: ChatSettings = {
              ...settings,
              theme: sectionThemeKey,
              recipientName: section.conversationRecipientName ?? settings.recipientName,
            };
            const sectionBubbleColors = pickBubbleColors(sectionSettings);

            // SIMPLIFIED: Since appearAt is already adjusted for outro delays in previewBuilder,
            // we just use the first message's appearAt as the section start
            const firstMessage = sectionMessages[0];
            const lastMessage = sectionMessages[sectionMessages.length - 1];

            // Section starts when the first message appears (already adjusted for all delays)
            const startFrame = firstMessage.appearAt;

            const lastMessageDuration = getMessageDurationInFrames(
              lastMessage,
              VIDEO_FPS,
              DEFAULT_CHARS_PER_SECOND,
              true,
            );
            const lastMessageEndFrame = lastMessage.appearAt + lastMessageDuration;

            const nextFirstMessage = index < messageSections.length - 1
              ? messageSections[index + 1].messages[0]
              : null;
            const nextStart = nextFirstMessage ? nextFirstMessage.appearAt : Infinity;
            const nextSection = messageSections[index + 1];
            const nextStartsConversation =
              nextSection?.messages[0]?.startsConversation ?? false;

            // Calculate outro animation duration in frames
            const outroDurationMs =
              sectionSettings.chatOutroAnimationDurationMs ??
              defaultMyCompProps.CHAT_SETTINGS.chatOutroAnimationDurationMs;
            const outroDurationInFrames = Math.max(
              1,
              Math.round((outroDurationMs / 1000) * VIDEO_FPS),
            );
            const outroAnimation = sectionSettings.chatOutroAnimation ?? CHAT_INTRO_ANIMATIONS.NONE;
            const hasOutroAnimation = outroAnimation !== CHAT_INTRO_ANIMATIONS.NONE;

            // Check if we're transitioning into monetization
            const isTransitioningToMonetization =
              monetizationRange &&
              lastMessageEndFrame + FRAMES_AFTER_LAST_MESSAGE <= monetizationRange.start &&
              (index === messageSections.length - 1 ||
               (nextSection && nextSection.messages[0]?.appearAt >= monetizationRange.start));

            const shouldPlayOutro =
              (index === messageSections.length - 1 || nextStartsConversation) &&
              hasOutroAnimation &&
              !isTransitioningToMonetization;

            // Outro starts immediately after last message if enabled, otherwise add FRAMES_AFTER_LAST_MESSAGE
            const outroStartFrame = lastMessageEndFrame;
            const endFrame = shouldPlayOutro
              ? lastMessageEndFrame + outroDurationInFrames
              : lastMessageEndFrame + FRAMES_AFTER_LAST_MESSAGE;

            // Extend current section to 1 frame past next section's start (to create overlap)
            // But don't go beyond the natural endFrame if next section starts later
            let duration: number;
            if (index < messageSections.length - 1) {
              // Not the last section
              if (shouldPlayOutro) {
                // Conversation is changing, so we need outro animation
                // Duration should be from start to endFrame (which already includes outro)
                duration = endFrame - startFrame;
              } else {
                // No outro, end exactly when next section starts (no overlap)
                duration = nextStart - startFrame;
              }
            } else {
              // Last section: endFrame already includes outro time if enabled
              duration = endFrame - startFrame;

              // CRITICAL VALIDATION: For the last section, ensure duration is NEVER too short
              // This prevents the video from cutting off before all messages are shown
              const minimumDuration = (lastMessage.appearAt - startFrame) + lastMessageDuration + FRAMES_AFTER_LAST_MESSAGE;
              if (duration < minimumDuration) {
                duration = minimumDuration;
              }

              // Log last section details
              if (remotionEnv.isRendering && frame === 0) {
                console.log(`\n[LAST SECTION TIMING]`);
                console.log(`  Start frame: ${startFrame}`);
                console.log(`  Duration: ${duration} frames (${(duration / VIDEO_FPS).toFixed(2)}s)`);
                console.log(`  End frame: ${startFrame + duration}`);
                console.log(`  Last message: "${lastMessage.text}"`);
                console.log(`  Last message starts: ${lastMessage.appearAt}`);
                console.log(`  Last message duration: ${lastMessageDuration}`);
                console.log(`  Last message ends: ${lastMessage.appearAt + lastMessageDuration}`);
              }
            }

            // CRITICAL VALIDATION: Check for invalid section timing
            if (duration <= 0) {
              console.error(`[SECTION ${index}] ERROR: Invalid duration ${duration}! startFrame=${startFrame}, endFrame=${endFrame}`);
              duration = 100; // Emergency fallback
            }

            if (startFrame < 0) {
              console.error(`[SECTION ${index}] ERROR: Negative startFrame ${startFrame}!`);
            }

            // Log all section timings at frame 0
            if (remotionEnv.isRendering && frame === 0) {
              console.log(`[SECTION ${index}] Sequence: from=${startFrame}, duration=${duration}, ends=${startFrame + duration}`);
            }

            const firstMsgFrame = sectionMessages[0].appearAt;
            const tsOpacity = interpolate(
              frame,
              [firstMsgFrame - 1, firstMsgFrame + 8],
              [0, 0.7],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );

            const shouldPlayIntro =
              index === 0 || Boolean(sectionMessages[0]?.startsConversation);
            // Use the adjusted startFrame for intro animation timing
            const introStyle = shouldPlayIntro
              ? getIntroAnimationStyle(
                  sectionSettings.chatIntroAnimation ??
                    CHAT_INTRO_ANIMATIONS.NONE,
                  frame - startFrame,
                  sectionSettings.chatIntroAnimationDurationMs ??
                    defaultMyCompProps.CHAT_SETTINGS
                      .chatIntroAnimationDurationMs,
                )
              : {};
            const outroStyle = shouldPlayOutro
              ? getOutroAnimationStyle(
                  sectionSettings.chatOutroAnimation ??
                    CHAT_INTRO_ANIMATIONS.NONE,
                  frame,
                  outroStartFrame, // Outro starts immediately after last message completes
                  outroDurationMs,
                )
              : {};


            return (
              <Sequence
                key={index}
                from={startFrame}
                durationInFrames={duration}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    background: "rgba(0,0,0,0.7)",
                    color: "white",
                    fontSize: "2rem",
                    overflow: "hidden",
                    height: marginTop,
                    width: "100%",
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                    opacity: gapOpacity,
                  }}
                >
                  <div>
                    Top Gap
                    <div className="note" style={{ opacity: 0.7 }}>
                      (Will be transparent in final render)
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    width: "70%",
                    height: VIDEO_HEIGHT - marginTop - marginBottom,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      backgroundColor: sectionTheme.background,
                      ...introStyle,
                      ...outroStyle,
                      borderRadius: CHAT_SETTINGS?.roundedCorners
                        ? CHAT_SETTINGS.roundedCornersRadius
                        : 0,
                      boxShadow: getShadowForChat(sectionSettings, sectionTheme.shadow),
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      fontSize: `${IMESSAGE_FONT_SIZE_PERCENT}%`,
                      boxSizing: "border-box",
                    }}
                  >
                    {/* === Top chrome (Topbar + timestamp) measured as one block === */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        flexShrink: 0,
                      }}
                    >
                      {showTopBar && (
                        <Topbar
                          {...sectionSettings}
                        />
                      )}
                      {showTopBar && settings.conversationStartTime && (
                        <p
                          style={{
                            width: "100%",
                            textAlign: "center",


                            color: sectionTheme.textPrimary,
                            fontSize: "0.675em",
                            fontWeight: 500,
                            paddingBottom: "12px",
                            paddingTop: "25px",
                            opacity: tsOpacity,
                          }}
                        >
                          Today at {settings.conversationStartTime}
                        </p>
                      )}
                    </div>


                    {/* === Messages (only mount when they start) === */}
                    <div
                      style={{
                        flex: 1,
                        padding: "20px 30px 0px 30px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        boxSizing: "border-box",
                        minHeight: 0, // Allow shrinking to 0 when empty
                      }}
                    >
                      {(() => {
                        // Get all messages from current and future sections to find next message
                        const allFutureMessages: Message[] = [];
                        for (let i = index; i < messageSections.length; i++) {
                          allFutureMessages.push(
                            ...messageSections[i].messages.filter(
                              (msg) => msg.type !== "promotion"
                            )
                          );
                        }


                        // Create a map of message to next message's appearAt
                        const nextMessageMap = new Map<Message, number | undefined>();
                        allFutureMessages.forEach((msg, msgIdx) => {
                          const nextMsg = allFutureMessages[msgIdx + 1];
                          nextMessageMap.set(msg, nextMsg?.appearAt);
                        });


                        const filteredMessages = sectionMessages.filter(
                          (msg) => {
                            // appearAt is already adjusted, use it directly
                            // Filter out command messages but keep text and image messages
                            return frame >= msg.appearAt - 1 && msg.type !== "command";
                          }
                        );

                        return groupMessagesBySender(filteredMessages).map((group, groupIndex) => {
                          const isMe = group[0].sender === "me";


                          return (
                            <div
                              key={`group-${index}-${groupIndex}`}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                marginBottom: "12px",
                                alignItems: isMe ? "flex-end" : "flex-start",
                              }}
                            >
                              {group.map((msg, msgIndex) => {
                                const isLastInGroup = msgIndex === group.length - 1;
                                const nextMessageAppearAt = nextMessageMap.get(msg);
                                // appearAt is already adjusted, use message as-is
                                return (
                                  <MessageBubble
                                    msg={msg}
                                    key={`${index}-${groupIndex}-${msgIndex}`}
                                    frame={frame}
                                    isMe={isMe}
                                    colors={sectionBubbleColors}
                                    isLastInGroup={isLastInGroup}
                                    enableAnimation={settings.textAnimation}
                                    nextMessageAppearAt={nextMessageAppearAt}
                                  />
                                );
                              })}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>


                <div
                  style={{
                    background: "rgba(0,0,0,0.7)",
                    color: "white",
                    fontSize: "2rem",
                    overflow: "hidden",
                    height: marginBottom,
                    width: "100%",
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                    opacity: gapOpacity,
                  }}
                >
                  <div>
                    Bottom Gap
                    <div className="note" style={{ opacity: 0.7 }}>
                      (Will be transparent in final render)
                    </div>
                  </div>
                </div>
              </Sequence>
            );
          })}
        </>
      )}
    </AbsoluteFill>
  );
};
