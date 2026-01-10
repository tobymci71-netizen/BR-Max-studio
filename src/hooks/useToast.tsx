import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { CheckCircle, X } from "lucide-react";

type ToastType = "success" | "error";

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
}

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    ({ message, type = "success", duration = 3000 }: ToastConfig) => {
      hideToast();
      const id = `${Date.now()}-${Math.random()}`;
      setToast({ id, message, type });
      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [hideToast],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 12,
            background:
              toast.type === "success"
                ? "linear-gradient(135deg, #16a34a, #059669)"
                : "linear-gradient(135deg, #dc2626, #b91c1c)",
            color: "#fff",
            boxShadow: "0 20px 45px rgba(0,0,0,0.35)",
            minWidth: 280,
            alignSelf: "flex-start",
          }}
          role="status"
        >
          <CheckCircle size={20} />
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
            {toast.message}
          </div>
          <button
            onClick={hideToast}
            style={{
              border: "none",
              background: "transparent",
              color: "inherit",
              padding: 4,
              cursor: "pointer",
            }}
            aria-label="Dismiss toast"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
