import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, FieldValue } from "../lib/firebase";
import type { ActivityDoc, CommentDoc, TaskDoc } from "../lib/types";
import { fanOut } from "../notifications/fanout";
import { parseMentions, toSnippet } from "../notifications/mentions";
import { diffTask } from "./diff";

const minus = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));

/**
 * On every task write:
 *  1. append to the activity log from a server-side diff (can't be forged or skipped);
 *  2. notify people newly assigned or newly @mentioned in the description.
 * The event id is the activity doc id and the notification id prefix, so retries are idempotent.
 */
export const onTaskWritten = onDocumentWritten("tasks/{taskId}", async (event) => {
  const { taskId } = event.params;
  const taskRef = db.doc(`tasks/${taskId}`);
  const before = event.data?.before.exists ? (event.data.before.data() as TaskDoc) : null;
  const after = event.data?.after.exists ? (event.data.after.data() as TaskDoc) : null;

  if (!after) {
    // Task deleted: remove comments and activity.
    await db.recursiveDelete(taskRef);
    return;
  }

  const actorId = before ? after.updatedBy : after.createdBy;
  let entry: ActivityDoc | null = null;
  if (!before) {
    entry = { type: "created", actorId, changes: [], createdAt: FieldValue.serverTimestamp() };
  } else {
    const changes = diffTask(before, after);
    if (changes.length) entry = { type: "updated", actorId, changes, createdAt: FieldValue.serverTimestamp() };
  }
  if (entry) await taskRef.collection("activity").doc(event.id).set(entry);

  // ----- notifications -----
  const assigned = minus(after.assigneeIds, before?.assigneeIds ?? []);
  const mentioned = minus(
    parseMentions(after.description, after.memberIds),
    parseMentions(before?.description ?? "", before?.memberIds ?? after.memberIds)
  );
  if (assigned.length || mentioned.length) {
    await fanOut({
      eventId: event.id,
      actorId,
      taskId,
      boardId: after.boardId,
      taskTitle: after.title,
      assigned,
      mentioned,
      source: mentioned.length ? "description" : "task",
      snippet: mentioned.length ? toSnippet(after.description) : "",
    });
  }
});

/**
 * On comment writes: keep commentCount in sync, log "commented" activity, record mentions on
 * the task (for My Tasks), and notify people mentioned — including ones added in an edit.
 */
export const onCommentWritten = onDocumentWritten("tasks/{taskId}/comments/{commentId}", async (event) => {
  const { taskId, commentId } = event.params;
  const taskRef = db.doc(`tasks/${taskId}`);
  const before = event.data?.before.exists ? (event.data.before.data() as CommentDoc) : null;
  const after = event.data?.after.exists ? (event.data.after.data() as CommentDoc) : null;

  if (!after) {
    try {
      await taskRef.update({ commentCount: FieldValue.increment(-1) });
    } catch (err: unknown) {
      if ((err as { code?: number }).code !== 5) throw err; // 5 = task already deleted
    }
    return;
  }

  const taskSnap = await taskRef.get();
  if (!taskSnap.exists) return;
  const task = taskSnap.data() as TaskDoc;

  const nowMentioned = parseMentions(after.body, task.memberIds);
  const newlyMentioned = minus(nowMentioned, before ? parseMentions(before.body, task.memberIds) : []);

  const taskPatch: Record<string, unknown> = {};
  if (!before) taskPatch.commentCount = FieldValue.increment(1);
  if (newlyMentioned.length) taskPatch.mentionedUserIds = FieldValue.arrayUnion(...newlyMentioned);
  if (Object.keys(taskPatch).length) await taskRef.update(taskPatch);

  if (!before) {
    const entry: ActivityDoc = { type: "commented", actorId: after.authorId, changes: [], commentId, createdAt: FieldValue.serverTimestamp() };
    await taskRef.collection("activity").doc(event.id).set(entry);
  }

  if (newlyMentioned.length) {
    await fanOut({
      eventId: event.id,
      actorId: after.authorId,
      taskId,
      boardId: task.boardId,
      taskTitle: task.title,
      assigned: [],
      mentioned: newlyMentioned,
      source: "comment",
      commentId,
      snippet: toSnippet(after.body),
    });
  }
});
