import React, { forwardRef, useId } from "react";
import { Label } from "./Label";
import { TOK } from "../../styles/TOK";

export type TextAreaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string };

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, id, style, onFocus, onBlur, ...props }, ref) => {
    const auto = useId();
    const iid = id || auto;

    return (
      <label
        htmlFor={iid}
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        {label ? <Label>{label}</Label> : null}
        <textarea
          id={iid}
          ref={ref}
          {...props}
          style={{
            ...TOK.field.base,
            resize: "vertical",
            fontFamily: "inherit",
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = TOK.ring;
            onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = "none";
            onBlur?.(e);
          }}
        />
      </label>
    );
  }
);

TextArea.displayName = "TextArea";
