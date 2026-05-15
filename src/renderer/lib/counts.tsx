import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";
import type { SettingsWithKeyStatus } from "@shared/types";

interface CountsState {
  samples: number;
  history: number;
  settings: SettingsWithKeyStatus | null;
  refresh: () => Promise<void>;
}

const CountsContext = createContext<CountsState>({
  samples: 0,
  history: 0,
  settings: null,
  refresh: async () => {},
});

export function CountsProvider({ children }: { children: React.ReactNode }) {
  const [samples, setSamples] = useState(0);
  const [history, setHistory] = useState(0);
  const [settings, setSettings] = useState<SettingsWithKeyStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, h, st] = await Promise.all([
        api.samples.list(),
        api.history.list(),
        api.settings.get(),
      ]);
      setSamples(s.length);
      setHistory(h.length);
      setSettings(st);
    } catch (e) {
      console.warn("AppState refresh failed", e);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <CountsContext.Provider value={{ samples, history, settings, refresh }}>
      {children}
    </CountsContext.Provider>
  );
}

export function useCounts() {
  return useContext(CountsContext);
}
