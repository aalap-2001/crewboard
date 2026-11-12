import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createMyProfile, watchUser } from "@/lib/firestore";
import type { Role, UserDoc } from "@/lib/types";

type Status = "loading" | "signedOut" | "unverified" | "signedIn";

/** Only these email domains may sign up (also enforced in firestore.rules). */
export const ALLOWED_DOMAINS = ["healtheon.ai", "kairosccl.ai"];
export const isAllowedEmail = (email: string) =>
  ALLOWED_DOMAINS.some((d) => email.trim().toLowerCase().endsWith("@" + d));

/** Where links in Firebase's account emails return to (works on GitHub Pages and Firebase Hosting). */
export const appUrl = (path = "") => window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "") + path;

interface AuthContextValue {
  status: Status;
  user: User | null;
  profile: UserDoc | null;
  /** Role from the ID-token custom claim (falls back to the mirrored profile role). */
  role: Role | null;
  /** Message shown on the login page, e.g. after deactivation. */
  notice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  /** Re-checks verification after the user clicks the link in their email. */
  refreshVerification: () => Promise<void>;
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
        if (!u.emailVerified) {
          setProfile(null);
          setStatus("unverified");
          return;
        }
        setStatus("loading");
        const token = await u.getIdTokenResult();
        setClaimRole((token.claims.role as Role | undefined) ?? null);
      }),
    []
  );

  // Live profile: handles deactivation and role changes while signed in.
  const [verifiedTick, setVerifiedTick] = useState(0);

  useEffect(() => {
    if (!user || !user.emailVerified) return;
    lastClaimsAt.current = null;
    let creating = false;
    const kickOut = async (msg: string) => {
      setNotice(msg);
      await fbSignOut(auth);
    };
    return watchUser(
      user.uid,
      async (doc) => {
        if (!doc && !creating && user.email && isAllowedEmail(user.email)) {
          // First sign-in after verifying: create the profile (rules check the verified company email).
          creating = true;
          try {
            await user.getIdToken(true); // make sure the token carries email_verified
            await createMyProfile(user.uid, user.email, user.displayName ?? "");
          } catch {
            await kickOut("We couldn't create your Crewboard profile. Try signing in again.");
          }
          return;
        }
        if (!doc && creating) return;
        if (!doc && user.email && !isAllowedEmail(user.email)) {
          await kickOut(`Crewboard sign-up is limited to ${ALLOWED_DOMAINS.map((d) => "@" + d).join(" and ")} addresses.`);
          return;
        }
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
  }, [user, verifiedTick]);

  const signIn = useCallback(async (email: string, password: string) => {
    setNotice(null);
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    setNotice(null);
    if (!isAllowedEmail(email)) {
      throw Object.assign(new Error("domain"), { code: "crewboard/domain" });
    }
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    await sendEmailVerification(cred.user, { url: appUrl("/login") });
  }, []);

  const resendVerification = useCallback(async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser, { url: appUrl("/login") });
  }, []);

  const refreshVerification = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    await u.reload();
    if (u.emailVerified) {
      await u.getIdToken(true);
      setUser(auth.currentUser);
      setStatus("loading");
      setVerifiedTick((n) => n + 1);
    }
  }, []);

  const signOut = useCallback(() => fbSignOut(auth), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status, user, profile, role: claimRole ?? profile?.role ?? null, notice,
      signIn, signUp, resendVerification, refreshVerification, signOut,
    }),
    [status, user, profile, claimRole, notice, signIn, signUp, resendVerification, refreshVerification, signOut]
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
