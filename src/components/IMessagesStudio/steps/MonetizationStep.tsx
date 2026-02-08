import React, { useEffect, useState } from "react";
import { Card } from "../../Card";
import { Button } from "../../Button";
import { Switch } from "../../Switch";
import { CopyableCodeSnippet } from "../../CopyableCodeSnippet";
import { useStudioForm } from "../StudioProvider";
import {
  defaultMyCompProps,
  MONETIZATION_CATEGORY_OPTIONS,
  MonetizationSettings,
  getMonetizationCampaignConfig,
  getMonetizationCampaignsForCategory,
  RIZZ_MONETIZATION_CATEGORY,
  DEFAULT_RIZZ_MONETIZATION_CONFIG,
} from "@/types/constants";
import { RizzMonetizationSettings } from "./RizzMonetizationSettings";

export function MonetizationStep() {
  const { formValues, updateFormValues } = useStudioForm();
  const monetization =
    formValues.monetization ?? defaultMyCompProps.monetization;
  const monetizationEnabled = monetization.enabled ?? false;
  const [startMessageDraft, setStartMessageDraft] = useState(
    monetization.startMessage ?? "",
  );
  const [meVoiceIdDraft, setMeVoiceIdDraft] = useState(
    monetization.meVoiceId ?? "",
  );
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>(
    () =>
      monetization.messages.reduce(
        (acc, msg) => ({ ...acc, [msg.id]: msg.text }),
        {},
      ),
  );

  const palette = {
    bg: "linear-gradient(135deg, rgba(10,12,24,0.9), rgba(16,20,32,0.92))",
    stroke: "rgba(255,255,255,0.06)",
    accent: "#1ec8d8",
    accentSoft: "rgba(30,200,216,0.16)",
    textSubtle: "rgba(255,255,255,0.72)",
    card: "rgba(255,255,255,0.02)",
    cardAlt: "rgba(255,255,255,0.04)",
  };

  const rizzConfig = monetization.rizz_config ?? DEFAULT_RIZZ_MONETIZATION_CONFIG;

  const chatMeVoiceId =
    formValues.voices.find(
      (voice) => voice.name.toLowerCase() === "me",
    )?.voiceId ?? "";

  const updateMonetization = (updates: Partial<typeof monetization>) => {
    updateFormValues({
      monetization: { ...monetization, ...updates },
    });
  };

  const handleRizzConfigChange = (
    updates: Partial<typeof rizzConfig>,
  ) => {
    updateMonetization({
      rizz_config: {
        ...rizzConfig,
        ...updates,
      },
    });
  };

  useEffect(() => {
    // Reset legacy fields gracefully
    type MonetizationWithLegacyFields = MonetizationSettings & {
      insertAfterMessageIndex?: number;
      profileImage?: string;
    };
    const monetizationWithLegacy = monetization as MonetizationWithLegacyFields;
    if (
      monetizationWithLegacy.insertAfterMessageIndex !== undefined ||
      monetizationWithLegacy.profileImage !== undefined
    ) {
      const clone = { ...monetization } as MonetizationWithLegacyFields;
      if (clone.insertAfterMessageIndex !== undefined) {
        delete clone.insertAfterMessageIndex;
      }
      if (clone.profileImage !== undefined) {
        delete clone.profileImage;
      }
      updateFormValues({ monetization: clone as MonetizationSettings });
    }
  }, [monetization, updateFormValues]);

  useEffect(() => {
    const campaignConfig = getMonetizationCampaignConfig(monetization.campaign);
    const updates: Partial<typeof monetization> = {};

    if (
      campaignConfig?.compaignBotVoiceId &&
      !monetization.compaignBotVoiceId?.trim()
    ) {
      updates.compaignBotVoiceId = campaignConfig.compaignBotVoiceId;
    }

    if (
      campaignConfig?.profilePicture &&
      !monetization.profilePicture?.trim()
    ) {
      updates.profilePicture = campaignConfig.profilePicture;
    }

    if (Object.keys(updates).length > 0) {
      updateMonetization(updates);
    }
  }, [
    monetization.campaign,
    monetization.compaignBotVoiceId,
    monetization.profilePicture,
  ]);

  useEffect(() => {
    if (monetization.category !== RIZZ_MONETIZATION_CATEGORY) return;
    const nextStartMessage = rizzConfig.intro_message ?? "";
    // If rizz intro_message_voice_id is empty, use "me" voice from Text to Speech tab
    const nextMeVoiceId = rizzConfig.intro_message_voice_id?.trim() || chatMeVoiceId;
    const updates: Partial<typeof monetization> = {};

    if (monetization.startMessage !== nextStartMessage) {
      updates.startMessage = nextStartMessage;
    }
    if (monetization.meVoiceId !== nextMeVoiceId) {
      updates.meVoiceId = nextMeVoiceId;
    }

    if (Object.keys(updates).length > 0) {
      updateMonetization(updates);
    }
  }, [
    monetization.category,
    monetization.startMessage,
    monetization.meVoiceId,
    rizzConfig.intro_message,
    rizzConfig.intro_message_voice_id,
    chatMeVoiceId,
  ]);

  const handleCampaignChange = (campaign: string) => {
    const campaignConfig = getMonetizationCampaignConfig(campaign);
    const updates: Partial<typeof monetization> = { campaign };

    if (campaignConfig?.compaignBotVoiceId) {
      updates.compaignBotVoiceId = campaignConfig.compaignBotVoiceId;
    }

    if (campaignConfig?.profilePicture) {
      updates.profilePicture = campaignConfig.profilePicture;
    }

    updateMonetization(updates);
  };

  const handleCategoryChange = (category: string) => {
    const campaigns = getMonetizationCampaignsForCategory(category);
    const nextCampaign = campaigns[0] ?? "";
    const updates: Partial<typeof monetization> = {
      category,
      campaign: nextCampaign,
    };
    if (category === RIZZ_MONETIZATION_CATEGORY) {
      updates.rizz_config = monetization.rizz_config ?? DEFAULT_RIZZ_MONETIZATION_CONFIG;
    }
    updateMonetization(updates);
  };

  const handleMessageChange = (
    id: string,
    updates: Partial<(typeof monetization.messages)[number]>,
  ) => {
    const nextMessages = monetization.messages.map((msg) =>
      msg.id === id ? { ...msg, ...updates } : msg,
    );
    updateMonetization({ messages: nextMessages });
  };

  const handleAddMessage = () => {
    if (!monetizationEnabled) return;
    const nextMessages = [
      ...monetization.messages,
      {
        id: `mono-${Date.now()}`,
        sender: "them" as const,
        text: "",
        voiceId: "",
        audioDuration: 0,
        audioPath: "",
        showArrow: false,
        audio_type: "original" as const,
      },
    ];
    updateMonetization({ messages: nextMessages });
  };

  const handleRemoveMessage = (id: string) => {
    if (!monetizationEnabled) return;
    const nextMessages = monetization.messages.filter((msg) => msg.id !== id);
    updateMonetization({ messages: nextMessages });
  };

  const commitStartMessage = () => {
    if (startMessageDraft !== (monetization.startMessage ?? "")) {
      updateMonetization({ startMessage: startMessageDraft });
    }
  };

  useEffect(() => {
    // Keep local drafts in sync with the latest monetization messages, while preserving edits in progress
    setMessageDrafts((prev) => {
      const next: Record<string, string> = {};
      monetization.messages.forEach((msg) => {
        next[msg.id] = prev[msg.id] ?? msg.text;
      });
      return next;
    });
  }, [monetization.messages]);

  useEffect(() => {
    setStartMessageDraft(monetization.startMessage ?? "");
  }, [monetization.startMessage]);

  useEffect(() => {
    setMeVoiceIdDraft(monetization.meVoiceId ?? "");
  }, [monetization.meVoiceId]);

  const commitMeVoiceId = () => {
    const trimmed = meVoiceIdDraft.trim();
    if (trimmed === (monetization.meVoiceId ?? "")) return;
    updateMonetization({ meVoiceId: trimmed });
    setMeVoiceIdDraft(trimmed);
  };

  const availableCampaigns = getMonetizationCampaignsForCategory(
    monetization.category,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card
        style={{
          background: palette.card,
          border: `1px solid ${palette.stroke}`,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Switch
          checked={monetizationEnabled}
          onChange={(checked) => updateMonetization({ enabled: checked })}
          label={
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Monetization takeover
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: palette.textSubtle,
                  maxWidth: 520,
                  lineHeight: 1.5,
                }}
              >
                Toggle this on to inject the Cantina app chat.
              </p>
            </div>
          }
          hint="+20 tokens when on"
        />
        {!monetizationEnabled && (
          <div
            style={{
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: `1px dashed ${palette.stroke}`,
              color: palette.textSubtle,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Monetization is currently off. Turn it on if you want Cantina app
            promotion within the video.
          </div>
        )}
      </Card>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          opacity: monetizationEnabled ? 1 : 0.5,
          filter: monetizationEnabled ? "none" : "grayscale(0.08)",
          pointerEvents: monetizationEnabled ? "auto" : "none",
        }}
        aria-disabled={!monetizationEnabled}
      >
        <Card
          style={{
            background: palette.bg,
            border: `1px solid ${palette.stroke}`,
            padding: 18,
            boxShadow: "0 16px 32px rgba(0,0,0,0.35)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Interrupt with a branded chat
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: palette.textSubtle,
                  lineHeight: 1.5,
                }}
              >
                Configure the takeover window: pick the campaign, add the intro
                line, and the messages.
              </p>
            </div>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: palette.card,
                border: `1px solid ${palette.stroke}`,
                fontSize: 12,
                color: palette.textSubtle,
                lineHeight: 1.45,
              }}
            >
              <strong style={{ color: "#fff" }}>Trigger:</strong> add command{" "}
              <CopyableCodeSnippet
                text={"> Insert monetization <"}
                palette={palette}
              />
              after any message to begin the promotion.
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
              gap: 12,
            }}
          >
            <label
              style={{
                background: palette.card,
                border: `1px solid ${palette.stroke}`,
                borderRadius: 12,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: palette.textSubtle,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
              >
                Category
              </div>
              <select
                value={monetization.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={!monetizationEnabled}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: palette.cardAlt,
                  color: "white",
                  border: `1px solid ${palette.stroke}`,
                }}
              >
                {MONETIZATION_CATEGORY_OPTIONS.map((opt) => (
                  <option value={opt} key={opt} style={{ color: "black" }}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>

            {monetization.category !== RIZZ_MONETIZATION_CATEGORY && (
              <label
                style={{
                  background: palette.card,
                  border: `1px solid ${palette.stroke}`,
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: palette.textSubtle,
                    letterSpacing: 0.3,
                    textTransform: "uppercase",
                  }}
                >
                  Monetization "me" voice ID
                </div>
                <input
                  type="text"
                  value={meVoiceIdDraft}
                  onChange={(e) => setMeVoiceIdDraft(e.target.value)}
                  onBlur={commitMeVoiceId}
                  disabled={!monetizationEnabled}
                  placeholder="Voice ID (e.g., pNInz6obpgDQGcFmaJgB)"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: palette.cardAlt,
                    color: "white",
                    border: `1px solid ${palette.stroke}`,
                    fontSize: 13,
                  }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: palette.textSubtle }}>
                    Used for the intro line and any "me" replies during the takeover. Required for generation.
                  </span>
                  {chatMeVoiceId.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        updateMonetization({ meVoiceId: chatMeVoiceId.trim() });
                        setMeVoiceIdDraft(chatMeVoiceId.trim());
                      }}
                      disabled={!monetizationEnabled}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: `1px solid ${palette.stroke}`,
                        background: palette.cardAlt,
                        color: "white",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      Use chat "Me" voice
                    </button>
                  )}
                </div>
              </label>
            )}

            <label
              style={{
                background: palette.card,
                border: `1px solid ${palette.stroke}`,
                borderRadius: 12,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: palette.textSubtle,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
              >
                Campaign
              </div>
              <select
                value={monetization.campaign}
                onChange={(e) => handleCampaignChange(e.target.value)}
                disabled={!monetizationEnabled || !availableCampaigns.length}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: palette.cardAlt,
                  color: "white",
                  border: `1px solid ${palette.stroke}`,
                }}
              >
                {availableCampaigns.length ? (
                  availableCampaigns.map((opt) => (
                    <option value={opt} key={opt} style={{ color: "black" }}>
                      {opt}
                    </option>
                  ))
                ) : (
                  <option value="" style={{ color: "black" }}>
                    No campaigns available
                  </option>
                )}
              </select>
            </label>
          </div>

          {monetization.category === RIZZ_MONETIZATION_CATEGORY && (
            <RizzMonetizationSettings
              config={rizzConfig}
              onChange={handleRizzConfigChange}
              disabled={!monetizationEnabled}
              palette={palette}
            />
          )}

          {monetization.category !== RIZZ_MONETIZATION_CATEGORY && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
                gap: 12,
                alignItems: "stretch",
              }}
            >
              <label
                style={{
                  background: palette.card,
                  border: `1px solid ${palette.stroke}`,
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: palette.textSubtle,
                    letterSpacing: 0.3,
                    textTransform: "uppercase",
                  }}
                >
                  Switch intro line
                </div>
                <textarea
                  value={startMessageDraft}
                  onChange={(e) => setStartMessageDraft(e.target.value)}
                  onBlur={commitStartMessage}
                  disabled={!monetizationEnabled}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: `1px solid ${palette.stroke}`,
                    background: palette.cardAlt,
                    color: "white",
                    resize: "vertical",
                    minHeight: 78,
                    fontSize: 13,
                  }}
                  placeholder="E.g. Switching you to Cantina Roast Bot, one sec..."
                />
                <div style={{ fontSize: 12, color: palette.textSubtle }}>
                  This plays without any visuals before the first text bubble
                  appears.
                </div>
              </label>
            </div>
          )}
        </Card>
        {monetization.category !== RIZZ_MONETIZATION_CATEGORY && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 4,
              }}
            >
              <h3
                style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}
              >
                Monetization Messages
                <span style={{ fontSize: 12, color: palette.textSubtle }}>
                  {monetization.messages.length} added
                </span>
              </h3>
              <Button
                onClick={handleAddMessage}
                variant="ghost"
                disabled={!monetizationEnabled}
              >
                + Add message
              </Button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {monetization.messages.map((msg, idx) => (
                <Card
                  key={msg.id}
                  style={{
                    padding: 14,
                    border: `1px solid ${palette.stroke}`,
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                    boxShadow: "0 10px 26px rgba(0,0,0,0.25)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: palette.accentSoft,
                          color: palette.accent,
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                        aria-label={`Message ${idx + 1}`}
                      >
                        {idx + 1}
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          borderRadius: 10,
                          overflow: "hidden",
                          border: `1px solid ${palette.stroke}`,
                          background: palette.cardAlt,
                        }}
                        role="group"
                        aria-label="Choose sender"
                      >
                        {(["me", "them"] as const).map((option) => {
                          const isActive = msg.sender === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() =>
                                handleMessageChange(msg.id, { sender: option })
                              }
                              disabled={!monetizationEnabled}
                              style={{
                                padding: "8px 12px",
                                background: isActive
                                  ? palette.accentSoft
                                  : "transparent",
                                color: "white",
                                border: "none",
                                borderRight:
                                  option === "me"
                                    ? `1px solid ${palette.stroke}`
                                    : "none",
                                cursor: "pointer",
                                fontWeight: isActive ? 700 : 500,
                                fontSize: 12,
                              }}
                            >
                              {option === "me" ? "Me" : "Bot"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMessage(msg.id)}
                      disabled={!monetizationEnabled}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "red",
                        cursor: "pointer",
                        fontSize: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label
                      style={{
                        fontSize: 12,
                        color: palette.textSubtle,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      Message {idx + 1}
                      <span style={{ fontSize: 11, opacity: 0.8 }}>
                        Keep it short and punchy
                      </span>
                    </label>
                    <textarea
                      value={messageDrafts[msg.id] ?? ""}
                      onChange={(e) =>
                        setMessageDrafts((prev) => ({
                          ...prev,
                          [msg.id]: e.target.value,
                        }))
                      }
                      onBlur={() => {
                        const draft = messageDrafts[msg.id] ?? "";
                        if (draft !== msg.text) {
                          handleMessageChange(msg.id, { text: draft });
                        }
                      }}
                      disabled={!monetizationEnabled}
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: `1px solid ${palette.stroke}`,
                        background: palette.card,
                        color: "white",
                        resize: "vertical",
                        minHeight: 88,
                      }}
                    />
                  </div>
                </Card>
              ))}
              {monetization.messages.length === 0 && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: palette.card,
                    border: `1px dashed ${palette.stroke}`,
                    fontSize: 13,
                    color: palette.textSubtle,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    Add at least one exchange to show in the monetization window.
                  </div>
                  <Button
                    onClick={handleAddMessage}
                    variant="ghost"
                    disabled={!monetizationEnabled}
                  >
                    Add first message
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
