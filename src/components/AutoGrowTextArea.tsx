import React, { useRef, useEffect, useCallback, forwardRef } from "react";
import { TextArea, TextAreaProps } from "./TextArea";

type AutoGrowProps = TextAreaProps & {
  minRows?: number;
  maxRows?: number;
};

export const AutoGrowTextArea = forwardRef<HTMLTextAreaElement, AutoGrowProps>(
  ({ minRows = 3, maxRows = 14, onInput, style, ...rest }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);

    const resize = useCallback(() => {
      const el = internalRef.current;
      if (!el) return;
      el.style.height = "auto";
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight || "20");
      const minH = minRows * lineHeight + 12;
      const maxH = maxRows * lineHeight + 12;
      el.style.height = Math.min(Math.max(el.scrollHeight, minH), maxH) + "px";
    }, [minRows, maxRows]);

    // Sync external ref with internal ref
    useEffect(() => {
      if (typeof ref === "function") {
        ref(internalRef.current);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
          internalRef.current;
      }
    }, [ref]);

    useEffect(() => {
      resize();
    }, [resize, rest.value]); // re-measure when value changes programmatically

    return (
      <TextArea
        ref={internalRef}
        onInput={(e) => {
          resize();
          onInput?.(e);
        }}
        style={{ ...style, resize: "vertical", overflow: "auto" }}
        {...rest}
      />
    );
  }
);

AutoGrowTextArea.displayName = "AutoGrowTextArea";