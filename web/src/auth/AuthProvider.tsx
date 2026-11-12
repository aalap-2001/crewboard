import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { watchUser } from "@/lib/firestore";
import type { Role, UserDoc } from "@/lib/types";

type Status = "loading" | "signedOut" | "signedIn";

interface AuthContextValue {
  status: Status;
  user: User | null;
  profile: UserDoc | null;
  /** Role from the ID-token custom claim (falls back to the mirrored profile role). */
  role: Role | null;
  /** Message shown on the login page, e.g. after deactivation. */
  notice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [claimRole, setClaimRole] = useState<Role | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastClaimsAt = useRef<number | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (!u) {
          setProfile(null);
          setClaimRole(null);
          setStatus("signedOut");
          return;
        }
        setStatus("loading");
        const token = await u.getIdTokenResult();
        setClaimRole((token.claims.role as Role | undefined) ?? null);
      }),
    []
  );

  // Live profile: handles deactivation and role changes while signed in.
  useEffect(() => {
    if (!user) return;
    lastClaimsAt.current = null;
    const kickOut = async (msg: string) => {
      setNotice(msg);
      await fbSignOut(auth);
    };
    return watchUser(
      user.uid,
      async (doc) => {
        if (!doc || !doc.active) {
          await kickOut("Your Crewboard account is deactivated. Contact your admin to regain access.");
          return;
        }
        const ts = doc.claimsUpdatedAt?.toMillis() ?? 0;
        if (lastClaimsAt.current !== null && ts !== lastClaimsAt.current) {
          const token = await user.getIdTokenResult(true); // role changed → refresh claims
          setClaimRole((token.claims.role as Role | undefined) ?? null);
        }
        lastClaimsAt.current = ts;
        setProfile(doc);
        setStatus("signedIn");
      },
      () => void kickOut("We couldn't load your Crewboard account. It may have been deactivated.")
    );
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    setNotice(null);
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signOut = useCallback(() => fbSignOut(auth), []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, profile, role: claimRole ?? profile?.role ?? null, notice, signIn, signOut }),
    [status, user, profile, claimRole, notice, signIn, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Narrowed hook for pages behind <RequireAuth>. */
export function useSignedIn() {
  const ctx = useAuth();
  if (!ctx.user || !ctx.profile || !ctx.role) throw new Error("useSignedIn used outside a signed-in route");
  return { ...ctx, user: ctx.user, profile: ctx.profile, role: ctx.role };
}
