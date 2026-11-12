import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { watchUsers } from "./firestore";
import type { UserDoc } from "./types";

interface UsersValue {
  users: UserDoc[] | null;
  byId: Map<string, UserDoc>;
  error: string | null;
}

const UsersContext = createContext<UsersValue | null>(null);

/** One live subscription to the team directory, shared by every signed-in screen. */
export function UsersProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<UserDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => watchUsers(setUsers, (e) => setError(e.message)), []);
  const value = useMemo(() => ({ users, byId: new Map((users ?? []).map((u) => [u.uid, u])), error }), [users, error]);
  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error("useUsers must be used inside <UsersProvider>");
  return ctx;
}

/** Display name for a uid, with sensible fallbacks. */
export function useUserName() {
  const { byId } = useUsers();
  return (uid: string) => (uid === "system" ? "Crewboard" : byId.get(uid)?.displayName ?? "Former teammate");
}
