"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";

interface ErrorNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  autoCloseDelay?: number;
  inline?: boolean; // render without fixed wrapper for stacking
}

export const ErrorNotification = ({
  isOpen,
  onClose,
  title = "Something went wrong",
  message,
  autoCloseDelay = 8000,
  inline = false,
}: ErrorNotificationProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      
      // // Auto-close after delay
      // const timer = setTimeout(() => {
      //   handleClose();
      // }, autoCloseDelay);

      // return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen, autoCloseDelay]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300); // Wait for animation to complete
  };

  if (!isOpen) return null;

  const content = (
    <div
      className={`transform transition-all duration-300 ease-in-out ${
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
    >
      <div
        className="bg-red-900/90 backdrop-blur-sm border border-red-700/50 rounded-xl p-4 shadow-lg pointer-events-auto"
        style={{
          background:
            "linear-gradient(135deg, rgba(185, 28, 28, 0.9) 0%, rgba(153, 27, 27, 0.9) 100%)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-200" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-red-100 font-semibold text-sm mb-1">{title}</h4>
            <p className="text-red-200 text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
          </div>

          <button
            onClick={handleClose}
            className="flex-shrink-0 text-red-300 hover:text-red-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md pointer-events-none">{content}</div>
  );
};
