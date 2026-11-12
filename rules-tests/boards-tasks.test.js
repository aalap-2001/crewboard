// Run with: npm run test:rules   (from the repo root; starts the Firestore emulator)
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp,
  updateDoc, where, writeBatch,
} from "firebase/firestore";

let env;
const ts = Timestamp.fromDate(new Date("2026-01-01"));
const PREFS = { emailOnAssignment: true, emailOnMention: true, dailyDigest: true };
const user = (uid, role) => ({
  uid, email: `${uid}@crew.test`, displayName: uid, role, active: true, avatarUrl: null,
  notificationPrefs: PREFS, invitedBy: null, lastInviteSentAt: null, claimsUpdatedAt: null, createdAt: null, updatedAt: null,
});
const MEMBERS = ["mgr1", "mem1"];

const boardData = (uid, memberIds = [uid]) => ({
  name: "Launch", description: "", memberIds, labels: [], createdBy: uid,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
});

const taskData = (uid, over = {}) => ({
  boardId: "b1", columnId: "c1", position: 1024, title: "Write tests", description: "", priority: "medium",
  labelIds: [], dueDate: null, assigneeIds: [], mentionedUserIds: [], memberIds: MEMBERS,
  checklist: [], attachments: [], done: false, commentCount: 0,
  createdBy: uid, updatedBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...over,
});

const as = (uid, role) => env.authenticatedContext(uid, { role }).firestore();
const mgr = () => as("mgr1", "manager");
const mem = () => as("mem1", "member");
const outsider = () => as("mem2", "member");

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
    for (const [uid, role] of [["admin1", "admin"], ["mgr1", "manager"], ["mem1", "member"], ["mem2", "member"]]) {
      await setDoc(doc(db, `users/${uid}`), user(uid, role));
    }
    await setDoc(doc(db, "boards/b1"), { name: "Launch", description: "", memberIds: MEMBERS, labels: [], createdBy: "mgr1", createdAt: ts, updatedAt: ts });
    await setDoc(doc(db, "boards/b1/columns/c1"), { name: "To Do", position: 1024, isDone: false, createdAt: ts });
    await setDoc(doc(db, "tasks/t1"), { ...taskData("mgr1"), createdAt: ts, updatedAt: ts });
    await setDoc(doc(db, "tasks/t1/comments/k1"), { authorId: "mem1", body: "hi", mentionedUserIds: [], edited: false, createdAt: ts, updatedAt: ts });
    await setDoc(doc(db, "tasks/t1/activity/a1"), { type: "created", actorId: "mgr1", changes: [], createdAt: ts });
  });
});

describe("boards", () => {
  test("members can read; non-members can't", async () => {
    await assertSucceeds(getDoc(doc(mem(), "boards/b1")));
    await assertFails(getDoc(doc(outsider(), "boards/b1")));
    await assertFails(getDoc(doc(as("admin1", "admin"), "boards/b1"))); // admins too, unless added
  });
  test("board list must be filtered to my boards", async () => {
    await assertSucceeds(getDocs(query(collection(mem(), "boards"), where("memberIds", "array-contains", "mem1"))));
    await assertFails(getDocs(collection(mem(), "boards")));
  });
  test("managers create boards that include themselves; members can't create", async () => {
    await assertSucceeds(setDoc(doc(mgr(), "boards/b2"), boardData("mgr1")));
    await assertFails(setDoc(doc(mgr(), "boards/b3"), boardData("mgr1", ["mem1"])));
    await assertFails(setDoc(doc(mem(), "boards/b4"), boardData("mem1")));
  });
  test("board + default columns can be created in one batch", async () => {
    const db = mgr();
    const b = writeBatch(db);
    b.set(doc(db, "boards/b5"), boardData("mgr1"));
    b.set(doc(db, "boards/b5/columns/x"), { name: "Backlog", position: 1024, isDone: false, createdAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
  test("members may edit labels only; managers can rename and change members", async () => {
    await assertSucceeds(updateDoc(doc(mem(), "boards/b1"), { labels: [{ id: "l1", name: "Bug", color: "red" }], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(mem(), "boards/b1"), { name: "Mine now", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(mgr(), "boards/b1"), { name: "Launch v2", memberIds: ["mgr1", "mem1", "mem2"], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(mgr(), "boards/b1"), { memberIds: [], updatedAt: serverTimestamp() }));
  });
  test("only managers on the board can delete it", async () => {
    await assertFails(deleteDoc(doc(mem(), "boards/b1")));
    await assertSucceeds(deleteDoc(doc(mgr(), "boards/b1")));
  });
});

describe("columns", () => {
  test("members read; only managers write", async () => {
    await assertSucceeds(getDocs(collection(mem(), "boards/b1/columns")));
    await assertFails(getDocs(collection(outsider(), "boards/b1/columns")));
    await assertFails(addDoc(collection(mem(), "boards/b1/columns"), { name: "QA", position: 2048, isDone: false, createdAt: serverTimestamp() }));
    await assertSucceeds(addDoc(collection(mgr(), "boards/b1/columns"), { name: "QA", position: 2048, isDone: false, createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(mem(), "boards/b1/columns/c1"), { position: 1 }));
    await assertSucceeds(updateDoc(doc(mgr(), "boards/b1/columns/c1"), { position: 1, isDone: true }));
  });
});

describe("tasks", () => {
  test("board members read tasks via the board query; outsiders can't", async () => {
    await assertSucceeds(getDocs(query(collection(mem(), "tasks"), where("boardId", "==", "b1"), where("memberIds", "array-contains", "mem1"))));
    await assertFails(getDocs(query(collection(mem(), "tasks"), where("boardId", "==", "b1"))));
    await assertFails(getDoc(doc(outsider(), "tasks/t1")));
  });
  test("members create tasks with the board's members copied", async () => {
    await assertSucceeds(setDoc(doc(mem(), "tasks/t2"), taskData("mem1")));
    await assertFails(setDoc(doc(mem(), "tasks/t3"), taskData("mem1", { memberIds: ["mem1"] })));
    await assertFails(setDoc(doc(outsider(), "tasks/t4"), taskData("mem2")));
    await assertFails(setDoc(doc(mem(), "tasks/t5"), taskData("mem1", { createdBy: "mgr1" })));
  });
  test("assignees must be board members", async () => {
    await assertSucceeds(updateDoc(doc(mem(), "tasks/t1"), { assigneeIds: ["mem1", "mgr1"], updatedBy: "mem1", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(mem(), "tasks/t1"), { assigneeIds: ["mem2"], updatedBy: "mem1", updatedAt: serverTimestamp() }));
  });
  test("updates must be attributed to the editor and can't touch protected fields", async () => {
    await assertSucceeds(updateDoc(doc(mem(), "tasks/t1"), { title: "Renamed", updatedBy: "mem1", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(mem(), "tasks/t1"), { title: "Sneaky", updatedBy: "mgr1", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(mem(), "tasks/t1"), { boardId: "b9", updatedBy: "mem1", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(mem(), "tasks/t1"), { memberIds: ["mem1", "mgr1", "mem2"], updatedBy: "mem1", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(mem(), "tasks/t1"), { commentCount: 99, updatedBy: "mem1", updatedAt: serverTimestamp() }));
  });
  test("validates fields and target column", async () => {
    const up = (patch) => updateDoc(doc(mem(), "tasks/t1"), { ...patch, updatedBy: "mem1", updatedAt: serverTimestamp() });
    await assertFails(up({ priority: "whenever" }));
    await assertFails(up({ dueDate: "next week" }));
    await assertSucceeds(up({ dueDate: "2026-12-01" }));
    await assertFails(up({ columnId: "missing" }));
    await assertFails(up({ title: "" }));
  });
  test("creator or a manager can delete", async () => {
    await assertFails(deleteDoc(doc(mem(), "tasks/t1")));
    await assertSucceeds(deleteDoc(doc(mgr(), "tasks/t1")));
  });
});

describe("My Tasks queries", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "tasks/t1"), { assigneeIds: ["mem1"], mentionedUserIds: ["mgr1"] });
    });
  });
  test("I can list tasks assigned to me or mentioning me across boards", async () => {
    await assertSucceeds(getDocs(query(collection(mem(), "tasks"), where("assigneeIds", "array-contains", "mem1"))));
    await assertSucceeds(getDocs(query(collection(mgr(), "tasks"), where("mentionedUserIds", "array-contains", "mgr1"))));
  });
  test("I can't list someone else's assignments", async () => {
    await assertFails(getDocs(query(collection(outsider(), "tasks"), where("assigneeIds", "array-contains", "mem1"))));
  });
});

describe("comments and activity", () => {
  const comment = (uid) => ({ authorId: uid, body: "Looks good", mentionedUserIds: [], edited: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  test("task members comment as themselves", async () => {
    await assertSucceeds(addDoc(collection(mgr(), "tasks/t1/comments"), comment("mgr1")));
    await assertFails(addDoc(collection(mgr(), "tasks/t1/comments"), comment("mem1")));
    await assertFails(addDoc(collection(outsider(), "tasks/t1/comments"), comment("mem2")));
    await assertFails(getDocs(collection(outsider(), "tasks/t1/comments")));
  });
  test("only the author edits or deletes a comment", async () => {
    const edit = { body: "edited", edited: true, updatedAt: serverTimestamp() };
    await assertSucceeds(updateDoc(doc(mem(), "tasks/t1/comments/k1"), edit));
    await assertFails(updateDoc(doc(mgr(), "tasks/t1/comments/k1"), edit));
    await assertFails(deleteDoc(doc(mgr(), "tasks/t1/comments/k1")));
    await assertSucceeds(deleteDoc(doc(mem(), "tasks/t1/comments/k1")));
  });
  test("activity is readable by task members and never writable by clients", async () => {
    await assertSucceeds(getDocs(collection(mem(), "tasks/t1/activity")));
    await assertFails(getDocs(collection(outsider(), "tasks/t1/activity")));
    await assertFails(setDoc(doc(mgr(), "tasks/t1/activity/fake"), { type: "created", actorId: "mgr1", changes: [], createdAt: serverTimestamp() }));
  });
});
