"use client";

import { useState } from "react";
import { Bell, X, CheckCircle, Settings } from "lucide-react";

interface NotificationPermissionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onGrantPermission: () => void;
}

export const NotificationPermissionPopup = ({
  isOpen,
  onClose,
  onGrantPermission,
}: NotificationPermissionPopupProps) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [isRejected, setIsRejected] = useState(false);

  const handleGrantPermission = async () => {
    setIsRequesting(true);
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        onGrantPermission();
        onClose();
      } else if (permission === 'denied') {
        setIsRejected(true);
      } else {
        // Default case for 'default' permission
        onGrantPermission();
        onClose();
      }
    } catch (error) {
      console.log("Notification permission error:", error);
      onGrantPermission();
      onClose();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleTryAgain = () => {
    setIsRejected(false);
    handleGrantPermission();
  };

  const handleSkipNotification = () => {
    onGrantPermission();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="rounded-3xl max-w-md w-full p-6 relative border"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
          borderColor: "rgba(255,255,255,0.12)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #007aff, #00b4ff)",
            }}
          >
            <Bell className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          {!isRejected ? (
            <>
              <h3 className="text-xl font-semibold text-white mb-3">
                Get Alerted When Your Video is Ready
              </h3>

              <div className="text-gray-300 mb-6 space-y-3">
                <p className="text-sm">
                  Your video will be ready soon, but it'll only be available for <strong className="text-white">1 hour</strong> before auto-deletion.
                </p>
                <div 
                  className="border rounded-xl p-3 text-sm"
                  style={{
                    backgroundColor: "rgba(0, 122, 255, 0.1)",
                    borderColor: "rgba(0, 122, 255, 0.3)",
                  }}
                >
                  <div className="flex items-center gap-2 text-blue-400 font-medium mb-1">
                    <CheckCircle className="w-4 h-4" />
                    One-Time Alert Only
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  💙 This helps ensure you don't miss your video before it expires!
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-gray-400 hover:text-white transition-colors font-medium"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleGrantPermission}
                  disabled={isRequesting}
                  className="flex-1 px-4 py-2 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                  style={{
                    background: isRequesting ? "rgba(0, 122, 255, 0.4)" : "linear-gradient(90deg, #007aff, #00b4ff)",
                    cursor: isRequesting ? "not-allowed" : "pointer",
                  }}
                >
                  {isRequesting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Requesting...
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      Notify Me
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-white mb-3">
                Notification Permission Rejected
              </h3>

              <div className="text-gray-300 mb-6 space-y-3">
                <p className="text-sm">
                  You've rejected the notification permission. Your video will still be generated, but you won't get an alert when it's ready.
                </p>
                <div 
                  className="border rounded-xl p-3 text-sm"
                  style={{
                    backgroundColor: "rgba(255, 165, 0, 0.1)",
                    borderColor: "rgba(255, 165, 0, 0.3)",
                  }}
                >
                  <div className="flex items-center gap-2 text-orange-400 font-medium mb-1">
                    <Settings className="w-4 h-4" />
                    Manual Settings Required
                  </div>
                  <p className="text-gray-300">
                    To enable notifications later, you'll need to manually allow them in your browser settings.
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  ⚠️ Remember: Your video expires after 1 hour!
                </p>
              </div>

              {/* Rejection Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSkipNotification}
                  className="flex-1 px-4 py-2 text-gray-400 hover:text-white transition-colors font-medium"
                >
                  Skip notifications
                </button>
                <button
                  onClick={handleTryAgain}
                  className="flex-1 px-4 py-2 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(90deg, #ff6b35, #f7931e)",
                  }}
                >
                  <Settings className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
