export const Row: React.FC<
  React.PropsWithChildren<{ style?: React.CSSProperties }>
> = ({ children, style }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, ...style }}>
    {children}
  </div>
);
