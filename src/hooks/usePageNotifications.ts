"use client";

import { useEffect, useRef, useState } from "react";

interface UsePageNotificationsReturn {
  hasNewCompletedJobs: boolean;
  resetNotifications: () => void;
  hasNotificationPermission: boolean;
  requestNotificationPermission: () => Promise<boolean>;
}

export const usePageNotifications = (
  jobs: Array<{ status: string; created_at: string }>,
  isLoaded: boolean,
  hasFetchedInitialJobs: boolean
): UsePageNotificationsReturn => {
  const [hasNewCompletedJobs, setHasNewCompletedJobs] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const previousCompletedJobsRef = useRef<Set<string>>(new Set());
  const flashingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const originalTitleRef = useRef<string>("");
  const originalFaviconRef = useRef<string>("");
  const chimePlayedRef = useRef<boolean>(false);
  const isInitialLoadRef = useRef<boolean>(true);

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsTabVisible(isVisible);
      
      if (isVisible && hasNewCompletedJobs) {
        // User returned to tab, reset notifications
        resetNotifications();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [hasNewCompletedJobs]);

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setHasNotificationPermission(Notification.permission === "granted");
    }
  }, []);

  const requestNotificationPermission = async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === "granted";
      setHasNotificationPermission(granted);
      return granted;
    } catch (error) {
      console.log("Error requesting notification permission:", error);
      return false;
    }
  };

  const showBrowserNotification = () => {
    if (!hasNotificationPermission || typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    try {
      const notification = new Notification("🎬 Video Ready!", {
        body: "Your video has finished rendering and is ready for download!",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "video-ready", // Prevents duplicate notifications
        requireInteraction: false,
        silent: false,
      });

      // Auto-close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, 10000);

      // Handle click to focus the tab
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.log("Error showing browser notification:", error);
    }
  };

  // Monitor for new completed jobs
  useEffect(() => {
    if (!isLoaded || !hasFetchedInitialJobs) return;

    const completedJobs = jobs.filter(job => job.status === "done");
    const currentCompletedJobIds = new Set(completedJobs.map(job => job.created_at));

    if (isInitialLoadRef.current) {
      previousCompletedJobsRef.current = currentCompletedJobIds;
      isInitialLoadRef.current = false;
      setHasNewCompletedJobs(false);
      return;
    }

    if (!completedJobs.length) {
      setHasNewCompletedJobs(false);
      previousCompletedJobsRef.current = currentCompletedJobIds;
      return;
    }

    // Check if there are new completed jobs
    const hasNewJobs = completedJobs.some(job =>
      !previousCompletedJobsRef.current.has(job.created_at)
    );

    if (hasNewJobs) {
      setHasNewCompletedJobs(true);

      // Show browser notification if permission granted
      if (hasNotificationPermission) {
        showBrowserNotification();
      }

      // Start visual animation if tab is not visible
      if (!isTabVisible) {
        startNotificationAnimation();
      }
    }

    // Update the reference set
    previousCompletedJobsRef.current = currentCompletedJobIds;
  }, [jobs, isLoaded, isTabVisible, hasFetchedInitialJobs]);

  const playChime = () => {
    if (chimePlayedRef.current) return; // Already played
    
    try {
      const audio = new Audio('/chime.mp3');
      audio.volume = 0.7; // Set volume to 70% to avoid being too loud
      audio.play().catch((error) => {
        console.log('Could not play chime sound:', error);
        // Silently fail - some browsers block autoplay
      });
      chimePlayedRef.current = true;
    } catch (error) {
      console.log('Error playing chime:', error);
    }
  };

  const startNotificationAnimation = (forceVisible = false) => {
    if (flashingIntervalRef.current) return; // Already animating

    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!favicon) return;

    // Play chime once when notification starts
    playChime();

    let isFlashing = false;
    flashingIntervalRef.current = setInterval(() => {
      // For testing, allow animation even when tab is visible
      if (!forceVisible && isTabVisible) {
        // Stop animation if tab becomes visible (normal behavior)
        clearInterval(flashingIntervalRef.current!);
        flashingIntervalRef.current = null;
        return;
      }

      isFlashing = !isFlashing;
      
      // Update title
      document.title = isFlashing 
        ? "🎬 Video Ready! - BR-MAX" 
        : originalTitleRef.current;
      
      // Update favicon (create a simple notification icon)
      if (isFlashing) {
        // Create a simple notification icon using canvas
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Draw a simple notification bell
          ctx.fillStyle = 'red';
          ctx.beginPath();
          ctx.arc(16, 16, 14, 0, 2 * Math.PI);
          ctx.fill();
          
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', 16, 16);
        }
        
        favicon.href = canvas.toDataURL();
      } else {
        favicon.href = originalFaviconRef.current;
      }
    }, 1000); // Flash every second
  };

  const resetNotifications = () => {
    setHasNewCompletedJobs(false);
    
    // Clear animation
    if (flashingIntervalRef.current) {
      clearInterval(flashingIntervalRef.current);
      flashingIntervalRef.current = null;
    }
    
    // Reset chime flag for next notification
    chimePlayedRef.current = false;
    
    // Reset title and favicon
    if (typeof document !== "undefined") {
      document.title = originalTitleRef.current;
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        favicon.href = originalFaviconRef.current;
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flashingIntervalRef.current) {
        clearInterval(flashingIntervalRef.current);
      }
    };
  }, []);

  return {
    hasNewCompletedJobs,
    resetNotifications,
    hasNotificationPermission,
    requestNotificationPermission,
  };
};
