import React, { useState, useEffect } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { Message } from "../../types/constants";
import {
  FileText,
  Upload,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { AutoGrowTextArea } from "../../components/AutoGrowTextArea";
import { useToast } from "../../hooks/useToast";

interface Props {
  messages: Message[];
  handleTxtFile: (file: File) => void;
  importTxt: (text: string) => void;
}

const AI_CONVERSION_PROMPT = `Please convert this script into the following format:

FORMAT RULES:
- Each message should start with "me:" or "them:"
- "me:" is for messages from the user
- "them:" is for messages from the recipient
- IMPORTANT: Each line should be a SEPARATE message. Do NOT combine multiple lines into one message unless explicitly requested.
- If you want to keep text in the same message, you must NOT add a new "me:" or "them:" prefix - only omit the prefix to continue the previous speaker's message on a new line within that same message.
- Blank lines create paragraph breaks within the same message

EXAMPLE OUTPUT (each line is a separate message):
me: Hello
How are you
them: Good,
what about you?

EXAMPLE OUTPUT (if you want to combine lines in same message, omit prefix):
me: Hello
How are you
them: Good, what about you?

Now convert my script below into this format. Remember: each line should be a separate message unless you explicitly want to combine them:

[PASTE YOUR SCRIPT HERE]`;

const UnifiedScriptEditor = ({ messages, handleTxtFile, importTxt }: Props) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(
      "unifiedScriptEditor.importText",
    );
    if (saved) {
      setImportText(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "unifiedScriptEditor.importText",
      importText,
    );
  }, [importText]);

  const handleImport = () => {
    if (importText.trim()) {
      importTxt(importText);
      toast.showToast({ message: "File imported successfully!" });
      setModalOpen(false);
    }
  };

  const handleFileUpload = (file: File) => {
    handleTxtFile(file);
    toast.showToast({ message: "File imported successfully!" });
    setModalOpen(false);
  };

  const copyAIPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_CONVERSION_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setModalOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
        }}
      >
        <FileText size={16} />
        Script Editor
        <span
          style={{
            background: "rgba(255,255,255,0.14)",
            borderRadius: 10,
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {messages.length}
        </span>
      </Button>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
        }}
        actionButton={
          <Button
            onClick={handleImport}
            disabled={!importText.trim()}
            style={{
              background: importText.trim()
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "rgba(255,255,255,0.1)",
              border: "none",
              opacity: importText.trim() ? 1 : 0.5,
              cursor: importText.trim() ? "pointer" : "not-allowed",
            }}
          >
            <Upload size={16} /> Import to Editor
          </Button>
        }
        title="Conversation Studio"
        width={1100}
      >
        <div className="h-[80vh] flex flex-col gap-8">
          <div className="flex gap-8">
            {/* LEFT CARD — unchanged */}
            <div
              style={{
                borderRadius: 14,
                padding: 14,
                background:
                  "linear-gradient(135deg, rgba(102,126,234,0.09) 0%, rgba(118,75,162,0.14) 100%)",
                border: "1px solid rgba(102,126,234,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                minHeight: 0,
                width: "50%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    height: 34,
                    width: 34,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    flexShrink: 0,
                  }}
                >
                  <Upload size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      marginBottom: 2,
                    }}
                  >
                    Upload scripted conversation (.txt)
                  </div>
                </div>
              </div>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  fontSize: 12.5,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(0,0,0,0.65)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Upload size={14} />
                <span>Choose file</span>
                <input
                  type="file"
                  accept=".txt"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      handleFileUpload(f);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>

            {/* RIGHT CARD — MATCHED DESIGN */}
            <div
              style={{
                borderRadius: 14,
                padding: 14,
                background:
                  "linear-gradient(135deg, rgba(139,233,253,0.10) 0%, rgba(102,126,234,0.14) 100%)",
                border: "1px solid rgba(139,233,253,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                width: "50%",
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    height: 34,
                    width: 34,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={18} />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      marginBottom: 3,
                    }}
                  >
                    Convert to supported format using AI prompt
                  </div>
                </div>
              </div>

              <Button
                onClick={copyAIPrompt}
                variant="ghost"
                style={{
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(0,0,0,0.65)",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 12.5,
                  flexShrink: 0,
                  transition: "all 160ms ease",
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>

          <AutoGrowTextArea
            minRows={12}
            maxRows={18}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={`me: Hello Anaya, how are you?
them: I'm good! What about you?

Why are you texting me?

me: Because I miss you.`}
            style={{
              fontFamily: "monospace",
              fontSize: 14,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10,
              padding: 12,
              color: "#fff",
              minHeight: 0,
              flex: "1 1 auto",
            }}
          />

          {/* FORMAT GUIDE - refreshed design */}
          <div
            style={{
              background: "rgba(10,10,16,0.9)",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 14,
              padding: 18,
              minHeight: 0,
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <FileText size={18} />
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                  }}
                >
                  Format Guide
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.6)",
                  background: "rgba(15,23,42,0.9)",
                  textTransform: "uppercase",
                  letterSpacing: 0.08,
                  opacity: 0.9,
                }}
              >
                1 speaker = 1 voice
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                opacity: 0.92,
                overflow:"auto",
                display: "grid",
                gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)",
                gap: 12,
              }}
            >
              {/* Rules column */}
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: "0 0 4px 0" }}>
                  Prefix every spoken line with a <code>Speaker:</code> so
                  BR-MAX knows who is talking.
                </p>

                <ul
                  style={{
                    margin: "4px 0 8px 14px",
                    padding: 0,
                    listStyle: "disc",
                    fontSize: 12.5,
                    opacity: 0.9,
                  }}
                >
                  <li>
                    Every message must start with a prefix. <code>me:</code> or{" "}
                    <code>them:</code>
                  </li>
                  <li>
                    Remove the prefix to continue the message in a new line
                    message.
                  </li>
                </ul>

                <p
                  style={{
                    margin: "10px 0 0 0",
                    fontSize: 12,
                    opacity: 0.78,
                  }}
                >
                  Every unique speaker name is added to your{" "}
                  <strong>voice roster</strong>. Assign a voice ID once in the
                  Text-To-Speech panel.
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      padding: "3px 7px",
                      borderRadius: 999,
                      background: "rgba(30,64,175,0.45)",
                      border: "1px solid rgba(129,140,248,0.7)",
                    }}
                  >
                    me: right side speaker (you)
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "3px 7px",
                      borderRadius: 999,
                      background: "rgba(15,118,110,0.45)",
                      border: "1px solid rgba(45,212,191,0.7)",
                    }}
                  >
                    them: left side speaker (recipient)
                  </span>
                </div>
              </div>

              {/* Examples column */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.09,
                    opacity: 0.8,
                  }}
                >
                  Simple two-person chat
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    background: "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(148,163,184,0.7)",
                    borderRadius: 8,
                    padding: "7px 9px",
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  <div>me: Hey, I just reached.</div>
                  <div>them: Okay, I&apos;m coming downstairs.</div>
                  <div>me: Did you eat?</div>
                  <div>them: Not yet, waiting for you.</div>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.09,
                    opacity: 0.8,
                    marginTop: 2,
                  }}
                >
                  Multiple conversations
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    background: "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(148,163,184,0.5)",
                    borderRadius: 8,
                    padding: "7px 9px",
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  <div>&gt; Conversation with Sarah &lt;</div>
                  <div>me: Did you finish the presentation?</div>
                  <div>Sarah: Yup, sending it in 2 mins.</div>
                  <br />
                  <div>&gt; Conversation with Alex &lt;</div>
                  <div>me: Bro, did you reach home?</div>
                  <div>Alex: Just parked.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </Modal>

      <style>{`
        ::-webkit-scrollbar { height: 10px; width: 10px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.06); border-radius: 8px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }
      `}</style>
    </>
  );
};

export default UnifiedScriptEditor;
