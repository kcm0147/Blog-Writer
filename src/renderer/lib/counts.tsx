import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";

interface CountsState {
  samples: number;
  history: number;
  refresh: () => Promise<void>;
}

const CountsContext = createContext<CountsState>({
  samples: 0,
  history: 0,
  refresh: async () => {},
});

export function CountsProvider({ children }: { children: React.ReactNode }) {
  const [samples, setSamples] = useState(0);
  const [history, setHistory] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([api.samples.list(), api.history.list()]);
      setSamples(s.length);
      setHistory(h.length);
    } catch (e) {
      // ignore – api may not be ready yet
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <CountsContext.Provider value={{ samples, history, refresh }}>
      {children}
    </CountsContext.Provider>
  );
}

export function useCounts() {
  return useContext(CountsContext);
}
