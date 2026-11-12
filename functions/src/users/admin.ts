import { randomBytes } from "node:crypto";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { SMTP_SECRETS } from "../config";
import { auth, db, FieldValue } from "../lib/firebase";
import { requireAdmin } from "../lib/guards";
import { DEFAULT_NOTIFICATION_PREFS, type Role, type UserDoc } from "../lib/types";
import { asObject, requireBool, requireEmail, requireRole, requireString } from "../lib/validation";
import { sendInvite } from "./inviteLink";

async function loadUser(uid: string) {
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "That user doesn't exist.");
  return { ref, user: snap.data() as UserDoc };
}

/** Throws if removing `uid` from the admin pool would leave zero active admins. */
async function assertAnotherActiveAdmin(uid: string) {
  const admins = await db.collection("users").where("role", "==", "admin").where("active", "==", true).get();
  if (!admins.docs.some((d) => d.id !== uid)) {
    throw new HttpsError("failed-precondition", "Crewboard needs at least one active admin.");
  }
}

/** Admin invites a teammate: Auth user + /users doc + role claim + welcome email. */
export const inviteUser = onCall({ secrets: SMTP_SECRETS }, async (req) => {
  const caller = await requireAdmin(req);
  const data = asObject(req.data);
  const displayName = requireString(data, "name", { max: 80, label: "Name" });
  const email = requireEmail(data);
  const role = requireRole(data);

  let uid: string;
  try {
    const record = await auth.createUser({
      email,
      displayName,
      // Random throwaway password; the user sets their own from the invite link.
      password: randomBytes(24).toString("base64url"),
      emailVerified: false,
    });
    uid = record.uid;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Someone with that email is already on Crewboard.");
    }
    throw err;
  }

  await auth.setCustomUserClaims(uid, { role });

  const doc: UserDoc = {
    uid,
    email,
    displayName,
    role,
    active: true,
    avatarUrl: null,
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    invitedBy: caller.uid,
    lastInviteSentAt: null,
    claimsUpdatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await db.doc(`users/${uid}`).set(doc);

  // The account exists even if email fails; the admin can resend from the panel.
  let emailSent = true;
  try {
    await sendInvite({ uid, email, displayName, role }, caller.profile.displayName);
  } catch (err) {
    emailSent = false;
    logger.error("Invite email failed", { uid, err });
  }
  return { uid, emailSent };
});

export const resendInvite = onCall({ secrets: SMTP_SECRETS }, async (req) => {
  const caller = await requireAdmin(req);
  const uid = requireString(asObject(req.data), "uid", { max: 128 });
  const { user } = await loadUser(uid);
  if (!user.active) throw new HttpsError("failed-precondition", "Reactivate this user before resending their invite.");
  try {
    await sendInvite(user, caller.profile.displayName);
  } catch (err) {
    logger.error("Resend invite failed", { uid, err });
    throw new HttpsError("unavailable", "The invite email couldn't be sent. Check the SMTP settings and try again.");
  }
  return { ok: true };
});

export const setUserRole = onCall(async (req) => {
  const caller = await requireAdmin(req);
  const data = asObject(req.data);
  const uid = requireString(data, "uid", { max: 128 });
  const role: Role = requireRole(data);

  if (uid === caller.uid) throw new HttpsError("failed-precondition", "You can't change your own role.");
  const { ref, user } = await loadUser(uid);
  if (user.role === role) return { ok: true };
  if (user.role === "admin") await assertAnotherActiveAdmin(uid);

  const record = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...(record.customClaims ?? {}), role });
  await ref.update({
    role,
    claimsUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info("Role changed", { by: caller.uid, uid, from: user.role, to: role });
  return { ok: true };
});

export const setUserActive = onCall(async (req) => {
  const caller = await requireAdmin(req);
  const data = asObject(req.data);
  const uid = requireString(data, "uid", { max: 128 });
  const active = requireBool(data, "active");

  if (uid === caller.uid) throw new HttpsError("failed-precondition", "You can't deactivate your own account.");
  const { ref, user } = await loadUser(uid);
  if (user.active === active) return { ok: true };
  if (!active && user.role === "admin") await assertAnotherActiveAdmin(uid);

  await auth.updateUser(uid, { disabled: !active });
  if (!active) await auth.revokeRefreshTokens(uid);
  await ref.update({ active, updatedAt: FieldValue.serverTimestamp() });
  logger.info(active ? "User reactivated" : "User deactivated", { by: caller.uid, uid });
  return { ok: true };
});
