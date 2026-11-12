import { appUrl } from "../config";
import { auth, db, FieldValue } from "../lib/firebase";
import { sendEmail } from "../email/mailer";
import { welcomeEmail } from "../email/messages";
import type { Role } from "../lib/types";

export type ActionMode = "setup" | "resetPassword";

/**
 * Generates a Firebase password-reset code and wraps it in a Crewboard URL so the
 * user lands on our branded /auth/action page instead of Firebase's default one.
 */
export async function buildActionUrl(email: string, mode: ActionMode): Promise<string> {
  const link = await auth.generatePasswordResetLink(email);
  const oobCode = new URL(link).searchParams.get("oobCode");
  if (!oobCode) throw new Error("Could not generate a password link.");
  return appUrl(`/auth/action?mode=${mode}&oobCode=${encodeURIComponent(oobCode)}`);
}

export async function sendInvite(target: { uid: string; email: string; displayName: string; role: Role }, inviterName: string) {
  const setupUrl = await buildActionUrl(target.email, "setup");
  await sendEmail(target.email, welcomeEmail({ name: target.displayName, inviterName, role: target.role, setupUrl }));
  await db.doc(`users/${target.uid}`).update({ lastInviteSentAt: FieldValue.serverTimestamp() });
}
