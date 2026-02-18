import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
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
  Copy,
  Trash2,
  Plus,
  ChevronDown,
  Eye,
  CircleUser,
  X,
  Search,
} from "lucide-react";
import { useStudioForm } from "../StudioProvider";
import { useScriptParser, removeBracketedWords } from "../hooks/useScriptParser";
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
  > change me voice to VOICE_ID < - Used to change the sender's (me:) ElevenLabs voice ID from this point onward

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

// Tone options
const TONE_OPTIONS = [
  "Annoyed",
  "Confused",
  "Crying",
  "Curious",
  "Disappointed",
  "Embarrassed",
  "Excited",
  "Flirty",
  "Frustrated",
  "Giggling",
  "Grateful",
  "Happy",
  "Heartbroken",
  "Hesitant",
  "Hopeful",
  "Jealous",
  "Laughing",
  "Mad",
  "Nervous",
  "Relieved",
  "Romantic",
  "Sad",
  "Soft",
  "Sarcastic",
  "Shocked",
  "Shouted",
  "Sighing",
  "Sleepy",
  "Stressed",
  "Tired",
  "Upset",
  "Worried"
] as const;

// Simple view types and helpers
type SimpleRow = {
  id: string;
  side: "me" | "them";
  type: "text" | "command" | "image";
  content: string;
  imageName?: string;
  tone?: string;
};

function generateRowId() {
  return Math.random().toString(36).substring(2, 9);
}

function parseScriptToRows(scriptText: string): SimpleRow[] {
  const lines = scriptText.split("\n");
  const rows: SimpleRow[] = [];
  let currentRow: SimpleRow | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if it's a command (starts with > and ends with <) but NOT an image command
    if (trimmed.startsWith(">") && trimmed.endsWith("<")) {
      // Check if it's an image command: > image name <
      const imageCommandMatch = trimmed.match(/^>\s*image\s+(.+?)\s*<$/i);
      if (imageCommandMatch) {
        if (currentRow) {
          rows.push(currentRow);
          currentRow = null;
        }
        rows.push({
          id: generateRowId(),
          side: "me",
          type: "image",
          content: "",
          imageName: imageCommandMatch[1].trim(),
        });
        continue;
      }

      if (currentRow) {
        rows.push(currentRow);
        currentRow = null;
      }
      rows.push({
        id: generateRowId(),
        side: "them",
        type: "command",
        content: trimmed,
      });
      continue;
    }

    // Check if it's a new message with prefix
    const match = trimmed.match(/^(me|them):\s*(.*)$/i);
    if (match) {
      if (currentRow) {
        rows.push(currentRow);
      }
      const side = match[1].toLowerCase() as "me" | "them";
      let content = match[2] || "";

      // Check for image syntax: {image: name} or > image name <
      const imageMatch = content.match(/\{image:\s*(.+?)\s*\}/) ||
                         content.match(/>\s*image\s+(.+?)\s*</i);
      if (imageMatch) {
        currentRow = null;
        rows.push({
          id: generateRowId(),
          side,
          type: "image",
          content: "",
          imageName: imageMatch[1].trim(),
        });
        continue;
      }

      // Extract tone from [Tone] format (before removing brackets)
      // Look for a valid tone at the start of the content
      let tone: string | undefined;
      const toneMatch = content.match(/^\[([^\]]+)\]\s*/);
      if (toneMatch) {
        const potentialTone = toneMatch[1];
        if (TONE_OPTIONS.includes(potentialTone as (typeof TONE_OPTIONS)[number])) {
          tone = potentialTone;
          // Remove the tone bracket from content before processing
          content = content.replace(/^\[[^\]]+\]\s*/, "");
        }
      }

      currentRow = {
        id: generateRowId(),
        side,
        type: "text",
        content: removeBracketedWords(content),
        tone,
      };
    } else if (currentRow) {
      // Continuation of previous message
      currentRow.content += "\n" + removeBracketedWords(trimmed);
    }
  }

  if (currentRow) {
    rows.push(currentRow);
  }

  return rows;
}

function rowsToScriptText(rows: SimpleRow[]): string {
  return rows
    .map((row) => {
      if (row.type === "command") {
        // Ensure command format
        let cmd = row.content.trim();
        if (!cmd.startsWith(">")) cmd = "> " + cmd;
        if (!cmd.endsWith("<")) cmd = cmd + " <";
        return cmd;
      }
      if (row.type === "image") {
        // Image format: me: {image: name} or them: {image: name}
        const prefix = row.side === "me" ? "me:" : "them:";
        const imageName = row.imageName || "unnamed";
        return `${prefix} {image: ${imageName}}`;
      }
      // Text message
      const prefix = row.side === "me" ? "me:" : "them:";
      const tonePart = row.tone ? `[${row.tone}] ` : "";
      return `${prefix} ${tonePart}${row.content}`;
    })
    .join("\n");
}

function getInitialScriptText() {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(SCRIPT_EDITOR_STORAGE_KEY);
    if (saved !== null) return saved;
  }
  return DEFAULT_SCRIPT_TEMPLATE;
}

// TypeSelector Component
function TypeSelector({
  value,
  onChange,
  onBlur,
}: {
  value: "text" | "command" | "image";
  onChange: (type: "text" | "command" | "image") => void;
  onBlur?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const typeOptions: Array<{ value: "text" | "command" | "image"; label: string }> = [
    { value: "text", label: "Text" },
    { value: "command", label: "Command" },
    { value: "image", label: "Image" },
  ];

  const currentLabel = typeOptions.find((opt) => opt.value === value)?.label || "Text";

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownRect(null);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest("[data-type-dropdown]")
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (type: "text" | "command" | "image") => {
    onChange(type);
    setIsOpen(false);
    onBlur?.();
  };

  const dropdownContent =
    isOpen &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        data-type-dropdown
        style={{
          position: "fixed",
          top: dropdownRect.top,
          left: dropdownRect.left,
          width: dropdownRect.width,
          minWidth: 90,
          background: "rgba(0,0,0,0.95)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8,
          zIndex: 9999,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ padding: 4 }}>
          {typeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "none",
                background:
                  value === option.value
                    ? "rgba(255,255,255,0.15)"
                    : "transparent",
                color: "#fff",
                fontSize: 12,
                textAlign: "left",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                }
              }}
              onMouseLeave={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>,
      document.body
    );

  return (
    <div style={{ position: "relative", minWidth: 90 }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={onBlur}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(0,0,0,0.4)",
          color: "#fff",
          fontSize: 12,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(0,0,0,0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(0,0,0,0.4)";
        }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>{currentLabel}</span>
        <ChevronDown size={12} style={{ opacity: 0.7 }} />
      </button>
      {dropdownContent}
    </div>
  );
}

// ToneSelector Component
function ToneSelector({
  value,
  onChange,
  onBlur,
}: {
  value?: string;
  onChange: (tone: string | undefined) => void;
  onBlur?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredTones = useMemo(() => {
    if (!searchQuery.trim()) return TONE_OPTIONS;
    const query = searchQuery.toLowerCase();
    return TONE_OPTIONS.filter((tone) =>
      tone.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownRect(null);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest("[data-tone-dropdown]")
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const handleSelect = (tone: string) => {
    onChange(tone);
    setIsOpen(false);
    setSearchQuery("");
    onBlur?.();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    setIsOpen(false);
    setSearchQuery("");
    onBlur?.();
  };

  const dropdownContent =
    isOpen &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        data-tone-dropdown
        style={{
          position: "fixed",
          top: dropdownRect.top,
          left: dropdownRect.left,
          width: Math.max(dropdownRect.width, 180),
          background: "rgba(0,0,0,0.95)",
          border: "1px solid rgba(167,139,250,0.4)",
          borderRadius: 8,
          zIndex: 9999,
          maxHeight: 300,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: 8,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            position: "sticky",
            top: 0,
            background: "rgba(0,0,0,0.95)",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                color: "rgba(255,255,255,0.5)",
                pointerEvents: "none",
              }}
            />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tone..."
              style={{
                width: "100%",
                padding: "6px 10px 6px 32px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                fontSize: 12,
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsOpen(false);
                  setSearchQuery("");
                } else if (e.key === "Enter" && filteredTones.length > 0) {
                  handleSelect(filteredTones[0]);
                }
              }}
            />
          </div>
        </div>

        {/* Options list */}
        <div
          style={{
            maxHeight: 240,
            overflowY: "auto",
            padding: 4,
          }}
        >
          {filteredTones.length === 0 ? (
            <div
              style={{
                padding: "12px 8px",
                textAlign: "center",
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
              }}
            >
              No tones found
            </div>
          ) : (
            filteredTones.map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => handleSelect(tone)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "none",
                  background:
                    value === tone
                      ? "rgba(167,139,250,0.3)"
                      : "transparent",
                  color: "#fff",
                  fontSize: 12,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (value !== tone) {
                    e.currentTarget.style.background =
                      "rgba(255,255,255,0.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (value !== tone) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {tone}
              </button>
            ))
          )}
        </div>
      </div>,
      document.body
    );

  return (
    <div style={{ position: "relative", minWidth: 140 }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={onBlur}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid rgba(167,139,250,0.4)",
          background: value
            ? "rgba(167,139,250,0.2)"
            : "rgba(167,139,250,0.1)",
          color: "#fff",
          fontSize: 12,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = value
            ? "rgba(167,139,250,0.3)"
            : "rgba(167,139,250,0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = value
            ? "rgba(167,139,250,0.2)"
            : "rgba(167,139,250,0.1)";
        }}
      >
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || "Tone"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {value && (
            <X
              size={12}
              onClick={handleClear}
              style={{ cursor: "pointer", opacity: 0.7 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.7";
              }}
            />
          )}
          <ChevronDown size={12} style={{ opacity: 0.7 }} />
        </div>
      </button>
      {dropdownContent}
    </div>
  );
}

export function ScriptStep() {
  const { formValues, updateChatSettings, updateFormValues } = useStudioForm();
  const { parseScript, importFromFile } = useScriptParser();
  const toast = useToast();

  const [scriptText, setScriptText] = useState(getInitialScriptText);
  const [viewMode, setViewMode] = useState<"simple" | "advanced">("simple");
  const [simpleRows, setSimpleRows] = useState<SimpleRow[]>(() =>
    parseScriptToRows(getInitialScriptText())
  );
  const [newRowIds, setNewRowIds] = useState<Set<string>>(new Set());
  const [removingRowIds, setRemovingRowIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [aiPromptModalOpen, setAiPromptModalOpen] = useState(false);
  const [imageUploads, setImageUploads] = useState<Record<string, File | null>>(
    () => ({ ...imageUploadsCache }),
  );
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({});
  const [imagePreviewModal, setImagePreviewModal] = useState<{ name: string; url: string } | null>(null);
  const [profilePicturesModalOpen, setProfilePicturesModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const tableBodyRef = useRef<HTMLDivElement | null>(null);
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
    const regex1 = />\s*image\s+(.+?)\s*</gi;
    let match: RegExpExecArray | null;

    while ((match = regex1.exec(scriptText)) !== null) {
      const candidate = match[1]?.trim();
      if (!candidate) continue;
      names.add(candidate);
    }

    // Match {image: name} pattern anywhere in the script
    const regex2 = /\{image:\s*(.+?)\s*\}/gi;
    while ((match = regex2.exec(scriptText)) !== null) {
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

        // Update formValues.messages with the new imageUrl for immediate preview update
        const updatedMessages = formValues.messages.map((msg) => {
          if (msg.type === "image" && msg.imageName === placeholder) {
            return { ...msg, imageUrl: dataUrl };
          }
          return msg;
        });
        updateFormValues({ messages: updatedMessages });
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

      // Clear imageUrl from messages
      const updatedMessages = formValues.messages.map((msg) => {
        if (msg.type === "image" && msg.imageName === placeholder) {
          return { ...msg, imageUrl: "" };
        }
        return msg;
      });
      updateFormValues({ messages: updatedMessages });
    }
  }, [formValues.messages, updateFormValues]);

  const handleRecipientAvatarModeChange = useCallback(
    (recipientName: string, useCustom: boolean) => {
      const currentAvatars =
        formValues.CHAT_SETTINGS.recipientAvatars ?? {};
      const existing = currentAvatars[recipientName] ?? {
        mode: "initials" as const,
        imageUrl: undefined as string | undefined,
      };

      const nextAvatars = {
        ...currentAvatars,
        [recipientName]: {
          ...existing,
          mode: useCustom ? ("image" as const) : ("initials" as const),
        },
      };

      updateChatSettings("recipientAvatars", nextAvatars);
    },
    [formValues.CHAT_SETTINGS.recipientAvatars, updateChatSettings],
  );

  const handleRecipientAvatarFileChange = useCallback(
    (recipientName: string, file: File | null) => {
      const currentAvatars =
        formValues.CHAT_SETTINGS.recipientAvatars ?? {};

      if (!file) {
        const existing = currentAvatars[recipientName];
        if (!existing) return;

        const nextAvatars = {
          ...currentAvatars,
          [recipientName]: {
            ...existing,
            imageUrl: undefined,
          },
        };

        updateChatSettings("recipientAvatars", nextAvatars);
        try {
          window.localStorage.removeItem(`br-max-avatar-${recipientName}`);
        } catch {
          // ignore
        }
        return;
      }

      const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

      if (!file.type.startsWith("image/")) {
        toast.showToast({
          type: "error",
          message: "Please upload a valid image file (PNG, JPG, WebP, etc.).",
        });
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        toast.showToast({
          type: "error",
          message: "Profile pictures must be smaller than 2MB.",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const existing = currentAvatars[recipientName] ?? {
          mode: "image" as const,
          imageUrl: undefined as string | undefined,
        };

        const nextAvatars = {
          ...currentAvatars,
          [recipientName]: {
            ...existing,
            mode: "image" as const,
            imageUrl: dataUrl,
          },
        };

        updateChatSettings("recipientAvatars", nextAvatars);

        try {
          window.localStorage.setItem(
            `br-max-avatar-${recipientName}`,
            dataUrl,
          );
        } catch {
          // ignore quota / availability errors
        }
      };
      reader.readAsDataURL(file);
    },
    [formValues.CHAT_SETTINGS.recipientAvatars, updateChatSettings, toast],
  );

  // Simple view handlers
  const updateSimpleRows = useCallback(
    (newRows: SimpleRow[]) => {
      setSimpleRows(newRows);
      const newScriptText = rowsToScriptText(newRows);
      setScriptText(newScriptText);
      // Parse and update form values
      try {
        const { messages, voices } = parseScript(newScriptText);
        updateFormValues({ messages, voices: mergeVoiceAssignments(voices) });
      } catch (error) {
        console.error("Parse error:", error);
      }
    },
    [parseScript, updateFormValues, mergeVoiceAssignments]
  );

  const handleAddRow = useCallback(
    (side: "me" | "them") => {
      const newRow: SimpleRow = {
        id: generateRowId(),
        side,
        type: "text",
        content: "",
      };
      // Track new row for animation
      setNewRowIds((prev) => new Set(prev).add(newRow.id));
      updateSimpleRows([...simpleRows, newRow]);
      // Remove from newRowIds after animation completes
      setTimeout(() => {
        setNewRowIds((prev) => {
          const next = new Set(prev);
          next.delete(newRow.id);
          return next;
        });
      }, 300);
      // Scroll to bottom after state updates
      setTimeout(() => {
        if (tableBodyRef.current) {
          tableBodyRef.current.scrollTo({
            top: tableBodyRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 0);
    },
    [simpleRows, updateSimpleRows]
  );

  const handleClearRows = useCallback(() => {
    updateSimpleRows([]);
  }, [updateSimpleRows]);

  const handleDeleteRow = useCallback(
    (id: string) => {
      // Start exit animation
      setRemovingRowIds((prev) => new Set(prev).add(id));
      // Actually remove after animation
      setTimeout(() => {
        setRemovingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        updateSimpleRows(simpleRows.filter((row) => row.id !== id));
      }, 250);
    },
    [simpleRows, updateSimpleRows]
  );

  const handleDuplicateRow = useCallback(
    (id: string) => {
      const index = simpleRows.findIndex((row) => row.id === id);
      if (index === -1) return;
      const original = simpleRows[index];
      const duplicate: SimpleRow = {
        ...original,
        id: generateRowId(),
      };
      // Track new row for animation
      setNewRowIds((prev) => new Set(prev).add(duplicate.id));
      const newRows = [...simpleRows];
      newRows.splice(index + 1, 0, duplicate);
      updateSimpleRows(newRows);
      // Remove from newRowIds after animation completes
      setTimeout(() => {
        setNewRowIds((prev) => {
          const next = new Set(prev);
          next.delete(duplicate.id);
          return next;
        });
      }, 300);
    },
    [simpleRows, updateSimpleRows]
  );

  const handleToggleSide = useCallback(
    (id: string) => {
      updateSimpleRows(
        simpleRows.map((row) =>
          row.id === id
            ? { ...row, side: row.side === "me" ? "them" : "me" }
            : row
        )
      );
    },
    [simpleRows, updateSimpleRows]
  );

  const handleChangeType = useCallback(
    (id: string, newType: "text" | "command" | "image") => {
      updateSimpleRows(
        simpleRows.map((row) => {
          if (row.id !== id) return row;

          // If changing to image, set default image name
          if (newType === "image") {
            return { ...row, type: newType, content: "", imageName: row.imageName || "image1" };
          }

          // If changing from image to other type, clear imageName
          const wasImage = row.type === "image";

          let content = row.content;
          // If changing to command, ensure brackets
          if (newType === "command") {
            content = content.trim();
            if (!content.startsWith(">")) content = "> " + content;
            if (!content.endsWith("<")) content = content + " <";
          }
          // If changing from command to text, remove brackets
          if (newType === "text" && row.type === "command") {
            content = content.replace(/^>\s*/, "").replace(/\s*<$/, "");
          }

          return { ...row, type: newType, content, imageName: wasImage ? undefined : row.imageName };
        })
      );
    },
    [simpleRows, updateSimpleRows]
  );

  const handleChangeContent = useCallback(
    (id: string, content: string) => {
      // Update local state only (no parsing)
      setSimpleRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, content } : row))
      );
    },
    []
  );

  const handleChangeImageName = useCallback(
    (id: string, imageName: string) => {
      // Update local state only (no parsing)
      setSimpleRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, imageName } : row))
      );
    },
    []
  );

  const handleChangeTone = useCallback(
    (id: string, tone: string | undefined) => {
      // Update local state only (no parsing)
      setSimpleRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, tone } : row))
      );
    },
    []
  );

  const handleContentBlur = useCallback(() => {
    // On blur, sync to scriptText and parse
    const newScriptText = rowsToScriptText(simpleRows);
    setScriptText(newScriptText);
    try {
      const { messages, voices } = parseScript(newScriptText);
      updateFormValues({ messages, voices: mergeVoiceAssignments(voices) });
    } catch (error) {
      console.error("Parse error:", error);
    }
  }, [simpleRows, parseScript, updateFormValues, mergeVoiceAssignments]);

  // Sync simpleRows when scriptText changes from Advanced view
  const handleViewModeChange = useCallback(
    (newMode: "simple" | "advanced") => {
      if (newMode === "simple") {
        // Parse current scriptText to rows
        setSimpleRows(parseScriptToRows(scriptText));
      }
      setViewMode(newMode);
    },
    [scriptText]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Free Script Generator Card */}
      <div
        style={{
          padding: 24,
          background: "linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(96,165,250,0.08) 100%)",
          border: "1px solid rgba(167,139,250,0.35)",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <h4
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              marginBottom: 6,
              color: "#e0e7ff",
            }}
          >
            Struggling with your story idea/script?
          </h4>
          <p
            style={{
              fontSize: 14,
              margin: 0,
              opacity: 0.85,
              color: "#c7d2fe",
            }}
          >
            Use our <strong style={{ color: "#a5b4fc" }}>FREE</strong> script generator to create engaging conversation scripts instantly.
          </p>
        </div>
        <a
          href="https://chatgpt.com/g/g-6924c5f484d081919d8cf44d945bafc8-cyno"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "#ffffff",
            border: "none",
            borderRadius: 12,
            padding: "12px 20px",
            cursor: "pointer",
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.15)";
          }}
        >
          <Image
            src="https://br-max.s3.ap-south-1.amazonaws.com/CynoBotLogo.png"
            alt="CynoBot"
            width={24}
            height={24}
            style={{ borderRadius: 4 }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#1f2937",
            }}
          >
            Try Script Generator
          </span>
        </a>
      </div>

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

        {/* View Mode Tabs */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: 16,
            background: "rgba(0,0,0,0.3)",
            borderRadius: 10,
            padding: 4,
            width: "fit-content",
          }}
        >
          <button
            type="button"
            onClick={() => handleViewModeChange("simple")}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === "simple" ? "rgba(167,139,250,0.3)" : "transparent",
              color: viewMode === "simple" ? "#e0e7ff" : "rgba(255,255,255,0.6)",
              transition: "all 0.2s",
            }}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange("advanced")}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === "advanced" ? "rgba(167,139,250,0.3)" : "transparent",
              color: viewMode === "advanced" ? "#e0e7ff" : "rgba(255,255,255,0.6)",
              transition: "all 0.2s",
            }}
          >
            Advanced
          </button>
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

        {/* Simple View */}
        {viewMode === "simple" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Table */}
            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Table Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 140px 1fr auto",
                  gap: 12,
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.05)",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  fontWeight: 600,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                <div>Character</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Tone</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle
                          size={14}
                          style={{
                            cursor: "help",
                            opacity: 0.6,
                            color: "rgba(255,255,255,0.7)",
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" style={{ maxWidth: 280 }}>
                        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                          <strong>What are Tones?</strong>
                          <br />
                          <br />
                          Tones define the emotion or mood of your message. Select a tone like "Happy", "Sarcastic", or "Excited" to convey how the message should be delivered. This helps set the context for voice generation and adds emotional depth to your conversation.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div>Content</div>
                <div style={{ width: 70, textAlign: "center" }}>Actions</div>
              </div>

              {/* Table Body - Scrollable */}
              <div
                ref={tableBodyRef}
                style={{
                  maxHeight: 400,
                  overflowY: "auto",
                }}
              >
                {simpleRows.length === 0 ? (
                  <div
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 14,
                    }}
                  >
                    No messages yet. Click &quot;Add Left&quot; or &quot;Add Right&quot; to start.
                  </div>
                ) : (
                  simpleRows.map((row, index) => {
                    const isNew = newRowIds.has(row.id);
                    const isRemoving = removingRowIds.has(row.id);
                    return (
                  <div
                    key={row.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 140px 1fr auto",
                      gap: 12,
                      padding: "12px 16px",
                      borderBottom:
                        index < simpleRows.length - 1
                          ? "1px solid rgba(255,255,255,0.06)"
                          : "none",
                      alignItems: "center",
                      animation: isNew
                        ? "rowSlideIn 0.3s ease-out"
                        : isRemoving
                          ? "rowSlideOut 0.25s ease-in forwards"
                          : "none",
                      opacity: isRemoving ? 0 : 1,
                      transform: isRemoving ? "translateX(20px)" : "none",
                      transition: "opacity 0.25s ease, transform 0.25s ease",
                    }}
                  >
                    {/* Character Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleSide(row.id)}
                      disabled={row.type === "command"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "none",
                        cursor: row.type === "command" ? "not-allowed" : "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        background:
                          row.type === "command"
                            ? "rgba(168,85,247,0.2)"
                            : row.type === "image"
                              ? row.side === "me"
                                ? "rgba(168,85,247,0.25)"
                                : "rgba(168,85,247,0.25)"
                              : row.side === "me"
                                ? "rgba(52,211,153,0.25)"
                                : "rgba(96,165,250,0.25)",
                        color:
                          row.type === "command"
                            ? "#c4b5fd"
                            : row.type === "image"
                              ? "#d8b4fe"
                              : row.side === "me"
                                ? "#6ee7b7"
                                : "#93c5fd",
                        opacity: row.type === "command" ? 0.6 : 1,
                      }}
                      title={row.type === "command" ? "Commands don't have a side" : "Click to toggle side"}
                    >
                      {row.type === "command" ? (
                        "CMD"
                      ) : row.side === "me" ? (
                        <>
                          Right <ChevronDown size={12} />
                        </>
                      ) : (
                        <>
                          Left <ChevronDown size={12} />
                        </>
                      )}
                    </button>

                    {/* Tone Selector */}
                    <div>
                      {row.type === "text" ? (
                        <ToneSelector
                          value={row.tone}
                          onChange={(tone) => handleChangeTone(row.id, tone)}
                          onBlur={handleContentBlur}
                        />
                      ) : (
                        <div
                          style={{
                            padding: "8px 10px",
                            fontSize: 12,
                            color: "rgba(255,255,255,0.4)",
                            textAlign: "center",
                          }}
                        >
                          -
                        </div>
                      )}
                    </div>

                    {/* Content Area */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {/* Type Dropdown */}
                      <TypeSelector
                        value={row.type}
                        onChange={(type) => handleChangeType(row.id, type)}
                        onBlur={handleContentBlur}
                      />

                      {/* Content Input - changes based on type */}
                      {row.type === "image" ? (
                        <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="text"
                            value={row.imageName || ""}
                            onChange={(e) => handleChangeImageName(row.id, e.target.value)}
                            onBlur={handleContentBlur}
                            placeholder="Image name (e.g., catImage)"
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid rgba(168,85,247,0.4)",
                              background: "rgba(168,85,247,0.1)",
                              color: "#fff",
                              fontSize: 13,
                            }}
                          />
                          {row.imageName && imagePreviewUrls[row.imageName] && (
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 6,
                                overflow: "hidden",
                                border: "1px solid rgba(255,255,255,0.2)",
                                flexShrink: 0,
                              }}
                            >
                              <Image
                                src={imagePreviewUrls[row.imageName]}
                                alt={row.imageName}
                                width={36}
                                height={36}
                                style={{ objectFit: "cover", width: "100%", height: "100%" }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={row.content}
                          onChange={(e) => handleChangeContent(row.id, e.target.value)}
                          onBlur={handleContentBlur}
                          placeholder={
                            row.type === "command"
                              ? "> Conversation with Name <"
                              : "Enter message..."
                          }
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(0,0,0,0.4)",
                            color: "#fff",
                            fontSize: 13,
                          }}
                        />
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleDuplicateRow(row.id)}
                        title="Duplicate"
                        style={{
                          padding: 8,
                          borderRadius: 6,
                          border: "none",
                          background: "rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.7)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        title="Delete"
                        style={{
                          padding: 8,
                          borderRadius: 6,
                          border: "none",
                          background: "rgba(239,68,68,0.15)",
                          color: "#f87171",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Action Buttons - Always visible */}
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                padding: "12px 16px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <button
                type="button"
                onClick={handleClearRows}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.15)",
                  color: "#fca5a5",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={14} />
                Clear All
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => handleAddRow("them")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(96,165,250,0.4)",
                  background: "rgba(96,165,250,0.15)",
                  color: "#93c5fd",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Plus size={14} />
                Add Left (Them)
              </button>
              <button
                type="button"
                onClick={() => handleAddRow("me")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(52,211,153,0.4)",
                  background: "rgba(52,211,153,0.15)",
                  color: "#6ee7b7",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Plus size={14} />
                Add Right (Me)
              </button>
            </div>
          </div>
        )}

        {/* Advanced View */}
        {viewMode === "advanced" && (
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
        )}

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
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {imagePlaceholders.map((name) => {
                const uploadId = `image-upload-${name.replace(/\s+/g, "-")}`;
                const selectedFile = imageUploads[name];
                const previewUrl = imagePreviewUrls[name];

                return (
                  <div
                    key={name}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "rgba(0,0,0,0.35)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {/* Image name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>Image name</div>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                    </div>

                    {/* Status indicator */}
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                        maxWidth: 120,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {selectedFile ? selectedFile.name : previewUrl ? "Image loaded" : "No image"}
                    </div>

                    {/* Preview button */}
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={() => setImagePreviewModal({ name, url: previewUrl })}
                        title="Preview image"
                        style={{
                          padding: 8,
                          borderRadius: 6,
                          border: "1px solid rgba(167,139,250,0.4)",
                          background: "rgba(167,139,250,0.15)",
                          color: "#c4b5fd",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Eye size={14} />
                      </button>
                    )}

                    {/* Upload button */}
                    <label
                      htmlFor={uploadId}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px dashed rgba(255,255,255,0.25)",
                        background: "rgba(255,255,255,0.05)",
                        color: "#d1d5db",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      <Upload size={12} />
                      {previewUrl ? "Change" : "Upload"}
                    </label>
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
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tooltipRecipientNames.length > 0 && (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setProfilePicturesModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "#e5e7eb",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              }}
            >
              <CircleUser size={18} style={{ flexShrink: 0 }} />
              <span>Customize Profile pictures</span>
              {(() => {
                const avatars = formValues.CHAT_SETTINGS.recipientAvatars ?? {};
                const withCustom = tooltipRecipientNames.filter(
                  (n) => avatars[n.trim()]?.mode === "image" && avatars[n.trim()]?.imageUrl,
                ).length;
                if (withCustom === 0) return null;
                return (
                  <span
                    style={{
                      fontSize: 11,
                      opacity: 0.8,
                      fontWeight: 400,
                    }}
                  >
                    · {withCustom} custom
                  </span>
                );
              })()}
            </button>
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

                    <tr>
                      <td style={{ padding: "6px 6px", whiteSpace: "nowrap" }}>
                        <code>&gt; change me voice to VOICE_ID &lt;</code>
                      </td>
                      <td style={{ padding: "6px 6px" }}>
                        Changes the sender&apos;s ElevenLabs voice ID from this point onward.
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
      {/* Image Preview Modal */}
      <Modal
        open={imagePreviewModal !== null}
        onClose={() => setImagePreviewModal(null)}
        title={imagePreviewModal ? `Preview: ${imagePreviewModal.name}` : "Image Preview"}
        width={600}
      >
        {imagePreviewModal && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "10px 0",
            }}
          >
            <div
              style={{
                borderRadius: 12,
                overflow: "hidden",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.1)",
                maxWidth: "100%",
              }}
            >
              <Image
                src={imagePreviewModal.url}
                alt={imagePreviewModal.name}
                width={550}
                height={400}
                unoptimized
                style={{
                  maxWidth: "100%",
                  maxHeight: "60vh",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              Image name: <strong style={{ color: "#c4b5fd" }}>{imagePreviewModal.name}</strong>
            </div>
          </div>
        )}
      </Modal>
      {/* Profile pictures for top bar (per recipient) */}
      <Modal
        open={profilePicturesModalOpen}
        onClose={() => setProfilePicturesModalOpen(false)}
        title="Profile pictures for top bar"
        width={520}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.5,
            }}
          >
            Choose whether each recipient shows initials or a custom profile picture in the chat top bar. These appear when the video is rendered.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {tooltipRecipientNames.map((name) => {
              const trimmed = name.trim();
              if (!trimmed) return null;

              const avatars =
                formValues.CHAT_SETTINGS.recipientAvatars ?? {};
              const config = avatars[trimmed] ?? {
                mode: "initials" as const,
                imageUrl: undefined as string | undefined,
              };
              const useCustom = config.mode === "image";
              const uploadId = `recipient-avatar-modal-${trimmed.replace(
                /\s+/g,
                "-",
              )}`;

              return (
                <div
                  key={trimmed}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#f3f4f6" }}>
                      {trimmed}
                    </span>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: "rgba(255,255,255,0.85)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={useCustom}
                        onChange={(e) =>
                          handleRecipientAvatarModeChange(
                            trimmed,
                            e.target.checked,
                          )
                        }
                      />
                      <span>Use custom profile picture</span>
                    </label>
                  </div>

                  {useCustom && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      {config.imageUrl ? (
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: "50%",
                            overflow: "hidden",
                            border: "2px solid rgba(255,255,255,0.15)",
                            flexShrink: 0,
                          }}
                        >
                          <Image
                            src={config.imageUrl}
                            alt={trimmed}
                            width={48}
                            height={48}
                            unoptimized
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                      ) : null}
                      <div
                        style={{
                          flex: "1 1 120px",
                          minWidth: 0,
                          fontSize: 12,
                          color: config.imageUrl
                            ? "rgba(255,255,255,0.7)"
                            : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {config.imageUrl
                          ? "Custom image set. Use \"Change\" to replace."
                          : "PNG, JPG or WebP, max 2MB."}
                      </div>
                      <label
                        htmlFor={uploadId}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: "1px dashed rgba(255,255,255,0.3)",
                          background: "rgba(255,255,255,0.06)",
                          color: "#d1d5db",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        <Upload size={14} />
                        {config.imageUrl ? "Change image" : "Upload image"}
                      </label>
                      <input
                        id={uploadId}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          handleRecipientAvatarFileChange(trimmed, file);
                          event.target.value = "";
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
      <style>{`
        code {
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-size: 0.9em;
        }
        @keyframes rowSlideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes rowSlideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(20px);
          }
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
