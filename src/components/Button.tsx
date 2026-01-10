import { TOK } from "../../styles/TOK";

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost";
  }
> = ({ variant = "primary", style, children, disabled, ...p }) => (
  <button
    {...p}
    disabled={disabled}
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      color: "white",
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      borderRadius: 12,
      padding: "10px 14px",
      border: variant === "primary" ? "1px solid transparent" : TOK.hair,
      background: variant === "primary" ? TOK.grad : "rgba(255,255,255,0.06)",
      transition: "opacity 150ms ease, transform 150ms ease",
      ...style,
    }}
    onFocus={(e) => {
      if (!disabled) e.currentTarget.style.boxShadow = TOK.ring;
    }}
    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
  >
    {children}
  </button>
);
