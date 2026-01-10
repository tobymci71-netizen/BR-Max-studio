// /lib/audioGeneration.ts
// Browser-safe, strict-typed, ESLint-friendly. Uses ElevenLabs REST (no Node SDK).

import { DEFAULT_VOICE_SETTINGS } from "@/types/constants";
import { removeSilenceFromMp3 } from "./removeSilenceMp3";

/* ----------------------------------------------
   PLAN → CONCURRENCY MAP (tune as you like)
---------------------------------------------- */
export type Plan =
  | "free"
  | "starter"
  | "creator"
  | "pro"
  | "scale"
  | "business";

const CONCURRENCY: Record<Plan, number> = {
  free: 2,
  starter: 3,
  creator: 5,
  pro: 10,
  scale: 15,
  business: 15,
};

/* ----------------------------------------------
   LIGHTWEIGHT SEMAPHORE + PER-KEY REGISTRY
---------------------------------------------- */
class Semaphore {
  private max: number;
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.max = Math.max(1, max);
  }

  setMax(max: number): void {
    this.max = Math.max(1, max);
    this.drain();
  }

  getMax(): number {
    return this.max;
  }

  getActiveCount(): number {
    return this.running;
  }

  private drain(): void {
    while (this.running < this.max && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) break;
      this.running += 1;
      next();
    }
  }

  acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const release = (): void => {
        this.running = Math.max(0, this.running - 1);
        this.drain();
      };

      if (this.running < this.max) {
        this.running += 1;
        resolve(release);
      } else {
        this.queue.push(() => resolve(release));
      }
    });
  }
}

const limiters = new Map<string, Semaphore>();
function getOrCreateLimiter(key: string, max: number): Semaphore {
  const existing = limiters.get(key);
  if (existing) {
    existing.setMax(max);
    return existing;
  }
  const sem = new Semaphore(max);
  limiters.set(key, sem);
  return sem;
}

/* ----------------------------------------------
   ElevenLabs REST helpers
---------------------------------------------- */
const ELEVEN_BASE = "https://api.elevenlabs.io";
type VoiceSettings = typeof DEFAULT_VOICE_SETTINGS;

type ElevenUser = {
  subscription?: {
    tier?: string;
    plan?: string;
    character_limit?: number;
    can_use_instant_voice_cloning?: boolean;
    voice_limit?: number;
    voice_count?: number;
  };
};

type ElevenVoice = {
  voice_id: string;
  name: string;
  category?: string;
};

export type VoiceCompatibilityResult = {
  isCompatible: boolean;
  error?: string;
  errorTitle?: string;
  details: {
    voiceIdsNeeded: number;
    uniqueVoiceIds: string[];
    voiceLimit: number;
    currentVoiceCount: number;
    availableSlots: number;
    newVoicesNeeded: number;
    willExceedLimit: boolean;
    allVoiceIds: string[]; // All voices in user's library (premade + custom)
    customVoiceIds: string[]; // Only user's custom/cloned voices
    newVoiceIds: string[]; // Voices that will be added
  };
};

function normalizePlan(raw: string | undefined): Plan {
  const v = (raw ?? "free").toLowerCase();
  const valid: Plan[] = [
    "free",
    "starter",
    "creator",
    "pro",
    "scale",
    "business",
  ];
  return valid.includes(v as Plan) ? (v as Plan) : "free";
}

/** Validate the apiKey by fetching the user object. Returns true or throws with a readable message. */
export async function validateElevenLabsApiKey(
  apiKey: string,
): Promise<boolean> {
  if (!apiKey) throw new Error("Missing ElevenLabs API key");
  const r = await fetch(`${ELEVEN_BASE}/v1/user`, {
    method: "GET",
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (r.ok) return true;
  throw new Error(`Invalid ElevenLabs API key`);
}

/** Get the user's plan (tier) via /v1/user and map concurrency. */
export async function getElevenLabsPlan(apiKey: string): Promise<Plan> {
  const r = await fetch(`${ELEVEN_BASE}/v1/user`, {
    method: "GET",
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(
      `Failed to fetch plan (${r.status}): ${body || r.statusText}`,
    );
  }
  const user = (await r.json()) as ElevenUser;
  const plan = normalizePlan(
    user.subscription?.tier ?? user.subscription?.plan,
  );
  return plan;
}

export async function getPlanDetails(apiKey: string): Promise<{
  plan: Plan;
  maxConcurrentRequests: number;
}> {
  const plan = await getElevenLabsPlan(apiKey);
  const maxConcurrentRequests = CONCURRENCY[plan];
  return { plan, maxConcurrentRequests };
}

/* ----------------------------------------------
   Voice Compatibility Check
---------------------------------------------- */

/**
 * Check if the provided voice IDs are compatible with the user's ElevenLabs account.
 * This validates that using these voices won't exceed the account's voice limit.
 *
 * IMPORTANT: ElevenLabs automatically adds voices to "My Voices" when you use them.
 * If the user already has voices in their library and tries to use new voices,
 * those new voices will be added to "My Voices". If this causes the limit to be
 * exceeded, generation will FAIL.
 *
 * @param apiKey - ElevenLabs API key
 * @param voiceIds - Array of voice IDs that will be used for generation
 * @returns VoiceCompatibilityResult with detailed information
 */
export async function checkVoiceCompatibility(
  apiKey: string,
  voiceIds: string[],
): Promise<VoiceCompatibilityResult> {
  if (!apiKey) {
    throw new Error("Missing ElevenLabs API key");
  }

  // Get unique voice IDs
  const uniqueVoiceIds = Array.from(new Set(voiceIds.filter((id) => id.trim())));
  const voiceIdsNeeded = uniqueVoiceIds.length;

  try {
    // Fetch user subscription info
    const userRes = await fetch(`${ELEVEN_BASE}/v1/user/subscription`, {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
    });

    if (!userRes.ok) {
      const body = await userRes.text().catch(() => "");
      throw new Error(
        `Failed to fetch user's eleven labs info (${userRes.status}): ${body || userRes.statusText}`,
      );
    }

    const userSub = await userRes.json();
    const user_voice_limit = userSub.voice_limit || 0;
    const user_voice_slots_used = userSub.voice_slots_used || 0;

    // Fetch all voices in the user's library (both premade and custom)
    const voicesRes = await fetch(`${ELEVEN_BASE}/v1/voices`, {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
    });

    if (!voicesRes.ok) {
      const body = await voicesRes.text().catch(() => "");
      throw new Error(
        `Failed to fetch voices (${voicesRes.status}): ${body || voicesRes.statusText}`,
      );
    }

    const voicesData = await voicesRes.json();
    const userVoices: ElevenVoice[] = voicesData.voices || [];

    // Get all voice IDs currently in user's library
    const allVoiceIds = userVoices.map((v) => v.voice_id);

    // Get only custom/cloned voices (category is typically "cloned" or "premade")
    const customVoiceIds = userVoices
      .filter((v) => v.category !== "premade")
      .map((v) => v.voice_id);

    // Check which of the required voices are NOT already in the user's library
    const newVoiceIds = uniqueVoiceIds.filter((id) => !allVoiceIds.includes(id));
    const newVoicesNeeded = newVoiceIds.length;

    // Calculate available slots
    const availableSlots = user_voice_limit - user_voice_slots_used;

    // Check if using these voices will exceed the limit
    const willExceedLimit = newVoicesNeeded > availableSlots;

    const details = {
      voiceIdsNeeded,
      uniqueVoiceIds,
      voiceLimit: user_voice_limit,
      currentVoiceCount: user_voice_slots_used,
      availableSlots,
      newVoicesNeeded,
      willExceedLimit,
      allVoiceIds,
      customVoiceIds,
      newVoiceIds,
    };

    // If will exceed limit, return incompatible with warning
    if (willExceedLimit) {
      return {
        isCompatible: false,
        errorTitle: "Voice Slot Limit Warning",
        error: `You are using ${voiceIdsNeeded} voice${voiceIdsNeeded > 1 ? "s" : ""}, but only have ${availableSlots} available slot${availableSlots !== 1 ? "s" : ""} (${user_voice_limit} total, ${user_voice_slots_used} used).\n\nTo proceed, you must either:\n• Have all voice IDs used in here already in your "My Voices" tab in ElevenLabs, OR\n• Have at least ${voiceIdsNeeded} available slot${voiceIdsNeeded > 1 ? "s" : " "}\n\nOtherwise, your generation WILL FOR SURE fail.\n\nDo you want to continue anyway?`,
        details,
      };
    }

    // All good - voices are either already in library or there's enough space
    return {
      isCompatible: true,
      details,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to check voice compatibility");
  }
}

/* ----------------------------------------------
   Browser helpers: base64/Blob/duration
---------------------------------------------- */
function uint8ToBase64(u8: Uint8Array): string {
  // Convert Uint8Array -> base64 in browser
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(u8.subarray(i, i + chunk)) as number[],
    );
  }
  // btoa expects binary string
  return btoa(binary);
}

async function responseToUint8(res: Response): Promise<Uint8Array> {
  // Prefer streaming reader for large files; fall back to arrayBuffer()
  if (res.body && "getReader" in res.body) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const size = chunks.reduce((a, c) => a + c.length, 0);
    const out = new Uint8Array(size);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function base64ToDuration(base64: string): Promise<number> {
  // Convert base64 -> Blob -> decode via WebAudio, fallback to <audio> metadata
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++)
    bytes[i] = byteString.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/mpeg" });

  const Ctx: typeof AudioContext | undefined =
    typeof window !== "undefined"
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext)
      : undefined;

  if (Ctx) {
    const ctx = new Ctx();
    try {
      const buf = await blob.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(buf.slice(0) as ArrayBuffer);
      const d = Math.max(audioBuf.duration || 1.2, 1.2);
      try {
        await (ctx as unknown as { close?: () => Promise<void> }).close?.();
      } catch { }
      return d;
    } catch {
      // fallback below
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const d = await new Promise<number>((resolve, reject) => {
      const a = new Audio();
      a.src = url;
      a.preload = "metadata";
      a.onloadedmetadata = () => resolve(Math.max(a.duration || 1.2, 1.2));
      a.onerror = () => reject(new Error("Failed to load audio metadata"));
    });
    return d;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ----------------------------------------------
   AUDIO GENERATION (NO S3) → base64 + duration
   Uses ElevenLabs REST which returns audio bytes
---------------------------------------------- */
const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const num = typeof value === "number" && !Number.isNaN(value) ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};

const normalizeVoiceSettings = (voiceSettings?: Partial<VoiceSettings>): VoiceSettings => ({
  stability: clampNumber(
    voiceSettings?.stability,
    0,
    1,
    DEFAULT_VOICE_SETTINGS.stability,
  ),
  similarity_boost: clampNumber(
    voiceSettings?.similarity_boost,
    0,
    1,
    DEFAULT_VOICE_SETTINGS.similarity_boost,
  ),
  style: clampNumber(
    voiceSettings?.style,
    0,
    1,
    DEFAULT_VOICE_SETTINGS.style,
  ),
  use_speaker_boost:
    typeof voiceSettings?.use_speaker_boost === "boolean"
      ? voiceSettings.use_speaker_boost
      : DEFAULT_VOICE_SETTINGS.use_speaker_boost,
  speed: clampNumber(
    voiceSettings?.speed,
    0.7,
    1.2,
    DEFAULT_VOICE_SETTINGS.speed,
  ),
  silenceThresholdDb: clampNumber(
    voiceSettings?.silenceThresholdDb,
    -80,
    -10,
    DEFAULT_VOICE_SETTINGS.silenceThresholdDb,
  ),
  silenceMinSilenceMs: clampNumber(
    voiceSettings?.silenceMinSilenceMs,
    50,
    2000,
    DEFAULT_VOICE_SETTINGS.silenceMinSilenceMs,
  ),
});

type GenerateParams = {
  text: string;
  voiceId: string;
  apiKey: string; // user-provided key (intentionally exposed)
  jobId?: string;
  index?: number;
  modelId?: string; // optional override
  outputFormat?: string; // e.g. "mp3_44100_128"

  // NEW: silence trimming
  enableSilenceTrimming?: boolean;
  voiceSettings?: Partial<VoiceSettings>;
};

export async function generateAudioFile(params: GenerateParams): Promise<{
  base64Data: string;
  duration: number;
}> {
  const {
    text,
    voiceId,
    apiKey,
    jobId,
    index,
    modelId = "eleven_multilingual_v2",
    outputFormat = "mp3_44100_128",
    enableSilenceTrimming,
    voiceSettings,
  } = params;

  console.log("enableSilenceTrimming: ", enableSilenceTrimming)
  if (!apiKey) throw new Error("Missing ElevenLabs API key");
  if (!voiceId) throw new Error("Missing voiceId");
  if (!text) throw new Error("Missing text");

  // Concurrency limiter per (apiKey + plan)
  // We fetch plan lazily once, attach to limiter key.
  let plan: Plan = "free";
  // Cache a small memo of plan per key to avoid spamming /v1/user
  const PLAN_CACHE =
    // @ts-expect-error IDK how to fix, i am soo sleepy right now and my back hurts
    (generateAudioFile).__PLAN_CACHE || new Map<string, Plan>();
  // @ts-expect-error IDK how to fix, i am soo sleepy right now and my back hurts
  (generateAudioFile).__PLAN_CACHE = PLAN_CACHE;

  if (PLAN_CACHE.has(apiKey)) {
    plan = PLAN_CACHE.get(apiKey)!;
  } else {
    try {
      plan = await getElevenLabsPlan(apiKey);
      PLAN_CACHE.set(apiKey, plan);
    } catch (e) {
      // If plan lookup fails, continue with free limits but surface info
      console.warn(
        "[ElevenLabs] Failed to resolve plan; defaulting to 'free'.",
        e,
      );
      plan = "free";
    }
  }

  const limiter = getOrCreateLimiter(`${apiKey}:${plan}`, CONCURRENCY[plan]);
  const release = await limiter.acquire();
  const normalizedVoiceSettings = normalizeVoiceSettings(voiceSettings);

  try {
    const res = await fetch(
      `${ELEVEN_BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          output_format: outputFormat,
          voice_settings: {
            stability: normalizedVoiceSettings.stability,
            similarity_boost: normalizedVoiceSettings.similarity_boost,
            style: normalizedVoiceSettings.style,
            use_speaker_boost: normalizedVoiceSettings.use_speaker_boost,
            speed: normalizedVoiceSettings.speed,
          },
        }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");

      // Try to parse ElevenLabs JSON and surface only the human message
      try {
        const j = JSON.parse(txt);
        const message =
          j?.detail?.message ?? j?.message ?? j?.error ?? res.statusText;

        // If unusual activity, or any structured error, throw only the plain message
        if (typeof message === "string" && message.trim()) {
          throw new Error(message);
        }

        // Fallback if message missing
        throw new Error(res.statusText);
      } catch {
        // Not JSON → fall back to raw text or status
        throw new Error(txt || res.statusText);
      }
    }

    const bytes = await responseToUint8(res);

    let base64Data: string;
    let duration: number;

    if (enableSilenceTrimming) {
      const trimmed = await removeSilenceFromMp3(bytes, {
        thresholdDb: normalizedVoiceSettings.silenceThresholdDb,
        minSilenceMs: normalizedVoiceSettings.silenceMinSilenceMs,
      });

      base64Data = trimmed.base64Data;
      duration = trimmed.duration;
    } else {
      base64Data = uint8ToBase64(bytes);
      duration = await base64ToDuration(base64Data);
    }

    console.log(
      `✅ Audio generated${jobId !== undefined ? ` [${jobId}:${index ?? 0}]` : ""
      } (${duration.toFixed(2)}s) — plan=${plan}, active=${limiter.getActiveCount()}/${limiter.getMax()}`,
    );

    return { base64Data, duration };
  } catch (error) {
    // Concurrency context
    try {
      console.error(
        `[ElevenLabs] Concurrency — allowed: ${limiter.getMax()}, active: ${limiter.getActiveCount()}`,
      );
    } catch { }

    // Normalize errors
    if (error instanceof Error) {
      const msg = error.message || String(error);
      // attempt to unwrap embedded JSON again (defensive)
      const jsonMatch = msg.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as {
            detail?: { message?: string };
            message?: string;
          };
          const detail = parsed.detail?.message ?? parsed.message;
          console.log(detail);
          if (detail) throw new Error(detail);
        } catch {
          // ignore
        }
      }
      throw new Error(msg);
    }
    throw error;
  } finally {
    release();
  }
}










// Convert PCM (raw 16-bit LE) → WAV buffer
function pcmToWav(pcm: Uint8Array, sampleRate = 44100): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);

  function writeString(offset: number, text: string) {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, pcm.length, true);

  // copy samples after header
  new Uint8Array(buffer, 44).set(pcm);

  return buffer;
}

// Encode PCM16 samples → WAV Blob
function encodeWav(samples: number[], sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function removeSilencePcm(
  pcmBytes: Uint8Array,
  { thresholdDb = -40, minSilenceMs = 300 }
) {
  const sampleRate = 44100; // pcm_44100 fixed value
  const wavBuffer = pcmToWav(pcmBytes, sampleRate);

  const audioCtx = new AudioContext();
  const audio = await audioCtx.decodeAudioData(wavBuffer.slice(0));
  const channel = audio.getChannelData(0);

  const threshold = Math.pow(10, thresholdDb / 20); // convert dB → amplitude
  const minSilenceSamples = Math.floor((minSilenceMs / 1000) * sampleRate);

  const out: number[] = [];
  let silent = 0;

  for (let i = 0; i < channel.length; i++) {
    if (Math.abs(channel[i]) < threshold) {
      silent++;
    } else {
      if (silent > 0 && silent < minSilenceSamples) {
        const start = i - silent;
        for (let j = start; j < i; j++) out.push(channel[j]);
      }
      silent = 0;
      out.push(channel[i]);
    }
  }

  const wavBlob = encodeWav(out, sampleRate);
  const processedArrayBuf = await wavBlob.arrayBuffer();

  // convert to base64
  const base64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(processedArrayBuf))));

  return { base64Data: base64, duration: out.length / sampleRate };
}
