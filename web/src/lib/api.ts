import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { Role } from "./types";

function callable<Req, Res>(name: string) {
  const fn = httpsCallable<Req, Res>(functions, name);
  return async (data: Req): Promise<Res> => (await fn(data)).data;
}

/** Typed wrappers around Crewboard Cloud Functions. */
export const api = {
  inviteUser: callable<{ name: string; email: string; role: Role }, { uid: string; emailSent: boolean }>("inviteUser"),
  resendInvite: callable<{ uid: string }, { ok: true }>("resendInvite"),
  setUserRole: callable<{ uid: string; role: Role }, { ok: true }>("setUserRole"),
  setUserActive: callable<{ uid: string; active: boolean }, { ok: true }>("setUserActive"),
  requestPasswordReset: callable<{ email: string }, { ok: true }>("requestPasswordReset"),
};

const AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match.",
  "auth/wrong-password": "That email and password don't match.",
  "auth/user-not-found": "That email and password don't match.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-disabled": "This account has been deactivated. Contact your Crewboard admin.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes, then try again.",
  "auth/network-request-failed": "Can't reach Crewboard. Check your connection and try again.",
  "auth/expired-action-code": "This link has expired. Request a new one.",
  "auth/invalid-action-code": "This link is invalid or was already used. Request a new one.",
  "auth/weak-password": "Choose a password with at least 8 characters.",
  "functions/unavailable": "Crewboard's server is unreachable right now. Try again shortly.",
  "permission-denied": "You don't have access to that.",
};

/** Turns Firebase/Functions errors into short, actionable messages. */
export function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code: unknown }).code);
    if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
    // HttpsError from our functions carries a user-facing message.
    if (code.startsWith("functions/") && err instanceof Error && err.message && err.message !== "internal") {
      return err.message;
    }
  }
  if (err instanceof Error && err.message) return err.message.replace(/^Firebase:\s*/, "");
  return "Something went wrong. Try again.";
}
