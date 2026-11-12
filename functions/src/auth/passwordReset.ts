import { createHash } from "node:crypto";
import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { SMTP_SECRETS } from "../config";
import { auth, db, Timestamp } from "../lib/firebase";
import { asObject, requireEmail } from "../lib/validation";
import { sendEmail } from "../email/mailer";
import { passwordResetEmail } from "../email/messages";
import { buildActionUrl } from "../users/inviteLink";

const THROTTLE_MS = 60_000;

/**
 * Public "forgot password" endpoint. Sends a Crewboard-branded email over SMTP
 * (instead of Firebase's default template). Always returns ok so it can't be used
 * to discover which emails have accounts.
 */
export const requestPasswordReset = onCall({ secrets: SMTP_SECRETS }, async (req) => {
  const email = requireEmail(asObject(req.data));
  const key = createHash("sha256").update(email).digest("hex");
  const throttleRef = db.doc(`_throttle/pwreset_${key}`);

  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(throttleRef);
    const last = snap.exists ? (snap.get("at") as Timestamp).toMillis() : 0;
    if (Date.now() - last < THROTTLE_MS) return false;
    tx.set(throttleRef, { at: Timestamp.now() });
    return true;
  });
  if (!allowed) return { ok: true };

  try {
    const user = await auth.getUserByEmail(email);
    const profile = await db.doc(`users/${user.uid}`).get();
    if (user.disabled || profile.get("active") !== true) return { ok: true };
    const resetUrl = await buildActionUrl(email, "resetPassword");
    await sendEmail(email, passwordResetEmail({ name: profile.get("displayName") ?? "there", resetUrl }));
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== "auth/user-not-found") {
      logger.error("Password reset failed", { err });
    }
  }
  return { ok: true };
});
