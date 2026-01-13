"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

type MaintenanceState = {
  isMaintenance: boolean;
  maintenanceMessage: string;
  adminUserIds: string[];
};

type AppContextType = {
  isFunModeOn: boolean;
  toggleFunMode: () => void;

  maintenance: MaintenanceState;
  refreshMaintenance: () => Promise<void>;

  systemCreatedAt: string | null;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [maintenance, setMaintenance] = useState<MaintenanceState>({
    isMaintenance: false,
    maintenanceMessage: "",
    adminUserIds: []
  });

  const [systemCreatedAt, setSystemCreatedAt] = useState<string | null>(null);

  const fetchIsMaintenanceMode = async () => {
    try {
      const response = await fetch("/api/isMaintenance");
      if (response.ok) {
        const { isMaintenance, maintenanceMessage, adminUserIds, systemCreatedAt } = await response.json();
        setMaintenance({ isMaintenance, maintenanceMessage, adminUserIds });
        setSystemCreatedAt(systemCreatedAt);
      }
    } catch (err) {
      console.error("Failed to fetch maintenance status:", err);
    }
  };

  useEffect(() => {
    fetchIsMaintenanceMode();
  }, []);

  const [isFunModeOn, setFunMode] = useState<boolean>(false);

  const value: AppContextType = {
    isFunModeOn,
    toggleFunMode: () => setFunMode((prev) => !prev),

    maintenance,
    refreshMaintenance: fetchIsMaintenanceMode,

    systemCreatedAt,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}