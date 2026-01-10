"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { TOK } from "../../styles/TOK";

export default function WelcomeAnimation() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-white"
          style={{
            background: TOK.bg,
            fontFamily: TOK.font,
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
        >
          {/* App Name */}
          <motion.h1
            className="text-3xl font-semibold tracking-wider mb-6"
            style={{
              background: TOK.grad,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            BR&nbsp;MAX
          </motion.h1>

          {/* Minimal progress bar */}
          <div
            className="w-64 h-[3px] rounded-full overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.1)",
            }}
          >
            <motion.div
              className="h-full"
              style={{ background: TOK.grad }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, ease: "easeInOut" }}
            />
          </div>

          {/* Optional subtle fade-in tagline */}
          <motion.p
            className="text-xs text-gray-400 mt-4 tracking-widest uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            Launching Studio...
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
