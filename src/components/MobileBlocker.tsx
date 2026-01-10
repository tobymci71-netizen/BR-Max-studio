"use client";

import { useEffect, useState } from "react";

export default function MobileBlocker({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const check = () => {
      setBlocked(window.innerWidth < 1024);
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-fadeIn overflow-hidden">
        <div className="max-w-lg mx-6 text-center space-y-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#00D0FF] via-[#0AFFB3] to-[#53FF8F] bg-clip-text text-transparent animate-gradient">
            BR-MAX Studio
          </h1>

          <p className="text-lg opacity-90 leading-relaxed text-white">
            BR-MAX is designed for a{" "}
            <span className="font-semibold">desktop or laptop</span>.  
            Mobile screens can’t display the full studio interface.
          </p>

          <div className="mt-4 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-[0_0_20px_rgba(0,255,200,0.25)]">
            <p className="text-base text-white/90">
              Please use a larger device to continue.
            </p>
          </div>

          <a
            href="https://discord.gg/h4chRAbjEZ"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 px-6 py-3 rounded-xl font-semibold 
            bg-gradient-to-r from-[#5865F2] to-[#4F5DFF] 
            hover:opacity-90 transition-all shadow-[0_0_20px_rgba(88,101,242,0.5)] 
            text-white"
          >
            💬 Join the BR-MAX Discord
          </a>
        </div>

        <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#00FFC6]/20 blur-3xl rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-52 h-52 bg-[#0AEFFF]/20 blur-3xl rounded-full"></div>
      </div>
    );
  }

  // desktop → render everything normally
  return <>{children}</>;
}