import { z } from "zod";
import { addAppearTimes, type RawMessage } from "../helpers/chatTiming";

export const VIDEO_FPS = 30;
export const DEFAULT_CHARS_PER_SECOND = 18;
export const DEFAULT_VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.85,
  style: 0.47,
  use_speaker_boost: true,
  speed: 1.2,
  silenceThresholdDb: -40,
  silenceMinSilenceMs: 50,
};

/** ====== Types ====== */
export const THEME = {
  LIGHT: "light",
  DARK: "dark",
} as const;

export const CHAT_INTRO_ANIMATIONS = {
  NONE: "none",
  FADE_IN: "fade_in",
  SCALE_DOWN: "scale_down",
  SLIDE_DOWN: "slide_down",
  SLIDE_IN_FADE: "slide_in_fade",
  BLUR_IN: "blur_in",
} as const;

export const CHAT_INTRO_ANIMATION_VALUES = [
  CHAT_INTRO_ANIMATIONS.NONE,
  CHAT_INTRO_ANIMATIONS.FADE_IN,
  CHAT_INTRO_ANIMATIONS.SCALE_DOWN,
  CHAT_INTRO_ANIMATIONS.SLIDE_DOWN,
  CHAT_INTRO_ANIMATIONS.SLIDE_IN_FADE,
  CHAT_INTRO_ANIMATIONS.BLUR_IN,
] as const;

export const CHAT_INTRO_ANIMATION_OPTIONS = [
  { value: CHAT_INTRO_ANIMATIONS.NONE, label: "None" },
  { value: CHAT_INTRO_ANIMATIONS.FADE_IN, label: "Fade in" },
  { value: CHAT_INTRO_ANIMATIONS.SCALE_DOWN, label: "Scale down" },
  { value: CHAT_INTRO_ANIMATIONS.SLIDE_DOWN, label: "Slide down" },
  { value: CHAT_INTRO_ANIMATIONS.SLIDE_IN_FADE, label: "Slide in + fade" },
  { value: CHAT_INTRO_ANIMATIONS.BLUR_IN, label: "Blur in" },
] as const;

export const CHAT_OUTRO_ANIMATION_OPTIONS = CHAT_INTRO_ANIMATION_OPTIONS;

export type ChatIntroAnimation = (typeof CHAT_INTRO_ANIMATION_VALUES)[number];

export type ChatOutroAnimation = ChatIntroAnimation;

export const CANTINA_MONETIZATION_CATEGORY = "Cantina Bot";
export const RIZZ_MONETIZATION_CATEGORY = "Rizz app";

export interface RizzMonetizationConfig {
  image: string;
  intro_message: string;
  intro_message_voice_id: string;
  intro_message_audio_path: string;
  intro_message_audio_duration: number;
  reply: string;
  reply_visual: string;
  reply_audio_path: string;
  reply_audio_duration: number;
}

export const DEFAULT_RIZZ_MONETIZATION_CONFIG: RizzMonetizationConfig = {
  image: "https://br-max.s3.ap-south-1.amazonaws.com/uploads/rizz/rizz_image_1764700147614.png",
  intro_message: "Rizz app tells me to say",
  intro_message_voice_id: "ASD",
  intro_message_audio_path: "https://br-max.s3.ap-south-1.amazonaws.com/audios/f9c17081-12f9-46e3-a3cd-7f50fe6cd6db_msg_1.mp3",
  intro_message_audio_duration: 1.4367291666666666,
  reply: "Reply with \"Yo why is Rizz app soo good at this? I am very impressed\"",
  reply_visual: "Yo why is Rizz app soo good at this? I am very impressed",
  reply_audio_path: "https://br-max.s3.ap-south-1.amazonaws.com/audios/f9c17081-12f9-46e3-a3cd-7f50fe6cd6db_msg_2.mp3",
  reply_audio_duration: 5.459583333333334,
};

export const MONETIZATION_CATEGORY_DEFINITIONS = [
  {
    category: CANTINA_MONETIZATION_CATEGORY,
    compaigns: ["Roast Bot"],
  },
  {
    category: RIZZ_MONETIZATION_CATEGORY,
    compaigns: ["Rizz bot"],
  },
] as const;

export type MonetizationCategoryDefinition =
  (typeof MONETIZATION_CATEGORY_DEFINITIONS)[number];
export type MonetizationCategory = MonetizationCategoryDefinition["category"];

export const MONETIZATION_CATEGORY_OPTIONS =
  MONETIZATION_CATEGORY_DEFINITIONS.map(
    (entry) => entry.category,
  ) as readonly MonetizationCategory[];

export const MONETIZATION_CAMPAIGN_OPTIONS = Array.from(
  new Set(
    MONETIZATION_CATEGORY_DEFINITIONS.flatMap((entry) => entry.compaigns),
  ),
) as readonly MonetizationCategoryDefinition["compaigns"][number][];

export const DEFAULT_MONETIZATION_CAMPAIGN =
  MONETIZATION_CATEGORY_DEFINITIONS[0]?.compaigns[0] ?? "";
export type MonetizationCampaign =
  (typeof MONETIZATION_CAMPAIGN_OPTIONS)[number];

export const getMonetizationCampaignsForCategory = (category?: string) => {
  return (
    MONETIZATION_CATEGORY_DEFINITIONS.find(
      (entry) => entry.category === category,
    )?.compaigns ?? []
  );
};
export const MONETIZATION_CAMPAIGN_MAP: Record<
  MonetizationCampaign,
  { compaignBotVoiceId: string; profilePicture: string }
> = {
  "Roast Bot": {
    compaignBotVoiceId: "pNInz6obpgDQGcFmaJgB",
    profilePicture:
      "https://br-max.s3.ap-south-1.amazonaws.com/RoastBotLogo.webp",
  },
  "Rizz bot": {
    compaignBotVoiceId: "",
    profilePicture: "",
  },
};
export const getMonetizationCampaignConfig = (campaign?: string) => {
  const key = MONETIZATION_CAMPAIGN_OPTIONS.find((opt) => opt === campaign) as
    | MonetizationCampaign
    | undefined;
  return key ? MONETIZATION_CAMPAIGN_MAP[key] : undefined;
};

export type Theme = (typeof THEME)[keyof typeof THEME];

export interface ThemeColors {
  background: string;
  topBar?: string;
  border?: string;
  primary: string;
  textPrimary: string;
  textSecondary: string;
  icon: string;
  shadow?: string;
  meBubble?: string;
  themBubble?: string;
  textMe?: string;
  textThem?: string;
  timestamp?: string;
}

export const CHAT_SHADOW_PRESETS = [
  {
    value: "none",
    label: "None",
    shadow: "none",
  },
  {
    value: "soft",
    label: "Soft",
    shadow: "8px 8px 12px 0px rgba(0,0,0,0.38)",
  },
  {
    value: "medium",
    label: "Medium",
    shadow: "12px 12px 15px 0px rgba(0,0,0,0.52)",
  },
  {
    value: "intense",
    label: "Intense",
    shadow: "15px 15px 17px 0px rgba(0,0,0,0.66)",
  },
  {
    value: "super-intense",
    label: "Super Intense",
    shadow: "20px 20px 22px 0px rgba(0,0,0,0.72)",
  },
] as const;

export type ChatShadowPreset = (typeof CHAT_SHADOW_PRESETS)[number]["value"];
export const CHAT_SHADOW_PRESET_VALUES = CHAT_SHADOW_PRESETS.map(
  (preset) => preset.value,
) as [ChatShadowPreset, ...ChatShadowPreset[]];

export const THEME_MAP: Record<Theme, ThemeColors> = {
  light: {
    background: "#ffffff",
    topBar: "rgb(246,245,246)",
    border: "rgba(0,0,0,0.3)",
    primary: "rgb(26, 121,255)",
    textPrimary: "#000000",
    textSecondary: "rgba(0,0,0,0.7)",
    icon: "rgb(26, 121,255)",
    meBubble: "rgb(26, 121,255)",
    themBubble: "#d1d1d6",
    textMe: "#ffffff",
    textThem: "#000000",
    timestamp: "rgb(138,137,142)",
    shadow: "0 8px 20px rgba(0,0,0,0.08)",
  },
  dark: {
    background: "rgb(0,0,0)",
    topBar: "rgb(30, 30, 30)",
    border: "rgba(255,255,255,0.08)",
    primary: "rgb(53,151,254)",
    textPrimary: "rgb(255,255,255)",
    textSecondary: "rgba(255,255,255,0.7)",
    icon: "rgb(0, 123, 255)",
    meBubble: "rgb(46, 147, 255)",
    themBubble: "rgb(38,38,40)",
    textMe: "rgb(245, 245, 245)",
    textThem: "rgb(245, 245, 245)",
    timestamp: "rgb(141,141,147)",
    shadow: "0 8px 30px rgba(0,0,0,0.2)",
  },
};

/** ====== Zod Schema (source of truth) ====== */
export const CompositionProps = z.object({
  durationInFrames: z.number().optional(),
  CHAT_SETTINGS: z
    .object({
      marginTop: z.number().positive().default(400),
      marginBottom: z.number().positive().default(400),
      textAnimation: z.boolean().default(true),
      chatIntroAnimation: z
        .enum(CHAT_INTRO_ANIMATION_VALUES)
        .default(CHAT_INTRO_ANIMATIONS.NONE),
      chatIntroAnimationDurationMs: z.number().nonnegative().default(600),
      chatOutroAnimation: z
        .enum(CHAT_INTRO_ANIMATION_VALUES)
        .default(CHAT_INTRO_ANIMATIONS.NONE),
      chatOutroAnimationDurationMs: z.number().nonnegative().default(600),
      roundedCorners: z.boolean().default(true),
      roundedCornersRadius: z.number().positive().default(25),
      unreadMessages: z.number().nonnegative().default(999),
      showTopBarFirstOnly: z.boolean().default(true),
      recipientName: z.string().default("Alice"),
      conversationStartTime: z.string().optional(),
      deviceTime: z.string().default("9:41"),
      wifi: z.boolean().default(true),
      battery: z.number().min(0).max(100).default(76),
      theme: z.enum(["light", "dark"]).default("dark"),
      // Optional flags for UI toggles (future-friendly)
      showStatusBar: z.boolean().default(false),
      chatShadowPreset: z.enum(CHAT_SHADOW_PRESET_VALUES).default("medium"),
      recipientAvatars: z
        .record(
          z.string(),
          z.object({
            mode: z.enum(["initials", "image"]).default("initials"),
            imageUrl: z.string().optional(),
          }),
        )
        .default({}),
    })
    .default({}),
  backgroundVideo: z.string().optional(),
  backgroundMusic: z.string().optional(),
  backgroundMusicVolume: z.number().min(0).max(100).default(40),
  greenScreen: z.boolean().default(false),
  showWatermark: z.boolean().default(false),
  enableAudio: z.literal(true).default(true),
  elevenLabsApiKey: z.string().min(1, "ElevenLabs API key is required"),
  // Silence Remover settings
  enableSilenceTrimming: z.boolean().default(false),
  silenceTrimmingType: z
    .enum(["full_audio", "start_and_end"])
    .default("full_audio"),
  voiceSettings: z
    .object({
      stability: z
        .number()
        .min(0)
        .max(1)
        .default(DEFAULT_VOICE_SETTINGS.stability),
      similarity_boost: z
        .number()
        .min(0)
        .max(1)
        .default(DEFAULT_VOICE_SETTINGS.similarity_boost),
      style: z.number().min(0).max(1).default(DEFAULT_VOICE_SETTINGS.style),
      use_speaker_boost: z
        .boolean()
        .default(DEFAULT_VOICE_SETTINGS.use_speaker_boost),
      speed: z.number().min(0.7).max(1.2).default(DEFAULT_VOICE_SETTINGS.speed),
      silenceThresholdDb: z
        .number()
        .min(-80)
        .max(-10)
        .default(DEFAULT_VOICE_SETTINGS.silenceThresholdDb),
      silenceMinSilenceMs: z
        .number()
        .min(50)
        .max(2000)
        .default(DEFAULT_VOICE_SETTINGS.silenceMinSilenceMs),
    })
    .default(DEFAULT_VOICE_SETTINGS),
  voices: z.array(
    z.object({
      name: z.string(),
      voiceId: z.string(),
    }),
  ),
  messages: z.array(
    z.object({
      text: z.string().default(""),
      audioPath: z.string(),
      audioDuration: z.number(),
      showArrow: z.boolean().default(false),
      sender: z.enum(["me", "them"]).default("them"),
      speaker: z.string().optional(),
      appearAt: z.number().nonnegative(),
      type: z
        .enum(["text", "promotion", "command", "image"])
        .default("text")
        .optional(),
      imageUrl: z.string().optional(),
      imageName: z.string().optional(),
      promoDetails: z
        .object({
          image: z.string().optional(),
        })
        .optional(),
      startsConversation: z.boolean().optional(),
      conversationId: z.number().nonnegative().optional(),
      conversationRecipientName: z.string().optional(),
      activeTheme: z.enum(["light", "dark"]).optional(),
    }),
  ),
  monetization: z
    .object({
      type: z.literal("monetization").default("monetization"),
      enabled: z.boolean().default(false),
      category: z.string().default(CANTINA_MONETIZATION_CATEGORY),
      campaign: z.string().default(DEFAULT_MONETIZATION_CAMPAIGN),
      startMessage: z
        .string()
        .default("Switching you to Cantina Roast Bot, one sec..."),
      startMessageAudioDuration: z.number().nonnegative().optional().default(0),
      startMessageAudioPath: z.string().optional().default(""),
      rizz_config: z
        .object({
          image: z.string().default(DEFAULT_RIZZ_MONETIZATION_CONFIG.image),
          intro_message: z
            .string()
            .default(DEFAULT_RIZZ_MONETIZATION_CONFIG.intro_message),
          intro_message_voice_id: z
            .string()
            .default(DEFAULT_RIZZ_MONETIZATION_CONFIG.intro_message_voice_id),
          intro_message_audio_path: z
            .string()
            .default(DEFAULT_RIZZ_MONETIZATION_CONFIG.intro_message_audio_path),
          intro_message_audio_duration: z
            .number()
            .nonnegative()
            .default(
              DEFAULT_RIZZ_MONETIZATION_CONFIG.intro_message_audio_duration,
            ),
          reply: z.string().default(DEFAULT_RIZZ_MONETIZATION_CONFIG.reply),
          reply_visual: z.string().default(DEFAULT_RIZZ_MONETIZATION_CONFIG.reply_visual),
          reply_audio_path: z
            .string()
            .default(DEFAULT_RIZZ_MONETIZATION_CONFIG.reply_audio_path),
          reply_audio_duration: z
            .number()
            .nonnegative()
            .default(DEFAULT_RIZZ_MONETIZATION_CONFIG.reply_audio_duration),
        })
        .default(DEFAULT_RIZZ_MONETIZATION_CONFIG),
      meVoiceId: z.string().default(""),
      compaignBotVoiceId: z
        .string()
        .default(
          MONETIZATION_CAMPAIGN_MAP[DEFAULT_MONETIZATION_CAMPAIGN]
            ?.compaignBotVoiceId ?? "",
        ),
      profilePicture: z
        .string()
        .default(
          MONETIZATION_CAMPAIGN_MAP[DEFAULT_MONETIZATION_CAMPAIGN]
            ?.profilePicture ?? "",
        ),
      startFrame: z.number().nonnegative().optional(),
      durationInFrames: z.number().nonnegative().optional(),
      rizzReplyStartFrame: z.number().nonnegative().optional(),
      messages: z.array(
        z.object({
          id: z.string(),
          text: z.string().default(""),
          sender: z.enum(["me", "them"]).default("them"),
          audioDuration: z.number().nonnegative().default(0),
          audioPath: z.string().optional().default(""),
          appearAt: z.number().nonnegative().optional(),
          audio_type: z
            .enum(["original", "replaced", "re-generated"])
            .optional()
            .default("original"),
        }),
      ),
    })
    .default({
      type: "monetization",
      enabled: false,
      category: RIZZ_MONETIZATION_CATEGORY,
      campaign: DEFAULT_MONETIZATION_CAMPAIGN,
      startMessage: "Switching you to Cantina Roast Bot, one sec...",
      startMessageAudioDuration: 0,
      startMessageAudioPath: "",
      rizz_config: DEFAULT_RIZZ_MONETIZATION_CONFIG,
      meVoiceId: "",
      compaignBotVoiceId:
        MONETIZATION_CAMPAIGN_MAP[DEFAULT_MONETIZATION_CAMPAIGN]
          ?.compaignBotVoiceId ?? "",
      profilePicture:
        MONETIZATION_CAMPAIGN_MAP[DEFAULT_MONETIZATION_CAMPAIGN]
          ?.profilePicture ?? "",
      messages: [],
    }),
});

export const CompositionPropsWithValidation = CompositionProps;

export type CompositionPropsType = z.infer<typeof CompositionProps>;
export type ChatSettings = CompositionPropsType["CHAT_SETTINGS"];
export type MonetizationSettings = CompositionPropsType["monetization"];

export type Message = CompositionPropsType["messages"][number];

export const COMP_NAME = "MyComp";

/** ====== Demo Data (unchanged behavior) ====== */
const rawMessages = [
  {
    text: "Testing Rizz APP",
    type: "text",
    sender: "them",
    speaker: "Ava",
    appearAt: 0,
    audioPath:
      "https://br-max.s3.ap-south-1.amazonaws.com/audios/f9c17081-12f9-46e3-a3cd-7f50fe6cd6db_msg_0.mp3",
    showArrow: false,
    activeTheme: "light",
    audioDuration: 1.8546875,
    conversationId: 0,
    startsConversation: true,
    conversationRecipientName: "Ava",
  },
  {
    text: "> Insert monetization <",
    type: "command",
    sender: "them",
    speaker: "Ava",
    appearAt: 0,
    audioPath: "",
    showArrow: false,
    activeTheme: "",
    audioDuration: 0,
    conversationId: 0,
    startsConversation: false,
    conversationRecipientName: "",
  },
  {
    text: "Yo why is Rizz app soo good at this? I am very impressed",
    type: "text",
    sender: "them",
    speaker: "Ava",
    appearAt: 0,
    audioPath:
      "https://br-max.s3.ap-south-1.amazonaws.com/audios/f9c17081-12f9-46e3-a3cd-7f50fe6cd6db_msg_3.mp3",
    showArrow: false,
    activeTheme: "light",
    audioDuration: 4.075083333333334,
    conversationId: 0,
    startsConversation: false,
    conversationRecipientName: "Ava",
  },
  {
    text: "I am shook",
    type: "text",
    sender: "me",
    speaker: "Me",
    appearAt: 0,
    audioPath:
      "https://br-max.s3.ap-south-1.amazonaws.com/audios/f9c17081-12f9-46e3-a3cd-7f50fe6cd6db_msg_4.mp3",
    audioDuration: 1.2,
    showArrow: false,
    activeTheme: "light",
    conversationId: 0,
    startsConversation: false,
    conversationRecipientName: "Ava",
  },
];

const { messagesWithTiming, totalFrames } = addAppearTimes(
  rawMessages as RawMessage[],
  {
    fps: VIDEO_FPS,
    charsPerSecond: DEFAULT_CHARS_PER_SECOND,
    useAudioDuration: false,
  },
);
export const DEFAULT_BACKGROUND_VIDEO = "/background_video.mp4";

export const defaultMyCompProps: CompositionPropsType = {
  enableAudio: true,
  showWatermark: false,
  elevenLabsApiKey: "asd",
  enableSilenceTrimming: false,
  silenceTrimmingType: "full_audio",
  voiceSettings: { ...DEFAULT_VOICE_SETTINGS },
  messages: messagesWithTiming as CompositionPropsType["messages"],
  backgroundVideo: DEFAULT_BACKGROUND_VIDEO,
  backgroundMusic: "",
  backgroundMusicVolume: 40,
  greenScreen: false,
  voices: [
    { name: "Me", voiceId: "NmpxQl3ZUbfh8HgoNCGM" },
    { name: "Them", voiceId: "54Cze5LrTSyLgbO6Fhlc" },
  ],
  monetization: {
    type: "monetization",
    enabled: true,
    category: RIZZ_MONETIZATION_CATEGORY,
    campaign: DEFAULT_MONETIZATION_CAMPAIGN,
    startMessage: "",
    startMessageAudioDuration: 0,
    startMessageAudioPath: "https://br-max.s3.ap-south-1.amazonaws.com/audios/ad_84d97867-d0cb-474c-849d-5a82bb323726_msg_1.mp3",
    rizz_config: DEFAULT_RIZZ_MONETIZATION_CONFIG,
    meVoiceId: "",
    compaignBotVoiceId:
      MONETIZATION_CAMPAIGN_MAP[DEFAULT_MONETIZATION_CAMPAIGN]
        ?.compaignBotVoiceId ?? "M5t0724ORuAGCh3p3DUR",
    profilePicture:
      MONETIZATION_CAMPAIGN_MAP[DEFAULT_MONETIZATION_CAMPAIGN]
        ?.profilePicture ??
      "https://br-max.s3.ap-south-1.amazonaws.com/RoastBotLogo.webp",
    messages: [],
  },
  CHAT_SETTINGS: {
    textAnimation: true,
    chatIntroAnimation: CHAT_INTRO_ANIMATIONS.NONE,
    chatIntroAnimationDurationMs: 600,
    chatOutroAnimation: CHAT_INTRO_ANIMATIONS.SLIDE_IN_FADE,
    chatOutroAnimationDurationMs: 2000,
    roundedCorners: true,
    roundedCornersRadius: 10,
    marginTop: 200,
    marginBottom: 200,
    theme: "light",
    unreadMessages: 44444,
    deviceTime: "9:41",
    wifi: true,
    battery: 35,
    showTopBarFirstOnly: true,
    conversationStartTime: undefined,
    recipientName: "Sophia",
    showStatusBar: false,
    chatShadowPreset: "medium",
    recipientAvatars: {},
  },
};

/** ====== Video constants ====== */
/** Time (ms) user has to review audio and start video, and video download availability after render. */
export const CONFIRMATION_AND_VIDEO_AVAILABILITY_MS = 2 * 60 * 60 * 1000; // 2 hours
export const DURATION_IN_FRAMES = totalFrames;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

/** ====== Tunables ====== */
export const FRAMES_AFTER_LAST_MESSAGE = 100; // tail hold

/** Base font size for the iMessage overlay (230 = default browser size). */
export const IMESSAGE_FONT_SIZE_PERCENT = 230;
