import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Image from "next/image";
import { Input } from "../../Input";
import { Modal } from "../../Modal";
import { AutoGrowTextArea } from "../../AutoGrowTextArea";
import { useToast } from "../../../hooks/useToast";
import {
  Upload,
  Sparkles,
  Check,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  CheckCircle,
  Image as ImageIcon,
} from "lucide-react";
import { useStudioForm } from "../StudioProvider";
import { useScriptParser } from "../hooks/useScriptParser";
import { CONVERSATION_COMMAND_REGEX } from "../../../helpers/messageCommands";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DEFAULT_SCRIPT_TEMPLATE,
  SCRIPT_EDITOR_STORAGE_KEY,
} from "../constants";

const AI_CONVERSION_PROMPT = `Please convert this script into the BR-MAX chat format EXACTLY following the rules below.

STRICT FORMAT RULES (DO NOT BREAK THEM):

1. Only two prefixes are allowed, ALWAYS lowercase exactly like this:
   - "me:"    → my messages (right side)
   - "them:"  → their messages (left side)

2. Every NEW chat bubble MUST start with one of those prefixes.
   NEVER remove prefixes unless Rule 3 applies.
   NEVER invent new names or new prefixes.

3. Only remove the prefix IF AND ONLY IF you are continuing the *same bubble* as a paragraph.  
   - This only happens when the original script clearly shows the same person continuing the SAME message thought.
   - If the original script has separate lines, treat them as separate bubbles WITH PREFIXES.
   - Do NOT merge bubbles unless the script shows it is one long sentence broken across lines.

4. To switch conversation:
   Add a standalone line EXACTLY like this (do not modify spacing or arrows):
   > Conversation with NAME <

5. Allowed commands (must always be on their own line):
  > Conversation with NAME < - Used to change the conversation
  > change theme to dark < - Used to change the theme of the chat from light to dark
  > change theme to light < - Used to change the theme of the chat from dark to light
  > Insert monetization < - Used to insert a monetization chat at that line
  > show arrow < - Used after the monetization to show a down arrow (comes before the message (to show the arrow on the next message))

6. Preserve the chronological order EXACTLY.  
   Do not rearrange, remove, or add content.

7. Do NOT remove prefixes randomly.  
   DO NOT create paragraph breaks unless the original message is CLEARLY one bubble split across lines.

8. NO empty blank lines between bubbles.

9. OUTPUT MUST BE IN A CODE BLOCK.

-----------------------------------------------------
Now convert the script below EXACTLY according to the above rules:

[PASTE YOUR SCRIPT HERE]
`;
const imageUploadsCache: Record<string, File | null> = {};

function getInitialScriptText() {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(SCRIPT_EDITOR_STORAGE_KEY);
    if (saved !== null) return saved;
  }
  return DEFAULT_SCRIPT_TEMPLATE;
}

export function ScriptStep() {
  const { formValues, updateChatSettings, updateFormValues } = useStudioForm();
  const { parseScript, importFromFile } = useScriptParser();
  const toast = useToast();

  const [scriptText, setScriptText] = useState(getInitialScriptText);
  const [copied, setCopied] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [aiPromptModalOpen, setAiPromptModalOpen] = useState(false);
  const [imageUploads, setImageUploads] = useState<Record<string, File | null>>(
    () => ({ ...imageUploadsCache }),
  );
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wasFocusedRef = useRef(false);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const latestVoicesRef = useRef(formValues.voices);
  const [recipientNameDraft, setRecipientNameDraft] = useState(
    formValues.CHAT_SETTINGS.recipientName ?? "",
  );

  const overridingConversationLine = useMemo(() => {
    const lines = scriptText.split(/\r?\n/);
    let sawMessagePrefix = false;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      if (!sawMessagePrefix) {
        CONVERSATION_COMMAND_REGEX.lastIndex = 0;
        if (CONVERSATION_COMMAND_REGEX.test(trimmed)) {
          return trimmed;
        }
      }

      const normalized = trimmed.toLowerCase();
      if (normalized.startsWith("me:") || normalized.startsWith("them:")) {
        sawMessagePrefix = true;
        break;
      }
    }

    return undefined;
  }, [scriptText]);

  useEffect(() => {
    latestVoicesRef.current = formValues.voices;
  }, [formValues.voices]);
  useEffect(() => {
    setRecipientNameDraft(formValues.CHAT_SETTINGS.recipientName ?? "");
  }, [formValues.CHAT_SETTINGS.recipientName]);

  const mergeVoiceAssignments = useCallback(
    (parsedVoices: typeof formValues.voices) => {
      const current = latestVoicesRef.current || [];
      const normalize = (value: string) => value.trim().toLowerCase();

      return parsedVoices.map((voice) => {
        const existing = current.find(
          (candidate) => normalize(candidate.name) === normalize(voice.name),
        );

        return {
          ...voice,
          voiceId: existing?.voiceId ?? voice.voiceId ?? "",
        };
      });
    },
    [],
  );

  // Load saved script from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(SCRIPT_EDITOR_STORAGE_KEY);
    if (saved !== null) {
      setScriptText(saved);
    }
  }, []);

  const applyParsedScript = useCallback(() => {
    if (!scriptText.trim()) return;

    try {
      const { messages, voices } = parseScript(scriptText);
      updateFormValues({ messages, voices: mergeVoiceAssignments(voices) });
    } catch (error) {
      console.error("Parse error:", error);
    }
  }, [mergeVoiceAssignments, parseScript, scriptText, updateFormValues]);

  // Auto-save script only (parsing happens on blur)
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SCRIPT_EDITOR_STORAGE_KEY, scriptText);
  }, [scriptText]);

  useEffect(() => {
    if (wasFocusedRef.current) return;
    if (!scriptText.trim()) return;
    applyParsedScript();
  }, [applyParsedScript, scriptText]);

  const handleFileUpload = (file: File) => {
    importFromFile(file, (data) => {
      setScriptText(data.rawText);
      updateFormValues({
        messages: data.messages,
        voices: mergeVoiceAssignments(data.voices),
      });
      toast.showToast({
        message: "File uploaded successfully!",
        type: "success",
      });
    });
  };

  const handleInsertSampleScript = useCallback(() => {
    const sample = DEFAULT_SCRIPT_TEMPLATE;
    setScriptText(sample);
    try {
      const { messages, voices } = parseScript(sample);
      updateFormValues({
        messages,
        voices: mergeVoiceAssignments(voices),
      });
    } catch (error) {
      console.error("Failed to insert sample script:", error);
    }
  }, [mergeVoiceAssignments, parseScript, updateFormValues]);

  const copyAIPrompt = async () => {
    setAiPromptModalOpen(true);
    try {
      await navigator.clipboard.writeText(AI_CONVERSION_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.showToast({ message: "Failed to copy prompt", type: "error" });
    }
  };

  const messageCount = formValues.messages.filter(
    (m) => m.type === "text",
  ).length;
  const speakerCount = formValues.voices.length;
  const recipientDisplayName = useMemo(
    () => formValues.CHAT_SETTINGS.recipientName?.trim() ?? "",
    [formValues.CHAT_SETTINGS.recipientName],
  );
  const scriptRecipientNames = useMemo(() => {
    const names: string[] = [];
    const regex = new RegExp(CONVERSATION_COMMAND_REGEX.source, "gi");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(scriptText)) !== null) {
      const candidate = match[1].trim();
      if (!candidate) continue;

      const normalizedCandidate = candidate.toLowerCase();
      const alreadyTracked = names.some(
        (existing) => existing.toLowerCase() === normalizedCandidate,
      );

      if (!alreadyTracked) {
        names.push(candidate);
      }
    }

    return names;
  }, [scriptText]);
  const tooltipRecipientNames = useMemo(() => {
    if (scriptRecipientNames.length > 0) {
      return scriptRecipientNames;
    }

    const customSpeakerNames = formValues.voices
      .map((voice) => voice.name.trim())
      .filter((name) => name && name.toLowerCase() !== "me");
    if (customSpeakerNames.length > 0) {
      return customSpeakerNames;
    }

    if (recipientDisplayName) {
      return [recipientDisplayName];
    }

    return ["Them"];
  }, [formValues.voices, recipientDisplayName, scriptRecipientNames]);
  const tooltipLines = useMemo(() => {
    const entries: string[] = [];
    const seenRecipients = new Set<string>();

    entries.push("- Me (Sender)");

    tooltipRecipientNames.forEach((name) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const normalized = trimmed.toLowerCase();
      if (normalized === "me") return;

      const displayName =
        normalized === "them" && recipientDisplayName
          ? recipientDisplayName
          : trimmed;
      const normalizedDisplay = displayName.toLowerCase();
      if (seenRecipients.has(normalizedDisplay)) return;
      seenRecipients.add(normalizedDisplay);

      entries.push(`- ${displayName} - (Recipient)`);
    });

    return entries;
  }, [tooltipRecipientNames, recipientDisplayName]);

  const imagePlaceholders = useMemo(() => {
    const names = new Set<string>();
    // Match > image filename < pattern anywhere in the script
    const regex = />\s*image\s+(.+?)\s*</gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(scriptText)) !== null) {
      const candidate = match[1]?.trim();
      if (!candidate) continue;
      names.add(candidate);
    }

    return Array.from(names);
  }, [scriptText]);

  useEffect(() => {
    setImageUploads((prev) => {
      const next: Record<string, File | null> = {};
      imagePlaceholders.forEach((name) => {
        next[name] = prev[name] ?? imageUploadsCache[name] ?? null;
      });
      Object.keys(imageUploadsCache).forEach((key) => {
        if (!imagePlaceholders.includes(key)) {
          delete imageUploadsCache[key];
        }
      });
      imagePlaceholders.forEach((name) => {
        imageUploadsCache[name] = next[name];
      });
      return next;
    });

    // Load saved image previews from localStorage
    const previews: Record<string, string> = {};
    imagePlaceholders.forEach((name) => {
      try {
        const saved = localStorage.getItem(`br-max-image-${name}`);
        if (saved) {
          previews[name] = saved;
        }
      } catch (error) {
        console.error("Failed to load image from localStorage:", error);
      }
    });
    setImagePreviewUrls(previews);
  }, [imagePlaceholders]);

  const handleImageFileChange = useCallback((placeholder: string, file: File | null) => {
    setImageUploads((prev) => {
      const next = { ...prev, [placeholder]: file };
      imageUploadsCache[placeholder] = file;
      return next;
    });

    // Create preview URL and save to localStorage
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setImagePreviewUrls((prev) => ({ ...prev, [placeholder]: dataUrl }));

        // Save to localStorage
        try {
          localStorage.setItem(`br-max-image-${placeholder}`, dataUrl);
        } catch (error) {
          console.error("Failed to save image to localStorage:", error);
        }
      };
      reader.readAsDataURL(file);
    } else {
      // Clear preview and localStorage if file is removed
      setImagePreviewUrls((prev) => {
        const next = { ...prev };
        delete next[placeholder];
        return next;
      });
      try {
        localStorage.removeItem(`br-max-image-${placeholder}`);
      } catch (error) {
        console.error("Failed to remove image from localStorage:", error);
      }
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Script Editor */}
      <div
        style={{
          padding: 28,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 16,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MessageSquare size={22} style={{ color: "#a78bfa" }} />
              <h4 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                Create Your Conversation Script
              </h4>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setGuideOpen(true)}
                title="Open the format guide and examples"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(96,165,250,0.15)",
                  border: "1px solid rgba(96,165,250,0.4)",
                  borderRadius: 999,
                  color: "#bfdbfe",
                  cursor: "pointer",
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <HelpCircle size={14} />
                Format guide
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload a .txt file to load your script"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(167,139,250,0.15)",
                  border: "1px solid rgba(167,139,250,0.4)",
                  borderRadius: 999,
                  color: "#ddd6fe",
                  cursor: "pointer",
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Upload size={14} />
                Upload .txt
              </button>

              <button
                type="button"
                onClick={copyAIPrompt}
                title="Copy an AI helper prompt to convert any script"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: copied
                    ? "rgba(16,185,129,0.35)"
                    : "rgba(52,211,153,0.2)",
                  border: `1px solid ${copied ? "rgba(16,185,129,0.6)" : "rgba(52,211,153,0.4)"}`,
                  borderRadius: 999,
                  color: "#d1fae5",
                  cursor: "pointer",
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {copied ? <Check size={14} /> : <Sparkles size={14} />}
                {copied ? "Prompt copied" : "Copy AI prompt"}
              </button>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
              Type or upload your script below.
            </p>
            <button
              type="button"
              onClick={handleInsertSampleScript}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: "#a5b4fc",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                opacity: 0.9,
                textDecoration: "underline",
              }}
            >
              Insert Sample Script
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileUpload(file);
              e.target.value = "";
            }
          }}
        />

        <AutoGrowTextArea
          ref={textareaRef}
          minRows={16}
          maxRows={24}
          value={scriptText}
          onChange={(e) => {
            const textarea = e.target;
            selectionRef.current = {
              start: textarea.selectionStart,
              end: textarea.selectionEnd,
            };
            setScriptText(e.target.value);
          }}
          onFocus={() => {
            wasFocusedRef.current = true;
            if (textareaRef.current) {
              selectionRef.current = {
                start: textareaRef.current.selectionStart,
                end: textareaRef.current.selectionEnd,
              };
            }
          }}
          onBlur={() => {
            wasFocusedRef.current = false;
            selectionRef.current = null;
            applyParsedScript();
          }}
          placeholder={DEFAULT_SCRIPT_TEMPLATE}
          style={{
            fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
            fontSize: 14,
            background: "rgba(0,0,0,0.4)",
            border: "2px solid rgba(255,255,255,0.15)",
            borderRadius: 12,
            padding: 18,
            color: "#fff",
            lineHeight: 1.8,
            resize: "vertical",
          }}
        />

        {imagePlaceholders.length > 0 && (
          <div
            style={{
              marginTop: 12,
              padding: "12px 14px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ImageIcon size={16} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  Images referenced in script
                </span>
              </div>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                {imagePlaceholders.length} placeholder{imagePlaceholders.length !== 1 ? "s" : ""} found
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 10,
              }}
            >
              {imagePlaceholders.map((name) => {
                const uploadId = `image-upload-${name.replace(/\s+/g, "-")}`;
                const selectedFile = imageUploads[name];
                const previewUrl = imagePreviewUrls[name];

                return (
                  <label
                    key={name}
                    htmlFor={uploadId}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: "rgba(0,0,0,0.35)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      cursor: "pointer",
                      minHeight: previewUrl ? 180 : 72,
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Image name</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>

                    {previewUrl && (
                      <div
                        style={{
                          marginTop: 8,
                          borderRadius: 8,
                          overflow: "hidden",
                          maxHeight: 120,
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          background: "rgba(0,0,0,0.5)",
                        }}
                      >
                        <Image
                          src={previewUrl}
                          alt={name}
                          width={320}
                          height={120}
                          unoptimized
                          style={{
                            maxWidth: "100%",
                            maxHeight: 120,
                            objectFit: "contain",
                          }}
                        />
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ opacity: 0.75 }}>
                        {selectedFile ? `Selected: ${selectedFile.name}` : "Attach image file"}
                      </div>
                      <div
                        style={{
                          padding: "4px 8px",
                          borderRadius: 8,
                          border: "1px dashed rgba(255,255,255,0.2)",
                          color: "#d1d5db",
                        }}
                      >
                        {previewUrl ? "Change" : "Upload"}
                      </div>
                    </div>
                    <input
                      id={uploadId}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        handleImageFileChange(name, file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            opacity: 0.7,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {messageCount > 0 ? (
              <>
                <CheckCircle size={14} style={{ color: "#00ff88" }} />
                <span style={{ opacity: 0.8 }}>
                  {messageCount} msg •{" "}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          style={{
                            cursor: "help",
                            textDecoration: "underline",
                            textDecorationStyle: "dotted",
                          }}
                        >
                          {speakerCount} speaker{speakerCount !== 1 ? "s" : ""}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          {tooltipLines.length > 0 ? (
                            tooltipLines.map((line, index) => (
                              <div key={index} style={{ fontSize: 13 }}>
                                {line}
                              </div>
                            ))
                          ) : (
                            <div style={{ fontSize: 13 }}>No speakers</div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={14} style={{ color: "#ffcc00" }} />
                <span style={{ opacity: 0.7 }}>No messages yet</span>
              </>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Lightbulb size={14} />
            <span>Tip: Start each message with "me:" or "them:"</span>
          </div>
          <div>Auto-saves as you type</div>
        </div>
      </div>
      {/* Basic settings */}
      <div
        style={{
          padding: 28,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 16,
          position: "relative",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
            Customize Chat Basics
          </h4>
          <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
            Set up the recipient name for your conversation
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Input
            label="Recipient Name"
            required
            value={recipientNameDraft}
            onChange={(e) => setRecipientNameDraft(e.target.value)}
            onBlur={() => {
              const trimmed = recipientNameDraft.trim();
              updateChatSettings("recipientName", trimmed);
              setRecipientNameDraft(trimmed);
            }}
            placeholder="e.g., Alice"
            hint="The name shown at the top of the chat screen"
          />
          {overridingConversationLine && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "#fef9c3",
                background: "rgba(251,191,36,0.12)",
                border: "1px solid rgba(251,191,36,0.35)",
                borderRadius: 10,
                padding: "10px 12px",
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={14} style={{ color: "#facc15" }} />
              <span>
                <code
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    padding: "1px 5px",
                    borderRadius: 4,
                    marginRight: 4,
                  }}
                >
                  {`{${overridingConversationLine}}`}
                </code>
                in your script is going to override this value.
              </span>
            </div>
          )}
        </div>
      </div>
      {/* Format Guide Modal */}
      <Modal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="Script Format Guide"
        width={900}
      >
        <div style={{ padding: "0 4px" }}>
          {/* Speaker Types */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
              Speaker Types
            </h4>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: 14,
                  background: "rgba(30,64,175,0.15)",
                  border: "11px solid rgba(59,130,246,0.4)",
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "#60a5fa",
                  }}
                >
                  me: (You)
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Appears on the <strong>right</strong> in blue bubbles
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  background: "rgba(15,118,110,0.15)",
                  border: "1px solid rgba(20,184,166,0.4)",
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "#5eead4",
                  }}
                >
                  them: (Recipient)
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Appears on the <strong>left</strong> in gray bubbles
                </div>
              </div>
            </div>
          </div>

          {/* Basic Rules */}
          <div style={{ marginBottom: 24 }}>
            <h4
              style={{
                fontSize: 15,
                fontWeight: 600,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CheckCircle size={18} />
              Basic Rules (Read This Only)
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <RuleCard
                number="1"
                title="Start every message with me: or them:"
                description='Every bubble MUST start with "me:" or "them:"'
                example={`me: Need the update?\nthem: Sending now!`}
                color="rgba(59,130,246,0.3)"
              />

              <RuleCard
                number="2"
                title="Multi-line message"
                description="Remove the me: / them: to continue a message in new line in the same bubble"
                example={`me: Bro today's plan:\n1.Finish scene\n2. Add audio\n\nLet me know once done.`}
                color="rgba(168,85,247,0.3)"
              />

              <RuleCard
                number="3"
                title="New chat"
                description={(<div>Start a new chat using <code>&gt; Conversation with Name &lt;</code></div>)}
                example={`> Conversation with Sarah <\nme: Ready?\nthem: Give me 2 mins!`}
                color="rgba(16,185,129,0.3)"
              />
              <RuleCard
                number="4"
                title="Mask offensive words"
                description="Wrap the portion you want blurred between two asterisks (*) so the marker text stays hidden on-screen."
                example={`me: Yo whats up motherf*ucker*`}
                color="rgba(244,114,182,0.3)"
              />
            </div>
          </div>

          {/* Monetization */}
          <div style={{ marginBottom: 24 }}>
            <h4
              style={{
                fontSize: 15,
                fontWeight: 600,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Lightbulb size={18} />
              Monetization
            </h4>

            <div
              style={{
                fontSize: 12,
                lineHeight: 1.7,
                opacity: 0.9,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <strong>1.</strong> Add your monetization messages in the
              Monetization tab
              <br />
              <strong>2.</strong> Insert monetization at any point by adding:
              <pre
                style={{
                  marginTop: 6,
                  background: "rgba(255,255,255,0.06)",
                  padding: "6px 8px",
                  borderRadius: 6,
                }}
              >
                {`> Insert monetization <`}
              </pre>
              <strong>3.</strong> A Cantina app promotion will play, then your
              script continues.
            </div>
          </div>

          {/* Quick Commands Table */}
          <div style={{ marginBottom: 24 }}>
            <details
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                📘 Quick Command Reference (Tap to Expand)
              </summary>

              <div
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  lineHeight: 1.6,
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "8px 6px",
                          borderBottom: "1px solid rgba(255,255,255,0.1)",
                          fontWeight: 600,
                        }}
                      >
                        Command
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "8px 6px",
                          borderBottom: "1px solid rgba(255,255,255,0.1)",
                          fontWeight: 600,
                        }}
                      >
                        What it does
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td style={{ padding: "6px 6px", whiteSpace: "nowrap" }}>
                        <code>&gt; Conversation with NAME &lt;</code>
                      </td>
                      <td style={{ padding: "6px 6px" }}>
                        Switch to a new chat/recipient.
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: "6px 6px", whiteSpace: "nowrap" }}>
                        <code>&gt; Insert monetization &lt;</code>
                      </td>
                      <td style={{ padding: "6px 6px" }}>
                        Plays the monetization mini-chat here.
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: "6px 6px", whiteSpace: "nowrap" }}>
                        <code>&gt; change recipient name to Casey &lt;</code>
                      </td>
                      <td style={{ padding: "6px 6px" }}>
                        Renames the other person in the chat.
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: "6px 6px", whiteSpace: "nowrap" }}>
                        <code>&gt; change theme to dark &lt;</code>
                      </td>
                      <td style={{ padding: "6px 6px" }}>
                        Switches chat UI to dark mode.
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: "6px 6px", whiteSpace: "nowrap" }}>
                        <code>&gt; change theme to light &lt;</code>
                      </td>
                      <td style={{ padding: "6px 6px" }}>
                        Switches chat UI to light mode.
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: "6px 6px", whiteSpace: "nowrap" }}>
                        <code>&gt; arrow down &lt;</code>
                      </td>
                      <td style={{ padding: "6px 6px" }}>
                        Adds a bouncing down arrow on the next bubble. (Normally used after monetization chat)
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: "6px 6px", whiteSpace: "nowrap" }}>
                        <code>me: &gt; Image filename &lt;</code>
                      </td>
                      <td style={{ padding: "6px 6px" }}>
                        Creates an image upload slot for the referenced filename.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          {/* Examples */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
              Examples
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ExampleCard
                title="Simple Chat"
                description="Quick back-and-forth"
                code={`me: Hey!\nthem: Hey what's up?\nme: Making a video\nme: Need your help`}
              />

              <ExampleCard
                title="Conversation Switch"
                description="Multiple recipients"
                code={`> Conversation with Tom <\nme: Reached?\nthem: Parking rn`}
              />
            </div>
          </div>
        </div>
      </Modal>
      {/* AI Prompt Explanation Modal */}
      <Modal
        open={aiPromptModalOpen}
        onClose={() => setAiPromptModalOpen(false)}
        title="How to Use the AI Conversion Prompt"
        width={700}
      >
        <div style={{ padding: "0 4px" }}>
          {/* Header */}
          <div
            style={{
              padding: 20,
              background:
                "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.1))",
              border: "1px solid rgba(52,211,153,0.3)",
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <Sparkles size={20} style={{ color: "#34d399" }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                AI Prompt Copied! 🎉
              </h3>
            </div>
            <p
              style={{ fontSize: 14, lineHeight: 1.6, margin: 0, opacity: 0.9 }}
            >
              The conversion prompt has been copied to your clipboard. Follow
              these steps to convert your script:
            </p>
          </div>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                padding: 18,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(52,211,153,0.3)",
                borderRadius: 10,
                display: "flex",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(52,211,153,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 700,
                  flexShrink: 0,
                  color: "#34d399",
                }}
              >
                1
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  Open ChatGPT or Claude
                </div>
                <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
                  Open{" "}
                  <a target="_blank" href="https://chatgpt.com">
                    <strong className="text-[#34d399] underline">
                      chatgpt.com
                    </strong>
                  </a>{" "}
                  or{" "}
                  <a target="_blank" href="https://claude.ai">
                    <strong className="text-[#34d399] underline">
                      claude.ai
                    </strong>
                  </a>{" "}
                  on your browser
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 18,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(52,211,153,0.3)",
                borderRadius: 10,
                display: "flex",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(52,211,153,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 700,
                  flexShrink: 0,
                  color: "#34d399",
                }}
              >
                2
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  Paste the Prompt
                </div>
                <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
                  Paste the script into the chatbot but dont send it yet
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 18,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(52,211,153,0.3)",
                borderRadius: 10,
                display: "flex",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(52,211,153,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 700,
                  flexShrink: 0,
                  color: "#34d399",
                }}
              >
                3
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  Add Your Script
                </div>
                <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
                  Replace{" "}
                  <code
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    [PASTE YOUR SCRIPT HERE]
                  </code>{" "}
                  with your actual conversation script (in any format)
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 18,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(52,211,153,0.3)",
                borderRadius: 10,
                display: "flex",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(52,211,153,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 700,
                  flexShrink: 0,
                  color: "#34d399",
                }}
              >
                4
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  Get Converted Script
                </div>
                <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
                  The AI will convert your script into the correct format. Copy
                  the result and paste it back into the editor outside!
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
      <style>{`
        code {
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-size: 0.9em;
        }
      `}</style>
    </div>
  );
}

// Helper Components
function RuleCard({
  number,
  title,
  description,
  example,
  color,
}: {
  number: string;
  title: string;
  description: string | React.ReactNode;
  example: string;
  color: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${color}`,
        borderRadius: 10,
        display: "flex",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            opacity: 0.8,
            marginBottom: 10,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
        <div
          style={{
            fontFamily: "'SF Mono', Monaco, monospace",
            fontSize: 12,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: 10,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {example}
        </div>
      </div>
    </div>
  );
}

function ExampleCard({
  title,
  description,
  code,
}: {
  title: string;
  description: string;
  code: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{description}</div>
      </div>
      <div
        style={{
          fontFamily: "'SF Mono', Monaco, monospace",
          fontSize: 12,
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8,
          padding: 12,
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
        }}
      >
        {code}
      </div>
    </div>
  );
}
