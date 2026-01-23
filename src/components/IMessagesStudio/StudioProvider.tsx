import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { defaultMyCompProps } from "@/types/constants";
import type { CompositionPropsType } from "@/types/constants";
import { usePreviewBuilder } from "./hooks/usePreviewBuilder";
import type { MonetizationPreviewContext } from "@/helpers/previewBuilder";
import { parseScriptText } from "./hooks/useScriptParser";
import {
  DEFAULT_SCRIPT_TEMPLATE,
  SCRIPT_EDITOR_STORAGE_KEY,
} from "./constants";

const STUDIO_STORAGE_KEY = "studio-settings";

interface StudioFormContextType {
  formValues: CompositionPropsType;
  backgroundFile: File | null;
  currentStep: number;
  errors: Record<string, string>;
  isSubscribed: boolean;
  updateFormValues: (updates: Partial<CompositionPropsType>) => void;
  updateChatSettings: <K extends keyof CompositionPropsType["CHAT_SETTINGS"]>(
    key: K,
    value: CompositionPropsType["CHAT_SETTINGS"][K],
  ) => void;
  setCurrentStep: (step: number) => void;
  validateStep: (step: number) => boolean;
  validateAllSteps: () => boolean;
  getStepErrors: (step: number) => Record<string, string>;
  resetForm: () => void;
  setBackgroundFile: (file: File | null) => void;
}

interface StudioPreviewContextType {
  previewProps: CompositionPropsType;
  durationInFrames: number;
  previewGeneration: number;
  generatePreview: () => void;
  buildPreviewFromValues: (values: CompositionPropsType) => {
    previewProps: CompositionPropsType;
    totalFrames: number;
    monetizationContext: import("@/helpers/previewBuilder").MonetizationPreviewContext | null;
  };
}

const StudioFormContext = createContext<StudioFormContextType | null>(null);
const StudioPreviewContext = createContext<StudioPreviewContextType | null>(
  null,
);

interface StudioProviderProps {
  children: React.ReactNode;
  isSubscribed?: boolean;
}

export function StudioProvider({ children, isSubscribed = false }: StudioProviderProps) {
  const [formValues, setFormValues] =
    useState<CompositionPropsType>(defaultMyCompProps);
  const [previewProps, setPreviewProps] =
    useState<CompositionPropsType>(defaultMyCompProps);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [durationInFrames, setDurationInFrames] = useState(3000);
  const [previewGeneration, setPreviewGeneration] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasHydrated, setHasHydrated] = useState(false);
  const [hasAppliedScript, setHasAppliedScript] = useState(false);
  const formValuesRef = useRef<CompositionPropsType>(formValues);
  const isInitialLoad = useRef(true);
  const hasAppliedScriptFromEditor = useRef(false);

  // Deep merge helper function that preserves saved values
  const deepMerge = useCallback(
    (
      target: CompositionPropsType,
      source: Partial<CompositionPropsType>,
    ): CompositionPropsType => {
      const merged = { ...target };

      // Helper function to safely assign a value to a property
      const assignProperty = <K extends keyof CompositionPropsType>(
        key: K,
        value: CompositionPropsType[K],
      ): void => {
        merged[key] = value;
      };

      // Merge top-level properties
      (Object.keys(source) as Array<keyof CompositionPropsType>).forEach(
        (sourceKey) => {
          const sourceValue = source[sourceKey];

          if (sourceValue === undefined || sourceValue === null) {
            // Skip undefined/null values to preserve existing data
            return;
          }

          // Deep merge CHAT_SETTINGS
          if (
            sourceKey === "CHAT_SETTINGS" &&
            typeof sourceValue === "object" &&
            !Array.isArray(sourceValue)
          ) {
            assignProperty(sourceKey, {
              ...target.CHAT_SETTINGS,
              ...sourceValue,
            } as CompositionPropsType["CHAT_SETTINGS"]);
          }
          // Replace voices array if source has voices (preserve saved voice IDs)
          // Always use saved voices array if it exists, even if some voiceIds are empty
          else if (sourceKey === "voices" && Array.isArray(sourceValue)) {
            assignProperty(
              sourceKey,
              sourceValue as CompositionPropsType["voices"],
            );
          }
          // Replace messages array if source has messages
          else if (
            sourceKey === "messages" &&
            Array.isArray(sourceValue) &&
            sourceValue.length > 0
          ) {
            assignProperty(
              sourceKey,
              sourceValue as CompositionPropsType["messages"],
            );
          }
          // For string properties, only update if source value is not empty
          else if (typeof sourceValue === "string") {
            if (sourceValue !== "") {
              assignProperty(
                sourceKey,
                sourceValue as CompositionPropsType[typeof sourceKey],
              );
            }
            // If sourceValue is empty string, preserve the target value (don't overwrite)
          }
          // For other non-string properties (booleans, numbers, etc.), always use source value
          else {
            assignProperty(
              sourceKey,
              sourceValue as CompositionPropsType[typeof sourceKey],
            );
          }
        },
      );

      return merged;
    },
    [],
  );

  // Hydrate saved form values from localStorage (only on mount)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STUDIO_STORAGE_KEY);
    if (!stored) {
      isInitialLoad.current = false;
      setHasHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<CompositionPropsType>;
      // Use deep merge to properly merge nested objects
      setFormValues((prev) => deepMerge(prev, parsed));
    } catch (error) {
      console.error("Failed to parse saved studio settings:", error);
    } finally {
      // Mark initial load as complete after a short delay to ensure state is set
      setTimeout(() => {
        isInitialLoad.current = false;
        setHasHydrated(true);
      }, 100);
    }
  }, [deepMerge]);

  // Persist form values to localStorage whenever they change (but not during initial load)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInitialLoad.current) return; // Don't save during initial load

    try {
      // Create a copy and remove calculated monetization fields that should never be persisted
      const { monetization, ...restValues } = formValues;
      const restMonetization = { ...monetization };
      delete restMonetization.startFrame;
      delete restMonetization.durationInFrames;
      delete restMonetization.rizzReplyStartFrame;

      const valuesToSave = {
        ...restValues,
        monetization: restMonetization, // Only save non-calculated fields
      };

      console.log('[PROVIDER] Saving to localStorage (without calculated fields)');

      window.localStorage.setItem(
        STUDIO_STORAGE_KEY,
        JSON.stringify(valuesToSave),
      );
    } catch (error) {
      console.error("Failed to persist studio settings:", error);
    }
  }, [formValues]);

  // Preview builder hook
  const { buildPreview } = usePreviewBuilder();

  const updateFormValues = useCallback(
    (updates: Partial<CompositionPropsType>) => {
      setFormValues((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  const updateChatSettings = useCallback(
    <K extends keyof CompositionPropsType["CHAT_SETTINGS"]>(
      key: K,
      value: CompositionPropsType["CHAT_SETTINGS"][K],
    ) => {
      setFormValues((prev) => ({
        ...prev,
        CHAT_SETTINGS: { ...prev.CHAT_SETTINGS, [key]: value },
      }));
    },
    [],
  );

  useEffect(() => {
    formValuesRef.current = formValues;
  }, [formValues]);

  // If a script was saved in the editor, parse and apply it once on load
  useEffect(() => {
    if (!hasHydrated) return;
    if (typeof window === "undefined") return;
    
    // If script was already applied in a previous render, just mark as complete
    if (hasAppliedScriptFromEditor.current) {
      setHasAppliedScript(true);
      return;
    }

    try {
      const storedScript = window.localStorage.getItem(
        SCRIPT_EDITOR_STORAGE_KEY,
      );
      const hasStoredScript = Boolean(storedScript && storedScript.trim());
      const hasExistingMessages = formValuesRef.current.messages.length > 0;
      const matchesDefaultMessages =
        JSON.stringify(formValuesRef.current.messages) ===
        JSON.stringify(defaultMyCompProps.messages);

      if (!hasStoredScript && hasExistingMessages && !matchesDefaultMessages) {
        hasAppliedScriptFromEditor.current = true;
        setHasAppliedScript(true);
        return;
      }

      const scriptToUse = hasStoredScript
        ? String(storedScript)
        : DEFAULT_SCRIPT_TEMPLATE;

      const { messages, voices } = parseScriptText(scriptToUse);

      // Preserve any existing voice IDs by matching on name
      const mergedVoices = voices.map((voice) => {
        const existing = formValuesRef.current.voices.find(
          (candidate) =>
            candidate.name.trim().toLowerCase() ===
            voice.name.trim().toLowerCase(),
        );
        return existing ? { ...voice, voiceId: existing.voiceId } : voice;
      });

      setFormValues((prev) => ({
        ...prev,
        messages,
        voices: mergedVoices,
      }));
      hasAppliedScriptFromEditor.current = true;
      setHasAppliedScript(true);
    } catch (error) {
      console.error("Failed to apply saved script:", error);
      setHasAppliedScript(true);
    }
  }, [hasHydrated]);

  const applyPreviewUpdate = useCallback(
    (
      previewPayload: {
        previewProps: CompositionPropsType;
        totalFrames: number;
        monetizationContext: MonetizationPreviewContext | null;
      },
      bumpGeneration: boolean = true,
    ) => {
      console.log('[PROVIDER] applyPreviewUpdate called with:', {
        startFrame: previewPayload.previewProps.monetization?.startFrame,
        durationInFrames: previewPayload.previewProps.monetization?.durationInFrames,
      });
      // Always create a fresh object so state updates even if the values are identical
      // Include showWatermark based on subscription status
      setPreviewProps({
        ...previewPayload.previewProps,
        showWatermark: !isSubscribed,
      });
      setDurationInFrames(previewPayload.totalFrames);
      if (bumpGeneration) {
        setPreviewGeneration((prev) => prev + 1);
      }
    },
    [isSubscribed],
  );

  const generatePreview = useCallback(() => {
    const payload = buildPreview(formValuesRef.current);
    applyPreviewUpdate(payload, true);
  }, [applyPreviewUpdate, buildPreview]);

  // Keep preview in sync once hydration is done
  useEffect(() => {
    if (!hasHydrated) return;
    const payload = buildPreview(formValuesRef.current);
    applyPreviewUpdate(payload);
  }, [hasHydrated, formValues, buildPreview, applyPreviewUpdate]);

  // Trigger preview re-render after all data is loaded (hydration + script application)
  useEffect(() => {
    if (!hasHydrated || !hasAppliedScript) return;
    
    // Use a small delay to ensure all state updates have been applied
    const timeoutId = setTimeout(() => {
      const payload = buildPreview(formValuesRef.current);
      applyPreviewUpdate(payload);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [hasHydrated, hasAppliedScript, buildPreview, applyPreviewUpdate]);

  const collectStepErrors = useCallback(
    (step: number): Record<string, string> => {
      const newErrors: Record<string, string> = {};

      switch (step) {
        case 0: // Script Step
          if (!formValues.messages.length) {
            newErrors.messages = "Please add at least one message";
          }
          if (!formValues.CHAT_SETTINGS.recipientName) {
            newErrors.recipientName = "Recipient name is required";
          }
          break;

        case 1: // Monetization Step
          if (formValues.monetization?.enabled) {
            if (!formValues.monetization?.messages.length) {
              newErrors.monetization = "Add at least one monetization message";
            }
            if (!formValues.monetization?.category) {
              newErrors.monetizationCategory = "Choose a monetization category";
            }
            if (!formValues.monetization?.campaign) {
              newErrors.monetizationCampaign = "Select a campaign";
            }
            if (!formValues.monetization?.startMessage) {
              newErrors.monetizationStartMessage =
                "Enter a starting message for the handoff";
            }
            if (!formValues.monetization?.meVoiceId?.trim()) {
              newErrors.monetizationMeVoiceId =
                "Add a voice ID for the \"me\" speaker in monetization";
            }
          }
          break;

        case 2: // Voice Step
          if (!formValues.elevenLabsApiKey) {
            newErrors.elevenLabsApiKey = "ElevenLabs API key is required";
          }
          const missingVoices = formValues.voices.filter((v) => !v.voiceId);
          if (missingVoices.length > 0) {
            newErrors.voices = `Please assign voice IDs for: ${missingVoices.map((v) => v.name).join(", ")}`;
          }
          break;

        case 3: // Appearance Step
          if (formValues.CHAT_SETTINGS.roundedCornersRadius > 70) {
            newErrors.roundedCornersRadius = "Radius should be 70 or less";
          }
          break;
      }

      return newErrors;
    },
    [formValues],
  );

  const validateStep = useCallback(
    (step: number): boolean => {
      const newErrors = collectStepErrors(step);
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [collectStepErrors],
  );

  const validateAllSteps = useCallback((): boolean => {
    const aggregatedErrors = [0, 1, 2, 3].reduce<Record<string, string>>(
      (acc, step) => {
        return { ...acc, ...collectStepErrors(step) };
      },
      {},
    );
    setErrors(aggregatedErrors);
    return Object.keys(aggregatedErrors).length === 0;
  }, [collectStepErrors]);

  const getStepErrors = useCallback(
    (step: number) => {
      return collectStepErrors(step);
    },
    [collectStepErrors],
  );

  const resetForm = useCallback(() => {
    // Parse the default script template
    const { messages, voices } = parseScriptText(DEFAULT_SCRIPT_TEMPLATE);

    // Reset to defaults with parsed script
    const resetValues = {
      ...defaultMyCompProps,
      messages,
      voices,
    };

    setFormValues(resetValues);
    setBackgroundFile(null);
    setCurrentStep(0);
    setErrors({});

    // Clear localStorage
    localStorage.removeItem(STUDIO_STORAGE_KEY);
    localStorage.removeItem(SCRIPT_EDITOR_STORAGE_KEY);

    // Build and apply preview with reset values
    const previewPayload = buildPreview(resetValues);
    setPreviewProps({
      ...previewPayload.previewProps,
      showWatermark: !isSubscribed,
    });
    setDurationInFrames(previewPayload.totalFrames);
    setPreviewGeneration((prev) => prev + 1);
  }, [buildPreview, isSubscribed]);

  const formContextValue = useMemo(
    () => ({
      formValues,
      backgroundFile,
      currentStep,
      errors,
      isSubscribed,
      updateFormValues,
      updateChatSettings,
      setCurrentStep,
      validateStep,
      validateAllSteps,
      getStepErrors,
      resetForm,
      setBackgroundFile,
    }),
    [
      formValues,
      backgroundFile,
      currentStep,
      errors,
      isSubscribed,
      updateFormValues,
      updateChatSettings,
      setCurrentStep,
      validateStep,
      validateAllSteps,
      getStepErrors,
      resetForm,
      setBackgroundFile,
    ],
  );

  const buildPreviewFromValues = useCallback(
    (values: CompositionPropsType) => buildPreview(values),
    [buildPreview],
  );

  const previewContextValue = useMemo(
    () => ({
      previewProps,
      durationInFrames,
      previewGeneration,
      generatePreview,
      buildPreviewFromValues,
    }),
    [
      previewProps,
      durationInFrames,
      previewGeneration,
      generatePreview,
      buildPreviewFromValues,
    ],
  );

  return (
    <StudioFormContext.Provider value={formContextValue}>
      <StudioPreviewContext.Provider value={previewContextValue}>
        {children}
      </StudioPreviewContext.Provider>
    </StudioFormContext.Provider>
  );
}

export function useStudioForm() {
  const context = useContext(StudioFormContext);
  if (!context)
    throw new Error("useStudioForm must be used within StudioProvider");
  return context;
}

export function useStudioPreview() {
  const context = useContext(StudioPreviewContext);
  if (!context)
    throw new Error("useStudioPreview must be used within StudioProvider");
  return context;
}
