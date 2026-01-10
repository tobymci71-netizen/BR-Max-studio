"use client";

import React, { useEffect, useState, useRef } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  className?: string;
  delay?: number;
}

export function CountUp({ end, duration = 1000, className = "", delay = 0 }: CountUpProps) {
  const [count, setCount] = useState(0);
  const previousEndRef = useRef<number | undefined>(undefined);
  const [shouldAnimate, setShouldAnimate] = useState(delay === 0);

  useEffect(() => {
    // Handle delay before animation
    if (delay > 0 && !shouldAnimate) {
      const delayTimer = setTimeout(() => {
        setShouldAnimate(true);
      }, delay);
      return () => clearTimeout(delayTimer);
    }
  }, [delay, shouldAnimate]);

  useEffect(() => {
    // Don't animate until delay has passed - show 0 until then
    if (!shouldAnimate) {
      setCount(0);
      return;
    }

    // On first render after delay, start animation from 0 to end
    const start = previousEndRef.current !== undefined ? previousEndRef.current : 0;
    previousEndRef.current = end;
    
    // If start equals end, just set it immediately
    if (start === end) {
      setCount(end);
      return;
    }

    // Start the animation
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(start + (end - start) * easeOutQuart);

      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    const animationId = requestAnimationFrame(animate);
    
    return () => {
      // Cleanup if component unmounts or value changes
      cancelAnimationFrame(animationId);
    };
  }, [end, duration, shouldAnimate]);

  return <span className={className}>{count.toLocaleString()}</span>;
}
