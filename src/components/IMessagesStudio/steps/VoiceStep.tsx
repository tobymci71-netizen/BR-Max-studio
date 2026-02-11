import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { Input } from "../../Input";
import { Modal } from "../../Modal";
import { Button } from "../../Button";
import {
  AudioLines,
  ExternalLink,
  HelpCircle,
  Info,
  RefreshCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useStudioForm } from "../StudioProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_VOICE_SETTINGS } from "@/types/constants";

type VoiceSettings = typeof DEFAULT_VOICE_SETTINGS;

const clampVoiceSetting = (
  value: number,
  min: number,
  max: number,
  fallback: number,
) => {
  const num =
    typeof value === "number" && !Number.isNaN(value) ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};

const normalizeVoiceSettings = (settings: VoiceSettings): VoiceSettings => ({
  stability: clampVoiceSetting(
    settings.stability,
    0,
    1,
    DEFAULT_VOICE_SETTINGS.stability,
  ),
  similarity_boost: clampVoiceSetting(
    settings.similarity_boost,
    0,
    1,
    DEFAULT_VOICE_SETTINGS.similarity_boost,
  ),
  style: clampVoiceSetting(settings.style, 0, 1, DEFAULT_VOICE_SETTINGS.style),
  use_speaker_boost:
    typeof settings.use_speaker_boost === "boolean"
      ? settings.use_speaker_boost
      : DEFAULT_VOICE_SETTINGS.use_speaker_boost,
  speed: clampVoiceSetting(
    settings.speed,
    0.7,
    1.2,
    DEFAULT_VOICE_SETTINGS.speed,
  ),
  silenceThresholdDb: clampVoiceSetting(
    settings.silenceThresholdDb,
    -80,
    -10,
    DEFAULT_VOICE_SETTINGS.silenceThresholdDb,
  ),
  silenceMinSilenceMs: clampVoiceSetting(
    settings.silenceMinSilenceMs,
    50,
    2000,
    DEFAULT_VOICE_SETTINGS.silenceMinSilenceMs,
  ),
});

const clampRange = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

type NumericVoiceSettingKey = Exclude<keyof VoiceSettings, "use_speaker_boost">;

type SliderConfig = {
  key: NumericVoiceSettingKey;
  label: string;
  description: string;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
  leftLabel: string;
  rightLabel: string;
  formatValue: (value: number) => string;
  stateToSlider: (value: number) => number;
  sliderToState: (value: number) => number;
  warning?: (value: number) => string | null;
};

const sliderConfigs: SliderConfig[] = [
  {
    key: "speed",
    label: "Speed",
    description: "Controls speaking rate.",
    sliderMin: 0.7,
    sliderMax: 1.2,
    sliderStep: 0.01,
    leftLabel: "Slower",
    rightLabel: "Faster",
    formatValue: (value) => `${value.toFixed(2)}x`,
    stateToSlider: (value) => clampRange(value, 0.7, 1.2),
    sliderToState: (value) => clampRange(value, 0.7, 1.2),
  },
  {
    key: "stability",
    label: "Stability",
    description:
      "Controls emotional variation.",
    sliderMin: 0,
    sliderMax: 100,
    sliderStep: 1,
    leftLabel: "More expressive",
    rightLabel: "More stable",
    formatValue: (value) => `${Math.round(value * 100)}%`,
    stateToSlider: (value) => clampRange(Math.round(value * 100), 0, 100),
    sliderToState: (value) => clampRange(value / 100, 0, 1),
    warning: (value) =>
      value < 0.3 ? "Under 30% may lead to instability" : null,
  },
  {
    key: "similarity_boost",
    label: "Similarity boost",
    description:
      "How closely the voice matches the original speaker..",
    sliderMin: 0,
    sliderMax: 100,
    sliderStep: 1,
    leftLabel: "Low",
    rightLabel: "High",
    formatValue: (value) => `${Math.round(value * 100)}%`,
    stateToSlider: (value) => clampRange(Math.round(value * 100), 0, 100),
    sliderToState: (value) => clampRange(value / 100, 0, 1),
  },
  {
    key: "style",
    label: "Style exaggeration",
    description:
      "Adds stylistic exaggeration. Higher = more dramatic, expressive delivery.",
    sliderMin: 0,
    sliderMax: 100,
    sliderStep: 1,
    leftLabel: "None",
    rightLabel: "Exaggerated",
    formatValue: (value) => `${Math.round(value * 100)}%`,
    stateToSlider: (value) => clampRange(Math.round(value * 100), 0, 100),
    sliderToState: (value) => clampRange(value / 100, 0, 1),
    warning: (value) =>
      value > 0.5 ? "Over 50% may lead to instability" : null,
  },
];

type SilenceSettingKey = "silenceThresholdDb" | "silenceMinSilenceMs";

const silenceSettings: Array<{
  key: SilenceSettingKey;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}> = [
  {
    key: "silenceThresholdDb",
    label: "Silence threshold",
    description:
      "Lower values let softer noise stay; higher values cut only loud gaps.",
    min: -80,
    max: -10,
    step: 1,
    unit: "dB",
  },
  {
    key: "silenceMinSilenceMs",
    label: "Minimum silence duration",
    description: "Only trim gaps longer than this many milliseconds.",
    min: 50,
    max: 2000,
    step: 10,
    unit: "ms",
  },
];

export function VoiceStep() {
  const { formValues, updateFormValues } = useStudioForm();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState(
    formValues.elevenLabsApiKey || "",
  );
  const [showVoiceSettingsModal, setShowVoiceSettingsModal] = useState(false);
  const [voiceSettingsDraft, setVoiceSettingsDraft] = useState<VoiceSettings>(
    formValues.voiceSettings || DEFAULT_VOICE_SETTINGS,
  );
  const sliderTimeoutsRef = useRef<
    Record<NumericVoiceSettingKey, ReturnType<typeof setTimeout> | null>
  >({} as Record<NumericVoiceSettingKey, ReturnType<typeof setTimeout> | null>);
  const [sliderDrafts, setSliderDrafts] = useState<
    Record<NumericVoiceSettingKey, number>
  >(() => {
    const initial: Record<NumericVoiceSettingKey, number> = {} as Record<
      NumericVoiceSettingKey,
      number
    >;
    sliderConfigs.forEach((config) => {
      const baseValue =
        voiceSettingsDraft[config.key] ?? DEFAULT_VOICE_SETTINGS[config.key];
      initial[config.key] = config.stateToSlider(baseValue);
    });
    return initial;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [highlightedVoices, setHighlightedVoices] = useState<string[]>([]);
  const [voiceIdDrafts, setVoiceIdDrafts] = useState<Record<string, string>>(
    () => {
      const drafts: Record<string, string> = {};
      formValues.voices.forEach((voice) => {
        drafts[voice.name] = voice.voiceId || "";
      });
      return drafts;
    },
  );
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  const hasApiKey = !!formValues.elevenLabsApiKey;

  const audioMode: "natural" | "snappy" = formValues.enableSilenceTrimming
    ? "snappy"
    : "natural";

  const setAudioMode = (mode: "natural" | "snappy") => {
    if (mode === "natural") {
      updateFormValues({ enableSilenceTrimming: false });
    } else {
      updateFormValues({
        enableSilenceTrimming: true,
      });
    }
  };

  useEffect(() => {
    setApiKeyDraft(formValues.elevenLabsApiKey || "");
  }, [formValues.elevenLabsApiKey]);

  useEffect(() => {
    setVoiceSettingsDraft(
      formValues.voiceSettings || { ...DEFAULT_VOICE_SETTINGS },
    );
  }, [formValues.voiceSettings]);

  useEffect(() => {
    const updated: Record<NumericVoiceSettingKey, number> = {} as Record<
      NumericVoiceSettingKey,
      number
    >;
    sliderConfigs.forEach((config) => {
      const baseValue =
        voiceSettingsDraft[config.key] ?? DEFAULT_VOICE_SETTINGS[config.key];
      updated[config.key] = config.stateToSlider(baseValue);
    });
    setSliderDrafts(updated);
  }, [voiceSettingsDraft]);

  useEffect(() => {
    return () => {
      sliderConfigs.forEach((config) => {
        const timer = sliderTimeoutsRef.current[config.key];
        if (timer) {
          clearTimeout(timer);
        }
      });
    };
  }, []);

  const updateVoiceId = (speakerName: string, voiceId: string) => {
    const updatedVoices = formValues.voices.map((voice) =>
      voice.name === speakerName ? { ...voice, voiceId } : voice,
    );
    updateFormValues({ voices: updatedVoices });
  };

  const handleCommitApiKey = (value: string) => {
    updateFormValues({ elevenLabsApiKey: value.trim() });
  };

  useEffect(() => {
    setVoiceIdDrafts((prev) => {
      const next: Record<string, string> = {};
      formValues.voices.forEach((voice) => {
        next[voice.name] = prev[voice.name] ?? voice.voiceId ?? "";
      });
      return next;
    });
  }, [formValues.voices]);

  const handleOpenApiKeyModal = () => {
    setTempApiKey(formValues.elevenLabsApiKey || "");
    setShowApiKeyModal(true);
  };

  const handleSaveApiKey = () => {
    handleCommitApiKey(tempApiKey);
    setShowApiKeyModal(false);
    setTempApiKey("");
  };

  const handleInitialApiKeySave = () => {
    if (!apiKeyDraft.trim()) return;
    handleCommitApiKey(apiKeyDraft);
  };

  const updateVoiceSettingDraft = <K extends keyof VoiceSettings>(
    key: K,
    value: VoiceSettings[K],
  ) => {
    setVoiceSettingsDraft((prev) => ({ ...prev, [key]: value }));
  };

  const commitSliderValue = (config: SliderConfig, sliderValue: number) => {
    updateVoiceSettingDraft(config.key, config.sliderToState(sliderValue));
  };

  const handleSliderChange = (config: SliderConfig, sliderValue: number) => {
    setSliderDrafts((prev) => ({ ...prev, [config.key]: sliderValue }));
    const pending = sliderTimeoutsRef.current[config.key];
    if (pending) {
      clearTimeout(pending);
    }
    sliderTimeoutsRef.current[config.key] = setTimeout(() => {
      sliderTimeoutsRef.current[config.key] = null;
      commitSliderValue(config, sliderValue);
    }, 500);
  };

  const handleSliderBlur = (config: SliderConfig) => {
    const pending = sliderTimeoutsRef.current[config.key];
    if (pending) {
      clearTimeout(pending);
      sliderTimeoutsRef.current[config.key] = null;
    }
    const sliderValue =
      sliderDrafts[config.key] ??
      config.stateToSlider(
        voiceSettingsDraft[config.key] ?? DEFAULT_VOICE_SETTINGS[config.key],
      );
    commitSliderValue(config, sliderValue);
  };

  const handleSilenceSettingChange = (
    key: SilenceSettingKey,
    value: number,
  ) => {
    if (Number.isNaN(value)) return;
    updateVoiceSettingDraft(key, value);
  };

  const handleOpenVoiceSettings = () => {
    setVoiceSettingsDraft(formValues.voiceSettings || DEFAULT_VOICE_SETTINGS);
    setShowVoiceSettingsModal(true);
  };

  const handleSaveVoiceSettings = () => {
    const normalized = normalizeVoiceSettings({
      ...DEFAULT_VOICE_SETTINGS,
      ...voiceSettingsDraft,
    });
    setVoiceSettingsDraft(normalized);
    updateFormValues({ voiceSettings: normalized });
    setShowVoiceSettingsModal(false);
  };

  const handleResetVoiceSettings = () => {
    const defaults = { ...DEFAULT_VOICE_SETTINGS };
    setVoiceSettingsDraft(defaults);
    updateFormValues({ voiceSettings: defaults });
  };

  const isSpeakerBoostOn = voiceSettingsDraft.use_speaker_boost;

  const handleRefreshSpeakers = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const normalizedNames: string[] = [];
    const addName = (candidate: string | undefined) => {
      const trimmed = candidate?.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      const exists = normalizedNames.some(
        (existing) => existing.toLowerCase() === lower,
      );
      if (!exists) {
        normalizedNames.push(trimmed);
      }
    };

    addName("Me");
    formValues.messages.forEach((message) => {
      if (message.type === "command") return;
      if (message.sender === "me") {
        addName("Me");
        return;
      }

      addName(
        message.speaker ||
          message.conversationRecipientName ||
          formValues.CHAT_SETTINGS.recipientName ||
          "Them",
      );
    });

    const recipients = normalizedNames.filter(
      (name) => name.toLowerCase() !== "me",
    );
    const detected =
      recipients.length > 0 ? ["Me", ...recipients] : ["Me", "Them"];
    const prevNames = formValues.voices.map((voice) =>
      voice.name.toLowerCase(),
    );

    const merged = detected.map((name) => {
      const existing = formValues.voices.find(
        (voice) => voice.name.toLowerCase() === name.toLowerCase(),
      );
      return {
        name,
        voiceId: existing?.voiceId ?? "",
      };
    });
    const freshNames = detected.filter(
      (name) => !prevNames.includes(name.toLowerCase()),
    );

    updateFormValues({ voices: merged });
    setHighlightedVoices(freshNames);

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);

    refreshTimerRef.current = setTimeout(() => setIsRefreshing(false), 800);
    highlightTimerRef.current = setTimeout(
      () => setHighlightedVoices([]),
      1200,
    );
  };

  const commitVoiceId = (speakerName: string) => {
    const draft = voiceIdDrafts[speakerName] ?? "";
    const trimmed = draft.trim();
    const current = formValues.voices.find(
      (voice) => voice.name === speakerName,
    )?.voiceId;
    if (current !== trimmed) {
      updateVoiceId(speakerName, trimmed);
      setVoiceIdDrafts((prev) => ({ ...prev, [speakerName]: trimmed }));
    }
  };

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  return (
    <TooltipProvider>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Title & Description */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                <AudioLines
                  size={20}
                  style={{ display: "inline", marginRight: 8 }}
                />
                Text-to-Speech with ElevenLabs
              </h3>
              <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
                Add your API key and Voice Ids to sync audio as per your script
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                onClick={handleOpenVoiceSettings}
                style={{
                  fontSize: 12,
                  color: "#9ae6ff",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 999,
                  padding: "6px 10px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                }}
              >
                <SlidersHorizontal size={14} />
                <span>Voice settings</span>
              </button>
              {hasApiKey && (
                <button
                  onClick={handleOpenApiKeyModal}
                  style={{
                    fontSize: 12,
                    color: "#00b4ff",
                    textDecoration: "underline",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    opacity: 0.8,
                  }}
                >
                  Change API Key
                </button>
              )}
            </div>
          </div>
        </div>

        {/* API Key Block */}
        {!hasApiKey && (
          <div
            style={{
              padding: 16,
              background: "rgba(255,200,0,0.08)",
              border: "1px solid rgba(255,200,0,0.2)",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "start",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Info
                size={16}
                style={{ marginTop: 2, flexShrink: 0, color: "#ffcc00" }}
              />
              <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
                A paid ElevenLabs plan prevents rate limits and failure of audio
                generation due to unsual activity. Grab your API key at{" "}
                <a
                  href="https://elevenlabs.io/app/developers/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#00b4ff", textDecoration: "underline" }}
                >
                  elevenlabs.io/app/developers/api-keys
                  <ExternalLink
                    size={10}
                    style={{ display: "inline", marginLeft: 2 }}
                  />
                </a>
              </div>
            </div>
            <Input
              label="ElevenLabs API Key"
              type="password"
              required
              value={apiKeyDraft}
              hint="Must have the following permissions: user_read, voices_read, text_to_speech"
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder="Please provide your ElevenLabs API key"
              style={{ marginTop: 12 }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <Button
                variant="primary"
                onClick={handleInitialApiKeySave}
                disabled={!apiKeyDraft.trim()}
              >
                Save API Key
              </Button>
            </div>
          </div>
        )}

        {/* Voice Assignments Block */}
        {hasApiKey ? (
          <div
            style={{
              padding: 20,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <h4
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Voice Assignments
                </h4>
                <button
                  type="button"
                  onClick={handleRefreshSpeakers}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.04)",
                    color: "white",
                    cursor: "pointer",
                    opacity: isRefreshing ? 0.7 : 1,
                  }}
                >
                  <RefreshCcw
                    size={14}
                    style={{
                      animation: isRefreshing
                        ? "spinRefresh 0.9s linear infinite"
                        : "none",
                    }}
                  />
                  Refresh speakers
                </button>
              </div>
              <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>
                Assign a unique voice ID to each speaker in your conversation.{" "}
                <a
                  href="https://elevenlabs.io/app/voice-library"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#00b4ff", textDecoration: "underline" }}
                >
                  Browse voices
                  <ExternalLink
                    size={10}
                    style={{ display: "inline", marginLeft: 2 }}
                  />
                </a>
              </p>
            </div>

            {formValues.voices.length === 0 ? (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  opacity: 0.5,
                  fontSize: 13,
                }}
              >
                No speakers detected. Add messages in Step 1 to see voice
                assignments.
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {formValues.voices.map((voice) => {
                  const isHighlighted = highlightedVoices.some(
                    (name) => name.toLowerCase() === voice.name.toLowerCase(),
                  );
                  return (
                    <div
                      key={voice.name}
                      style={{
                        padding: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: isHighlighted
                          ? "0 8px 24px rgba(0, 180, 255, 0.25)"
                          : "none",
                        animation: isHighlighted
                          ? "voiceCardPop 0.45s ease"
                          : "none",
                        transition: "box-shadow 0.3s ease, transform 0.3s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background:
                              voice.name.toLowerCase() === "me"
                                ? "linear-gradient(135deg, #007aff, #00b4ff)"
                                : "linear-gradient(135deg, #8e8e93, #636366)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          {voice.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {voice.name === "Me" ? "Self (Sender)" : voice.name}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.6 }}>
                            {voice.name.toLowerCase() === "me"
                              ? "Sender's speech"
                              : "Recipient's speech"}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <Input
                            label=""
                            required
                            value={voiceIdDrafts[voice.name] ?? ""}
                            className="w-full max-h-full"
                            onChange={(e) =>
                              setVoiceIdDrafts((prev) => ({
                                ...prev,
                                [voice.name]: e.target.value,
                              }))
                            }
                            onBlur={() => commitVoiceId(voice.name)}
                            placeholder="Voice ID (e.g., pNInz6obpgDQGcFmaJgB)"
                            style={{ width: "100%" }}
                          />
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="Where to find a Voice ID"
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                border: "1px solid rgba(255,255,255,0.2)",
                                background: "rgba(255,255,255,0.04)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                color: "rgba(255,255,255,0.8)",
                              }}
                            >
                              <Info size={16} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Get the Voice ID of any voice from My Voices and
                            paste it here directly.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
            }}
          >
            <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
              Please add your ElevenLabs API key above to configure voice
              assignments.
            </p>
          </div>
        )}

        {hasApiKey && (
          <div
            style={{
              padding: 20,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  🎙️ Audio Style & Pacing
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle size={16} style={{ cursor: "pointer" }} />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Choose how tight or natural the AI voice should sound.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.8,
                    marginTop: 4,
                    fontWeight: 600,
                    color: audioMode === "natural" ? "#81e6d9" : "#a5b4fc",
                  }}
                >
                  {audioMode === "natural"
                    ? "Realistic & natural"
                    : "Tighter & more energetic"}
                </div>
              </div>

              <div
                style={{
                  fontSize: 10,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid rgba(96,165,250,0.8)",
                  background: "rgba(37,99,235,0.2)",
                  whiteSpace: "nowrap",
                  userSelect: "none",
                }}
              >
                Powered by Silence Remover
              </div>
            </div>

            {/* Mode selector */}
            <div
              style={{
                marginTop: 8,
                display: "inline-flex",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.5)",
                background: "rgba(15,23,42,0.6)",
                width: "100%",
                maxWidth: "350px",
                padding: 2,
                gap: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setAudioMode("natural")}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background:
                    audioMode === "natural"
                      ? "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(37,99,235,0.9))"
                      : "transparent",
                  color:
                    audioMode === "natural" ? "white" : "rgba(209,213,219,0.8)",
                  boxShadow:
                    audioMode === "natural"
                      ? "0 0 0 1px rgba(59,130,246,0.9)"
                      : "none",
                }}
              >
                <span>Natural</span>
              </button>
              <button
                type="button"
                onClick={() => setAudioMode("snappy")}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background:
                    audioMode === "snappy"
                      ? "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(37,99,235,0.9))"
                      : "transparent",
                  color:
                    audioMode === "snappy" ? "white" : "rgba(209,213,219,0.8)",
                  boxShadow:
                    audioMode === "snappy"
                      ? "0 0 0 1px rgba(59,130,246,0.9)"
                      : "none",
                }}
              >
                <span>Snappy</span>
              </button>
            </div>

            {audioMode === "snappy" && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(148,163,184,0.2)",
                  background: "rgba(15,23,42,0.5)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(226,232,240,0.9)",
                    marginBottom: 8,
                  }}
                >
                  Trim silence
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      updateFormValues({
                        silenceTrimmingType: "full_audio",
                      })
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      background:
                        (formValues.silenceTrimmingType ?? "full_audio") === "full_audio"
                          ? "rgba(59,130,246,0.35)"
                          : "rgba(30,41,59,0.8)",
                      color:
                        (formValues.silenceTrimmingType ?? "full_audio") === "full_audio"
                          ? "white"
                          : "rgba(203,213,225,0.9)",
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor:
                        (formValues.silenceTrimmingType ?? "full_audio") === "full_audio"
                          ? "rgba(59,130,246,0.6)"
                          : "rgba(148,163,184,0.2)",
                    }}
                  >
                    Entire audio
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateFormValues({
                        silenceTrimmingType: "start_and_end",
                      })
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      background:
                        (formValues.silenceTrimmingType ?? "full_audio") === "start_and_end"
                          ? "rgba(59,130,246,0.35)"
                          : "rgba(30,41,59,0.8)",
                      color:
                        (formValues.silenceTrimmingType ?? "full_audio") === "start_and_end"
                          ? "white"
                          : "rgba(203,213,225,0.9)",
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor:
                        (formValues.silenceTrimmingType ?? "full_audio") === "start_and_end"
                          ? "rgba(59,130,246,0.6)"
                          : "rgba(148,163,184,0.2)",
                    }}
                  >
                    Start & end only
                  </button>
                </div>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 11,
                    opacity: 0.8,
                    color: "rgba(203,213,225,0.85)",
                  }}
                >
                  {(formValues.silenceTrimmingType ?? "full_audio") === "full_audio"
                    ? "Removes silence throughout the whole clip."
                    : "Removes silence only at the beginning and end."}
                </p>
              </div>
            )}

            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.25)",
                  background:
                    "linear-gradient(145deg, rgba(59,130,246,0.08), rgba(12,18,32,0.85))",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Info size={16} style={{ color: "#93c5fd" }} />
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    How Silence Remover helps
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, opacity: 0.85 }}>
                  We trim micro-pauses between lines so you can keep a natural
                  read or switch to a snappier cut for shorts without redoing
                  the script.
                </p>
                <div
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: "rgba(15,23,42,0.8)",
                  }}
                >
                  <Image
                    src="/NaturalVSsnappyAudio.png"
                    alt="Waveform comparison of natural vs snappy audio"
                    width={1200}
                    height={675}
                    priority
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      objectFit: "cover",
                    }}
                    sizes="100vw"
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 10,
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.45)",
                      border: "1px solid rgba(148,163,184,0.35)",
                    }}
                  >
                    Natural vs Snappy
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(15,23,42,0.75)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AudioLines size={16} style={{ color: "#7dd3fc" }} />
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    Listen before you pick
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 10,
                  }}
                >
                  {[
                    {
                      label: "Natural (with pauses)",
                      description: "Keeps breathers for a conversational feel.",
                      src: "https://br-max.s3.ap-south-1.amazonaws.com/NaturalAudio.mp3",
                    },
                    {
                      label: "Snappy (trimmed)",
                      description: "Removes gaps for fast, short-form pacing.",
                      src: "https://br-max.s3.ap-south-1.amazonaws.com/SnappyAudio.mp3",
                    },
                  ].map((sample) => (
                    <div
                      key={sample.src}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(148,163,184,0.2)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {sample.label}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {sample.description}
                      </div>
                      <audio
                        controls
                        preload="metadata"
                        style={{
                          width: "100%",
                          marginTop: 6,
                          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.25))",
                        }}
                        src={sample.src}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <Modal
          open={showVoiceSettingsModal}
          onClose={() => setShowVoiceSettingsModal(false)}
          title="Voice Configuration"
          actionButton={
            <Button onClick={handleSaveVoiceSettings} variant="primary">
              Save Changes
            </Button>
          }
          width={620}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* HEADER SECTION */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                paddingBottom: 8,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  opacity: 0.7,
                  lineHeight: 1.4,
                }}
              >
                Adjust the tone, stability, and clarity of the AI generation.
              </p>
              <Button
                variant="ghost"
                onClick={handleResetVoiceSettings}
                style={{ fontSize: 12, height: 28, padding: "0 10px" }}
              >
                Reset to defaults
              </Button>
            </div>

            {/* MAIN SLIDERS GRID */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: 12,
              }}
            >
              {sliderConfigs.map((config) => {
                const savedValue =
                  voiceSettingsDraft[config.key] ??
                  DEFAULT_VOICE_SETTINGS[config.key];
                const sliderValue =
                  sliderDrafts[config.key] ?? config.stateToSlider(savedValue);
                const displayValue = config.sliderToState(sliderValue);

                // Calculate fill percentage for the slider track
                const range = config.sliderMax - config.sliderMin;
                const rawPercent =
                  range > 0
                    ? ((sliderValue - config.sliderMin) / range) * 100
                    : 100;
                const fillPercent = Math.min(Math.max(rawPercent, 0), 100);

                const warningText = config.warning?.(displayValue);

                return (
                  <div
                    key={config.key}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.02)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 500, fontSize: 13 }}>
                        {config.label}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          opacity: 0.9,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {config.formatValue(displayValue)}
                      </div>
                    </div>

                    {/* Slider Input */}
                    <div
                      style={{
                        position: "relative",
                        height: 24,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="range"
                        min={config.sliderMin}
                        max={config.sliderMax}
                        step={config.sliderStep}
                        value={sliderValue}
                        onChange={(e) =>
                          handleSliderChange(config, Number(e.target.value))
                        }
                        onBlur={() => handleSliderBlur(config)}
                        className="eleven-slider" // Assuming you have CSS for the thumb
                        style={{
                          width: "100%",
                          height: 4,
                          marginTop: 2,
                          borderRadius: 2,
                          outline: "none",
                          appearance: "none",
                          background: `linear-gradient(90deg, #38bdf8 ${fillPercent}%, rgba(255,255,255,0.1) ${fillPercent}%)`,
                          cursor: "pointer",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        marginTop: -10,
                        opacity: 0.5,
                      }}
                    >
                      <span>{config.leftLabel}</span>
                      <span>{config.rightLabel}</span>
                    </div>

                    {warningText && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#facc15",
                          marginTop: -4,
                        }}
                      >
                        {warningText}
                      </div>
                    )}
                    <div
                      style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.3 }}
                    >
                      {config.description}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ADVANCED PROCESSING SECTION (Combined) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.5fr",
                gap: 12,
              }}
            >
              {/* SPEAKER BOOST CARD */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}
                  >
                    Speaker Boost
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.6,
                      lineHeight: 1.3,
                      marginBottom: 12,
                    }}
                  >
                    Enhances clarity and voice similarity. May increase
                    generation time slightly.
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isSpeakerBoostOn}
                    onClick={() =>
                      updateVoiceSettingDraft(
                        "use_speaker_boost",
                        !isSpeakerBoostOn,
                      )
                    }
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 999,
                      border: "none",
                      background: isSpeakerBoostOn
                        ? "#fff"
                        : "rgba(255,255,255,0.15)",
                      position: "relative",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: isSpeakerBoostOn ? "#0f172a" : "#fff",
                        transform: isSpeakerBoostOn
                          ? "translateX(20px)"
                          : "translateX(0)",
                        transition:
                          "transform 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)",
                      }}
                    />
                  </button>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      opacity: isSpeakerBoostOn ? 1 : 0.5,
                    }}
                  >
                    {isSpeakerBoostOn ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>

              {/* SILENCE / SMART CROP CARD */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}
                  >
                    Snappy Audio
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.3 }}>
                    Automatically trim parts of audio which are less than {voiceSettingsDraft.silenceThresholdDb} dB and lasts for at least {voiceSettingsDraft.silenceMinSilenceMs}ms
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {silenceSettings.map((setting) => (
                    <div
                      key={setting.key}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          opacity: 0.7,
                        }}
                      >
                        <span>{setting.label}</span>
                        <span>{setting.unit}</span>
                      </div>
                      <Input
                        type="number"
                        min={setting.min}
                        max={setting.max}
                        step={setting.step}
                        value={
                          voiceSettingsDraft[setting.key] ??
                          DEFAULT_VOICE_SETTINGS[setting.key]
                        }
                        onChange={(e) =>
                          handleSilenceSettingChange(
                            setting.key,
                            parseFloat(e.target.value),
                          )
                        }
                        style={{
                          fontSize: 13,
                          padding: "4px 8px",
                          borderRadius: 6,
                          background: "rgba(0,0,0,0.2)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Modal>

        {/* API Key Update Modal */}
        <Modal
          open={showApiKeyModal}
          onClose={() => {
            setShowApiKeyModal(false);
            setTempApiKey("");
          }}
          title="Update ElevenLabs API Key"
          actionButton={
            <Button onClick={handleSaveApiKey} variant="primary">
              Save
            </Button>
          }
          width={500}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "start",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <Info
                size={16}
                style={{ marginTop: 2, flexShrink: 0, color: "#ffcc00" }}
              />
              <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
                A paid ElevenLabs plan prevents rate limits and failure of audio
                generation due to unsual activity.
                <br />
                Get your API key from{" "}
                <a
                  href="https://elevenlabs.io/app/developers/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#00b4ff", textDecoration: "underline" }}
                >
                  elevenlabs.io/app/developers/api-keys
                  <ExternalLink
                    size={10}
                    style={{ display: "inline", marginLeft: 2 }}
                  />
                </a>
              </div>
            </div>
            <Input
              label="ElevenLabs API Key"
              type="password"
              required
              value={tempApiKey}
              hint="Must have the following permissions: user_read, voices_read, text_to_speech"
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Please provide your ElevenLabs API key"
            />
          </div>
        </Modal>
        <style>
          {`
            @keyframes spinRefresh {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes voiceCardPop {
              0% {
                transform: scale(0.96);
                opacity: 0;
              }
              60% {
                transform: scale(1.02);
                opacity: 1;
              }
              100% {
                transform: scale(1);
                opacity: 1;
              }
            }
          `}
        </style>
      </div>
    </TooltipProvider>
  );
}
