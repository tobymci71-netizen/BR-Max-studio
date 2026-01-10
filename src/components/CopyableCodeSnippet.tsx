import React, { useState } from "react";
import { Check } from "lucide-react";

interface CopyableCodeSnippetProps {
  text: string;
  palette: {
    cardAlt: string;
    stroke: string;
  };
}

export function CopyableCodeSnippet({ text, palette }: CopyableCodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span
      onClick={handleCopy}
      style={{ position: "relative", display: "inline-block", cursor: "pointer" }}
    >
      <code
        style={{
          background: palette.cardAlt,
          color: "#fff",
          padding: "3px 8px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 700,
          border: `1px solid ${palette.stroke}`,
          userSelect: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity .2s",
          opacity: copied ? 0.15 : 1,
        }}
      >
        {text}
      </code>

      {/* Green overlay */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 6,
          background: "rgba(41,205,97,0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity .22s ease, transform .22s ease",
          pointerEvents: "none",
          opacity: copied ? 1 : 0,
          transform: copied ? "scale(1)" : "scale(0.85)",
        }}
      >
        <Check size={14} style={{ color: "#fff" }} /> Copied
      </span>
    </span>
  );
}
