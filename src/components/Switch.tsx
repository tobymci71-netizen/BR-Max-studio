import React from "react";
import { TOK } from "../../styles/TOK";

export const Switch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  content?: React.ReactNode;
  hint?: string;
  disabled?: boolean;
  disabledMessage?: string;
}> = ({
  checked,
  content,
  onChange,
  label,
  hint,
  disabled = false,
  disabledMessage,
}) => {
  return (
    <div
      style={{
        position: "relative",
        border: TOK.hair,
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        overflow: "hidden",
        transition: "all 200ms ease",
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      {/* Header / Switch Row */}
      <div
        onClick={() => !disabled && onChange(!checked)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          padding: "10px 12px",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
            {hint && (
              <span
                title={hint}
                style={{
                  cursor: "help",
                  fontSize: 13,
                  opacity: 0.6,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "#fff",
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                i
              </span>
            )}
          </div>
        </div>

        {/* Switch toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          style={{
            width: 46,
            height: 26,
            borderRadius: 999,
            position: "relative",
            background: checked ? TOK.grad : "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.16)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "flex-start",
            transition: "background 150ms ease",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: checked ? 24 : 3,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              transition: "left 150ms ease",
            }}
          />
        </button>
      </div>

      {/* Expandable content (only if content exists) */}
      {content && (
        <div
          style={{
            maxHeight: checked ? 500 : 0,
            opacity: checked ? 1 : 0,
            padding: checked ? "10px 12px 12px" : "0 12px",
            borderTop: checked ? "1px solid rgba(255,255,255,0.1)" : "none",
            transition:
              "max-height 300ms ease, opacity 250ms ease, padding 300ms ease, border-top 200ms ease",
          }}
        >
          {checked && (
            <div
              style={{
                fontSize: 13.5,
                color: "rgba(255,255,255,0.88)",
                lineHeight: 1.5,
              }}
            >
              {content}
            </div>
          )}
        </div>
      )}

      {/* Disabled overlay */}
      {disabled && disabledMessage && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.90)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13.5,
            color: "#fff",
            textAlign: "center",
            padding: "8px 12px",
          }}
        >
          {disabledMessage}
        </div>
      )}
    </div>
  );
};
