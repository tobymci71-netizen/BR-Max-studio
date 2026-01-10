import React from "react";
import { Label } from "./Label";
import { TOK } from "../../styles/TOK";

type Option = {
  value: string;
  label: React.ReactNode;
};

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: React.ReactNode;
  hint?: string;
  options: Option[];
  errorMessage?: string;
  warnMessage?: string;
};

export const Select: React.FC<SelectProps> = ({
  label,
  hint,
  options,
  style,
  errorMessage,
  warnMessage,
  id,
  ...props
}) => {
  const hasError = Boolean(errorMessage);
  const hasWarn = !hasError && Boolean(warnMessage);

  const helperColor = hasError
    ? TOK.ringError ?? "rgba(244,63,94,0.95)"
    : hasWarn
    ? TOK.ringWarn ?? "rgba(245,158,11,0.95)"
    : "rgba(255,255,255,0.6)";

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Label>{label}</Label>
          {hint && (
            <span
              title={hint}
              aria-label={hint}
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
      ) : null}

      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <select
          id={id}
          {...props}
          style={{
            ...TOK.field.base,
            appearance: "none",
            paddingRight: 36,
            cursor: "pointer",
            lineHeight: "18px",
            ...style,
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} style={{ color: "#000" }}>
              {option.label}
            </option>
          ))}
        </select>
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: 12,
            pointerEvents: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "#fff",
            fontSize: 10,
          }}
        >
          ▾
        </div>
      </div>

      {(hasError || hasWarn) && (
        <div
          role={hasError ? "alert" : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            lineHeight: 1.35,
            color: helperColor,
            padding: "2px 2px 0 2px",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              display: "inline-block",
              background:
                hasError
                  ? "rgba(244,63,94,0.95)"
                  : "rgba(245,158,11,0.95)",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.08) inset",
            }}
          />
          <span>{hasError ? errorMessage : warnMessage}</span>
        </div>
      )}
    </label>
  );
};
