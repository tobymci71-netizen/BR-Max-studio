import { useId, useState } from "react";
import { Label } from "./Label";
import { TOK } from "../../styles/TOK";
import { Eye, EyeClosed } from "lucide-react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  /** Optional tooltip that appears next to the label */
  hint?: string;
  /** Show a red state + helper text */
  errorMessage?: string;
  /** Show an amber state + helper text (ignored if errorMessage is present) */
  warnMessage?: string;
};

export const Input: React.FC<InputProps> = ({
  label,
  hint,
  id,
  style,
  errorMessage,
  warnMessage,
  type,
  onFocus,
  onBlur,
  ...props
}) => {
  const auto = useId();
  const iid = id || auto;
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);

  // error has higher priority than warn
  const hasError = Boolean(errorMessage);
  const hasWarn = !hasError && Boolean(warnMessage);

  const ringColor = hasError
    ? TOK.ringError ?? "0 0 0 3px rgba(244,63,94,0.35)" // pink-500-ish
    : hasWarn
    ? TOK.ringWarn ?? "0 0 0 3px rgba(245,158,11,0.35)" // amber-500-ish
    : TOK.ring;

  const borderColor = hasError
    ? "1px solid rgba(244,63,94,0.55)"
    : hasWarn
    ? "1px solid rgba(245,158,11,0.55)"
    : TOK.field.base.border;

  const helperColor = hasError
    ? (TOK.ringError ?? "rgba(244,63,94,0.95)")
    : hasWarn
    ? (TOK.ringWarn ?? "rgba(245,158,11,0.95)")
    : "rgba(255,255,255,0.6)";

  return (
    <label htmlFor={iid} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Label>
            {label}
            {props.required ? <span style={{ color: TOK.font }}> {" "}*</span> : null}
          </Label>
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
        <input
          id={iid}
          aria-invalid={hasError || undefined}
          type={isPassword && showPassword ? "text" : type}
          {...props}
          style={{
            ...TOK.field.base,
            transition: "box-shadow 120ms, border-color 120ms",
            boxShadow: "none",
            border: borderColor,
            ...(isPassword && (!style || style.paddingRight === undefined) ? { paddingRight: 40 } : {}),
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = ringColor;
            onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = "none";
            onBlur?.(e);
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setShowPassword(!showPassword);
            }}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-40%)",
              height: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.6)",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <Eye size={18} /> : <EyeClosed size={18} />}
          </button>
        )}
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
