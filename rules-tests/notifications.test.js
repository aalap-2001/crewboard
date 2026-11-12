// Run with: npm run test:rules   (from the repo root; starts the Firestore emulator)
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from "firebase/firestore";

let env;
const ts = Timestamp.fromDate(new Date("2026-01-01"));
const PREFS = { emailOnAssignment: true, emailOnMention: true, dailyDigest: true };
const user = (uid, role, active = true) => ({
  uid, email: `${uid}@crew.test`, displayName: uid, role, active, avatarUrl: null, notificationPrefs: PREFS,
  invitedBy: null, lastInviteSentAt: null, claimsUpdatedAt: null, createdAt: null, updatedAt: null,
});
const notif = (recipientId) => ({
  recipientId, type: "mentioned", alsoMentioned: false, actorId: "mgr1", taskId: "t1", boardId: "b1",
  taskTitle: "Fix login", boardName: "Launch", source: "comment", commentId: "c1", snippet: "hi",
  read: false, readAt: null, emailStatus: "sent", createdAt: ts,
});
const as = (uid, role = "member") => env.authenticatedContext(uid, { role }).firestore();

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
    await setDoc(doc(db, "users/mem1"), user("mem1", "member"));
    await setDoc(doc(db, "users/mem2"), user("mem2", "member"));
    await setDoc(doc(db, "users/admin1"), user("admin1", "admin"));
    await setDoc(doc(db, "users/gone1"), user("gone1", "member", false));
    await setDoc(doc(db, "notifications/n1"), notif("mem1"));
    await setDoc(doc(db, "notifications/n2"), notif("gone1"));
  });
});

describe("notifications", () => {
  test("only the recipient can read a notification", async () => {
    await assertSucceeds(getDoc(doc(as("mem1"), "notifications/n1")));
    await assertFails(getDoc(doc(as("mem2"), "notifications/n1")));
    await assertFails(getDoc(doc(as("admin1", "admin"), "notifications/n1")));
  });
  test("list queries must be filtered to the recipient", async () => {
    await assertSucceeds(getDocs(query(collection(as("mem1"), "notifications"), where("recipientId", "==", "mem1"))));
    await assertSucceeds(getDocs(query(collection(as("mem1"), "notifications"), where("recipientId", "==", "mem1"), where("read", "==", false))));
    await assertFails(getDocs(collection(as("mem1"), "notifications")));
  });
  test("deactivated recipients lose access", async () => {
    await assertFails(getDoc(doc(as("gone1"), "notifications/n2")));
  });
  test("recipient can mark read and unread, nothing else", async () => {
    await assertSucceeds(updateDoc(doc(as("mem1"), "notifications/n1"), { read: true, readAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as("mem1"), "notifications/n1"), { read: false, readAt: null }));
    await assertFails(updateDoc(doc(as("mem1"), "notifications/n1"), { snippet: "edited" }));
    await assertFails(updateDoc(doc(as("mem2"), "notifications/n1"), { read: true, readAt: serverTimestamp() }));
  });
  test("clients can't create or delete notifications", async () => {
    await assertFails(setDoc(doc(as("mem1"), "notifications/fake"), notif("mem2")));
    await assertFails(deleteDoc(doc(as("mem1"), "notifications/n1")));
  });
});
