import { TOK } from "../../styles/TOK";

export const Card: React.FC<
  React.PropsWithChildren<{ style?: React.CSSProperties; className?: string }>
> = ({ children, style, className }) => (
  <div
    className={className}
    style={{
      background: TOK.card.bg,
      border: TOK.card.bd,
      boxShadow: TOK.card.sh,
      backdropFilter: TOK.card.blur,
      borderRadius: TOK.card.r,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);
