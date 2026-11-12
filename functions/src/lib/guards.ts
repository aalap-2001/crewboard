import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { db } from "./firebase";
import type { Role, UserDoc } from "./types";

export interface Caller {
  uid: string;
  role: Role;
  profile: UserDoc;
}

/** Caller must be signed in and have an active /users doc. */
export async function requireActiveUser(req: CallableRequest): Promise<Caller> {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const snap = await db.doc(`users/${req.auth.uid}`).get();
  const profile = snap.data() as UserDoc | undefined;
  if (!profile || profile.active !== true) {
    throw new HttpsError("permission-denied", "Your account is not active.");
  }
  return { uid: req.auth.uid, role: req.auth.token.role as Role, profile };
}

/** Caller's token claim AND mirrored /users role must both be admin. */
export async function requireAdmin(req: CallableRequest): Promise<Caller> {
  const caller = await requireActiveUser(req);
  if (caller.role !== "admin" || caller.profile.role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can manage users.");
  }
  return caller;
}
