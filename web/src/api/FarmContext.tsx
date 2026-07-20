import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./client";
import type { Farm } from "./types";

const FarmContext = createContext<{ farm: Farm | null; loading: boolean; error: string | null }>({
  farm: null,
  loading: true,
  error: null,
});

export function FarmProvider({ children }: { children: ReactNode }) {
  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listFarms()
      .then((farms) => setFarm(farms[0] ?? null))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return <FarmContext.Provider value={{ farm, loading, error }}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  return useContext(FarmContext);
}
