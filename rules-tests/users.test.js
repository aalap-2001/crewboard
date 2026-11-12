// Run with: npm run test:rules   (from the repo root; starts the Firestore emulator)
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs } from "firebase/firestore";

let env;
const PREFS = { emailOnAssignment: true, emailOnMention: true, dailyDigest: false };

const user = (uid, role, active = true) => ({
  uid,
  email: `${uid}@crew.test`,
  displayName: uid,
  role,
  active,
  avatarUrl: null,
  notificationPrefs: PREFS,
  invitedBy: null,
  lastInviteSentAt: null,
  claimsUpdatedAt: null,
  createdAt: null,
  updatedAt: null,
});

const as = (uid, role) => env.authenticatedContext(uid, { role }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-crewboard",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/admin1"), user("admin1", "admin"));
    await setDoc(doc(db, "users/mgr1"), user("mgr1", "manager"));
    await setDoc(doc(db, "users/mem1"), user("mem1", "member"));
    await setDoc(doc(db, "users/gone1"), user("gone1", "member", false));
  });
});

describe("users: read", () => {
  test("signed-out visitors can't read users", async () => {
    await assertFails(getDoc(doc(anon(), "users/mem1")));
  });
  test("active members can read the team directory", async () => {
    await assertSucceeds(getDoc(doc(as("mem1", "member"), "users/admin1")));
    await assertSucceeds(getDocs(collection(as("mem1", "member"), "users")));
  });
  test("deactivated users lose read access even with a valid token", async () => {
    await assertFails(getDoc(doc(as("gone1", "member"), "users/gone1")));
  });
  test("a signed-in account with no /users doc can't read", async () => {
    await assertFails(getDoc(doc(as("stranger", "admin"), "users/mem1")));
  });
});

describe("users: own profile", () => {
  test("can update display name, avatar and notification preferences", async () => {
    await assertSucceeds(
      updateDoc(doc(as("mem1", "member"), "users/mem1"), {
        displayName: "Mem One",
        avatarUrl: "https://example.com/a.png",
        notificationPrefs: { emailOnAssignment: false, emailOnMention: true, dailyDigest: true },
        updatedAt: serverTimestamp(),
      })
    );
  });
  test("can't change own role", async () => {
    await assertFails(updateDoc(doc(as("mem1", "member"), "users/mem1"), { role: "admin", updatedAt: serverTimestamp() }));
  });
  test("can't reactivate self or change email", async () => {
    await assertFails(updateDoc(doc(as("gone1", "member"), "users/gone1"), { active: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as("mem1", "member"), "users/mem1"), { email: "x@y.z", updatedAt: serverTimestamp() }));
  });
  test("rejects invalid profile data", async () => {
    const db = as("mem1", "member");
    await assertFails(updateDoc(doc(db, "users/mem1"), { displayName: "", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "users/mem1"), { avatarUrl: "javascript:alert(1)", updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(doc(db, "users/mem1"), { notificationPrefs: { emailOnAssignment: "yes" }, updatedAt: serverTimestamp() })
    );
    await assertFails(updateDoc(doc(db, "users/mem1"), { displayName: "ok" })); // missing updatedAt
  });
  test("can't edit someone else's profile", async () => {
    await assertFails(updateDoc(doc(as("mem1", "member"), "users/mgr1"), { displayName: "hacked", updatedAt: serverTimestamp() }));
  });
});

describe("users: management is server-only", () => {
  test("even admins can't change roles or activation from the client", async () => {
    const db = as("admin1", "admin");
    await assertFails(updateDoc(doc(db, "users/mem1"), { role: "manager", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "users/mem1"), { active: false, updatedAt: serverTimestamp() }));
  });
  test("nobody can create or delete user docs from the client", async () => {
    await assertFails(setDoc(doc(as("admin1", "admin"), "users/new1"), user("new1", "member")));
    await assertFails(setDoc(doc(as("x", "member"), "users/x"), user("x", "admin")));
    await assertFails(deleteDoc(doc(as("admin1", "admin"), "users/mem1")));
  });
});

describe("other collections", () => {
  test("server-only and not-yet-enabled collections are denied", async () => {
    await assertFails(getDoc(doc(as("admin1", "admin"), "_throttle/x")));
    await assertFails(setDoc(doc(as("admin1", "admin"), "somethingElse/n1"), { name: "x" }));
  });
});
