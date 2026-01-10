"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface VoiceSlotWarningPopupProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
}

export const VoiceSlotWarningPopup = ({
  isOpen,
  onConfirm,
  onCancel,
  title = "Voice Slot Limit Warning",
  message,
}: VoiceSlotWarningPopupProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Prevent body scroll when popup is open
      document.body.style.overflow = "hidden";
    } else {
      setIsVisible(false);
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleConfirm = () => {
    setIsVisible(false);
    setTimeout(() => onConfirm(), 300);
  };

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(() => onCancel(), 300);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md mx-4 transform transition-all duration-300 ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div
          className="bg-gradient-to-br from-yellow-900/95 to-orange-900/95 backdrop-blur-sm border border-yellow-700/50 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start gap-3 p-5 border-b border-yellow-700/30">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-300" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-yellow-100 font-semibold text-lg">{title}</h3>
            </div>

            <button
              onClick={handleCancel}
              className="flex-shrink-0 text-yellow-300 hover:text-yellow-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5">
            <p className="text-yellow-200 text-sm leading-relaxed whitespace-pre-wrap">
              {message}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-5 bg-black/20 border-t border-yellow-700/30">
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-yellow-200 hover:text-yellow-100 hover:bg-yellow-800/30 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-600 hover:bg-yellow-500 text-white transition-colors shadow-lg"
            >
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
