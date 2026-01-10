"use client";

import { useEffect } from "react";

export default function ScrollRestoration() {
  useEffect(() => {
    // Prevent auto-scrolling on page load/refresh
    if (typeof window !== "undefined") {
      // Prevent scroll restoration immediately
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }

      // Scroll main element to top immediately
      const mainElement = document.querySelector("main");
      if (mainElement) {
        mainElement.scrollTo(0, 0);
      }
      
      // Also ensure we're at the top after multiple delays (in case something else tries to scroll)
      const timeouts = [
        setTimeout(() => {
          const main = document.querySelector("main");
          if (main) main.scrollTo(0, 0);
        }, 50),
        setTimeout(() => {
          const main = document.querySelector("main");
          if (main) main.scrollTo(0, 0);
        }, 100),
        setTimeout(() => {
          const main = document.querySelector("main");
          if (main) main.scrollTo(0, 0);
        }, 300),
      ];

      // After loader animation completes (3000ms), ensure we're at the top
      const allowScrollTimeout = setTimeout(() => {
        const main = document.querySelector("main");
        if (main) main.scrollTo(0, 0);
      }, 3100);

      return () => {
        timeouts.forEach(clearTimeout);
        clearTimeout(allowScrollTimeout);
      };
    }
  }, []);

  return null;
}

