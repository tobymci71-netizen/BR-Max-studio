import React from "react";
import Image from "next/image";
import { MonetizationSettings } from "@/types/constants";

type RizzSettingsPalette = {
  card: string;
  cardAlt: string;
  stroke: string;
  textSubtle: string;
};

type RizzMonetizationSettingsProps = {
  config: MonetizationSettings["rizz_config"];
  onChange: (updates: Partial<MonetizationSettings["rizz_config"]>) => void;
  palette: RizzSettingsPalette;
  disabled?: boolean;
};

export function RizzMonetizationSettings({
  config,
  onChange,
  palette,
  disabled = false,
}: RizzMonetizationSettingsProps) {
  const [introMessageDraft, setIntroMessageDraft] = React.useState(
    config.intro_message ?? "",
  );
  const [replyDraft, setReplyDraft] = React.useState(config.reply ?? "");
  const [replyVisualDraft, setReplyVisualDraft] = React.useState(
    config.reply_visual ?? "",
  );
  const [showAudioField, setShowAudioField] = React.useState(false);
  const [voiceIdDraft, setVoiceIdDraft] = React.useState(
    config.intro_message_voice_id ?? "",
  );

  // Sync drafts when config changes externally
  React.useEffect(() => {
    setIntroMessageDraft(config.intro_message ?? "");
  }, [config.intro_message]);

  React.useEffect(() => {
    setReplyDraft(config.reply ?? "");
  }, [config.reply]);

  React.useEffect(() => {
    setReplyVisualDraft(config.reply_visual ?? "");
  }, [config.reply_visual]);

  React.useEffect(() => {
    setVoiceIdDraft(config.intro_message_voice_id ?? "");
  }, [config.intro_message_voice_id]);

  const updateField = (
    field: keyof MonetizationSettings["rizz_config"],
    value: string,
  ) => {
    onChange({ [field]: value });
  };

  // Immediate update helper that ensures changes are applied right away
  const immediateUpdate = (field: keyof MonetizationSettings["rizz_config"], value: string) => {
    updateField(field, value);
  };

  const hasImage = Boolean(config.image?.trim());
  const hasIntroMessage = Boolean(config.intro_message?.trim());
  const hasReply = Boolean(config.reply?.trim());

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onChange({ image: result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      style={{
        background: palette.card,
        border: `1px solid ${palette.stroke}`,
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          Rizz app settings
        </h4>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12,
            color: palette.textSubtle,
          }}
        >
          Customize the intro prompt, voice, and image that show inside the Rizz
          experience.
        </p>
      </div>

      <label
        style={{
          fontSize: 12,
          color: palette.textSubtle,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        Upload image <span style={{ color: "#ff6b6b" }}>*</span>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          disabled={disabled}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${hasImage ? palette.stroke : "#ff6b6b"}`,
            background: palette.cardAlt,
            color: "white",
            fontSize: 13,
          }}
        />
        {!hasImage && (
          <span style={{ fontSize: 11, color: "#ff6b6b" }}>
            Image is required for Rizz monetization
          </span>
        )}
      </label>

      {config.image && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderRadius: 10,
            padding: "10px 12px",
            background: palette.cardAlt,
          }}
        >
          <Image
            src={config.image}
            alt="Rizz preview"
            width={80}
            height={80}
            unoptimized
            style={{
              objectFit: "cover",
              borderRadius: 8,
            }}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateField("image", "")}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${palette.stroke}`,
              background: "transparent",
              color: "white",
              cursor: disabled ? "not-allowed" : "pointer",
              fontSize: 12,
            }}
          >
            Remove image
          </button>
        </div>
      )}

      <label
        style={{
          fontSize: 12,
          color: palette.textSubtle,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <p>
          Intro message <span style={{ color: "#ff6b6b" }}>*</span>
        </p>
        <textarea
          rows={3}
          value={introMessageDraft}
          onChange={(event) => {
            const newValue = event.target.value;
            setIntroMessageDraft(newValue);
            immediateUpdate("intro_message", newValue);
          }}
          disabled={disabled}
          placeholder="Rizz app tells me to reply with..."
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${hasIntroMessage ? palette.stroke : "#ff6b6b"}`,
            background: palette.cardAlt,
            color: "white",
            resize: "vertical",
            fontSize: 13,
          }}
        />
        {!hasIntroMessage && (
          <span style={{ fontSize: 11, color: "#ff6b6b" }}>
            Intro message is required for Rizz monetization
          </span>
        )}
      </label>

      <label
        style={{
          fontSize: 12,
          color: palette.textSubtle,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <p>
          Rizz reply <span style={{ color: "#ff6b6b" }}>*</span>
        </p>
        <textarea
          rows={3}
          value={replyVisualDraft}
          onChange={(event) => {
            const newValue = event.target.value;
            setReplyVisualDraft(newValue);
            if (!showAudioField) {
              setReplyDraft(newValue);
            }
            // Update parent immediately
            immediateUpdate("reply_visual", newValue);
            if (!showAudioField) {
              immediateUpdate("reply", newValue);
            }
          }}
          disabled={disabled}
          placeholder="Enter the reply text that will appear in the chat..."
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${hasReply ? palette.stroke : "#ff6b6b"}`,
            background: palette.cardAlt,
            color: "white",
            resize: "vertical",
            fontSize: 13,
          }}
        />
        {!hasReply && (
          <span style={{ fontSize: 11, color: "#ff6b6b" }}>
            Rizz reply is required for Rizz monetization
          </span>
        )}
        {!showAudioField && (
          <span style={{ fontSize: 11, color: palette.textSubtle, opacity: 0.8 }}>
            This text will be used for both visual display and audio generation.{" "}
            <button
              type="button"
              onClick={() => setShowAudioField(true)}
              disabled={disabled}
              style={{
                background: "none",
                border: "none",
                color: "#4ade80",
                textDecoration: "underline",
                cursor: disabled ? "not-allowed" : "pointer",
                padding: 0,
                fontSize: 11,
              }}
            >
              Click here to set different text for audio
            </button>
          </span>
        )}
      </label>

      {showAudioField && (
        <label
          style={{
            fontSize: 12,
            color: palette.textSubtle,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          Audio text (for TTS generation)
          <textarea
            rows={3}
            value={replyDraft}
            onChange={(event) => {
              const newValue = event.target.value;
              setReplyDraft(newValue);
              immediateUpdate("reply", newValue);
            }}
            disabled={disabled}
            placeholder="Leave empty to use the text above, or type custom audio script here..."
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${palette.stroke}`,
              background: palette.cardAlt,
              color: "white",
              resize: "vertical",
              fontSize: 13,
            }}
          />
          <span style={{ fontSize: 11, color: palette.textSubtle, opacity: 0.8 }}>
            This text will be used only for audio generation (TTS).{" "}
            <button
              type="button"
              onClick={() => {
                setShowAudioField(false);
                setReplyDraft(replyVisualDraft);
                updateField("reply", replyVisualDraft);
              }}
              disabled={disabled}
              style={{
                background: "none",
                border: "none",
                color: "#ff6b6b",
                textDecoration: "underline",
                cursor: disabled ? "not-allowed" : "pointer",
                padding: 0,
                fontSize: 11,
              }}
            >
              Hide and use same text for both
            </button>
          </span>
        </label>
      )}

      <label
        style={{
          fontSize: 12,
          color: palette.textSubtle,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        Intro message voice ID (Optional)
        <input
          type="text"
          value={voiceIdDraft}
          onChange={(event) => {
            const newValue = event.target.value;
            setVoiceIdDraft(newValue);
            immediateUpdate("intro_message_voice_id", newValue);
          }}
          disabled={disabled}
          placeholder="Leave empty to use 'Me' voice from Text to Speech tab"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${palette.stroke}`,
            background: palette.cardAlt,
            color: "white",
            fontSize: 13,
          }}
        />
        <span style={{ fontSize: 11, color: palette.textSubtle, opacity: 0.8 }}>
          If empty, will use the 'Me' voice configured in the Text to Speech tab
        </span>
      </label>
    </div>
  );
}
