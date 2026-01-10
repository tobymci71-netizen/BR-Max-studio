export const TOK = {
  primary:"red",
  font: "Inter, 'Noto Color Emoji', 'Apple Color Emoji', 'Inter', 'Segoe UI Emoji', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
  bg: "radial-gradient(1200px 600px at 10% -10%, #0a84ff22, transparent 60%), radial-gradient(800px 500px at 100% 20%, #22d3ee22, transparent 60%), #0b0b0b",
  ring: "0 0 0 3px rgba(0,122,255,0.35)",
  card: {
    bg: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    bd: "1px solid rgba(255,255,255)",
    sh: "0 10px 40px rgba(0,0,0,0.35)",
    blur: "blur(40px)",
    r: 20,
  },
  hair: "1px solid rgba(255,255,255,0.12)",
  ringError: "0 0 0 3px rgba(244,63,94,0.35)",
  ringWarn: "0 0 0 3px rgba(245,158,11,0.35)",
  field: {
    base: {
      background: "rgba(255,255,255,0.06)",
      color: "white",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      padding: "7px 10px",
      outline: "none" as const,
      width: "100%",
    },
  },
  grad: "linear-gradient(90deg, #007aff, #00b4ff)",
};
