#!/usr/bin/env node
/**
 * Creates (or promotes) the first Crewboard admin.
 *
 * Usage:
 *   node scripts/create-admin.mjs --email you@company.com --name "Your Name" --project your-project-id \
 *        [--app-url https://your-project.web.app] [--emulator]
 *
 * Credentials (production): run `gcloud auth application-default login`, or set
 * GOOGLE_APPLICATION_CREDENTIALS to a service-account key file.
 * With --emulator it talks to the local Auth (9099) and Firestore (8080) emulators instead.
 *
 * The script prints a password-setup link. Open it to choose your password.
 */
import { randomBytes } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, all) => {
    if (arg.startsWith("--")) {
      const next = all[i + 1];
      acc.push([arg.slice(2), next && !next.startsWith("--") ? next : true]);
    }
    return acc;
  }, [])
);

const email = typeof args.email === "string" ? args.email.trim().toLowerCase() : "";
const name = typeof args.name === "string" ? args.name.trim() : "";
const emulator = args.emulator === true;
const projectId =
  (typeof args.project === "string" && args.project) ||
  process.env.GCLOUD_PROJECT ||
  (emulator ? "demo-crewboard" : "");
const appUrl = String(
  (typeof args["app-url"] === "string" && args["app-url"]) ||
    (emulator ? "http://localhost:5173" : `https://${projectId}.web.app`)
).replace(/\/+$/, "");

if (!email || !name || !projectId) {
  console.error(
    'Usage: node scripts/create-admin.mjs --email you@company.com --name "Your Name" --project <project-id> [--app-url <url>] [--emulator]'
  );
  process.exit(1);
}

if (emulator) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
}

const { initializeApp } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
const { getFirestore, FieldValue } = await import("firebase-admin/firestore");

initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

let user;
try {
  user = await auth.getUserByEmail(email);
  console.log(`Found existing user ${user.uid}; promoting to admin.`);
  if (user.disabled) await auth.updateUser(user.uid, { disabled: false });
} catch (err) {
  if (err?.code !== "auth/user-not-found") throw err;
  user = await auth.createUser({
    email,
    displayName: name,
    password: randomBytes(24).toString("base64url"),
    emailVerified: false,
  });
  console.log(`Created user ${user.uid}.`);
}

await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: "admin" });

const ref = db.doc(`users/${user.uid}`);
const existing = await ref.get();
await ref.set(
  {
    uid: user.uid,
    email,
    displayName: existing.get("displayName") ?? name,
    role: "admin",
    active: true,
    avatarUrl: existing.get("avatarUrl") ?? null,
    notificationPrefs: existing.get("notificationPrefs") ?? {
      emailOnAssignment: true,
      emailOnMention: true,
      dailyDigest: true,
    },
    invitedBy: existing.get("invitedBy") ?? null,
    lastInviteSentAt: FieldValue.serverTimestamp(),
    claimsUpdatedAt: FieldValue.serverTimestamp(),
    createdAt: existing.get("createdAt") ?? FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  },
  { merge: true }
);

const link = await auth.generatePasswordResetLink(email);
const oobCode = new URL(link).searchParams.get("oobCode");
console.log("\nCrewboard admin ready.");
console.log("Open this link within 1 hour to set your password:\n");
console.log(`  ${appUrl}/auth/action?mode=setup&oobCode=${encodeURIComponent(oobCode)}\n`);
process.exit(0);
