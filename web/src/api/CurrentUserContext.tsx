import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getCurrentUserId, setCurrentUserId } from "./client";
import type { User } from "./types";
import { useFarm } from "./FarmContext";

const CurrentUserContext = createContext<{
  users: User[];
  currentUser: User | null;
  setCurrentUserId: (id: string) => void;
}>({ users: [], currentUser: null, setCurrentUserId: () => {} });

/**
 * There's no login system yet — this stands in for auth by letting the user
 * pick which seeded person they're acting as. The choice is persisted to
 * localStorage and sent as the `x-user-id` header on every write request
 * (see api/client.ts), which the server's role-permission middleware checks.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { farm } = useFarm();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState(getCurrentUserId());

  useEffect(() => {
    if (!farm) return;
    api.listUsers(farm.id).then((list) => {
      setUsers(list);
      if (!selectedId || !list.some((u) => u.id === selectedId)) {
        const owner = list.find((u) => u.role === "OWNER") ?? list[0];
        if (owner) select(owner.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farm]);

  function select(id: string) {
    setCurrentUserId(id);
    setSelectedId(id);
  }

  const currentUser = users.find((u) => u.id === selectedId) ?? null;

  return (
    <CurrentUserContext.Provider value={{ users, currentUser, setCurrentUserId: select }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
