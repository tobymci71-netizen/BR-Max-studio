import { z } from "zod";

export const studioFormSchema = z.object({
  elevenLabsApiKey: z.string().min(1, "API key is required"),
  
  CHAT_SETTINGS: z.object({
    recipientName: z.string().min(1, "Recipient name is required"),
    theme: z.enum(["light", "dark"]),
    roundedCornersRadius: z.number()
      .min(0, "Radius must be positive")
      .max(100, "Radius should be 100 or less for realistic design"),
    marginTop: z.number().min(0),
    marginBottom: z.number().min(0),
    battery: z.number().min(0).max(100),
    unreadMessages: z.number().min(0, "Unread must be non-negative"),
  }),

  voices: z.array(z.object({
    name: z.string(),
    voiceId: z.string().min(1, "Voice ID is required"),
  })),

  voiceSettings: z.object({
    stability: z.number().min(0).max(1),
    similarity_boost: z.number().min(0).max(1),
    style: z.number().min(0).max(1),
    use_speaker_boost: z.boolean(),
    speed: z.number().min(0.7).max(1.2),
    silenceThresholdDb: z.number().min(-80).max(-10),
    silenceMinSilenceMs: z.number().min(50).max(2000),
  }),

  messages: z.array(z.any()).min(1, "At least one message is required"),
});

export type StudioFormData = z.infer<typeof studioFormSchema>;
