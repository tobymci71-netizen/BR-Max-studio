import { defaultMyCompProps } from "@/types/constants";
import type { CompositionPropsType } from "@/types/constants";

const STORAGE_KEY = "br-max-settings";
const STORAGE_VERSION = "1.0";

interface StoredSettings {
  version: string;
  settings: Partial<CompositionPropsType>;
  timestamp: number;
}

/**
 * Save settings to localStorage
 */
export const saveSettingsToLocalStorage = (settings: typeof defaultMyCompProps): void => {
  try {
    const dataToStore: StoredSettings = {
      version: STORAGE_VERSION,
      settings: {
        CHAT_SETTINGS: settings.CHAT_SETTINGS,
        elevenLabsApiKey: settings.elevenLabsApiKey,
        voices: settings.voices,
        greenScreen: settings.greenScreen,
        enableAudio: settings.enableAudio,
        messages: settings.messages,
      },
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
  } catch (error) {
    console.error("Failed to save settings to localStorage:", error);
  }
};

/**
 * Load settings from localStorage
 */
export const loadSettingsFromLocalStorage = (): Partial<CompositionPropsType> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed: StoredSettings = JSON.parse(stored);

    // Version check - if version doesn't match, return null to use defaults
    if (parsed.version !== STORAGE_VERSION) {
      console.log("Settings version mismatch, using defaults");
      return null;
    }

    return parsed.settings;
  } catch (error) {
    console.error("Failed to load settings from localStorage:", error);
    return null;
  }
};

/**
 * Clear settings from localStorage
 */
export const clearSettingsFromLocalStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear settings from localStorage:", error);
  }
};

/**
 * Merge saved settings with defaults
 */
export const mergeWithDefaults = (
  savedSettings: Partial<CompositionPropsType> | null
): typeof defaultMyCompProps => {
  if (!savedSettings) return defaultMyCompProps;

  return {
    ...defaultMyCompProps,
    ...savedSettings,
    CHAT_SETTINGS: {
      ...defaultMyCompProps.CHAT_SETTINGS,
      ...savedSettings.CHAT_SETTINGS,
    },
  };
};
