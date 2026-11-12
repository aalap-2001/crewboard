import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { db, FieldValue } from "../lib/firebase";
import type { BoardDoc, ColumnDoc, TaskDoc } from "../lib/types";

const sameMembers = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * - Board deleted → delete its columns and all of its tasks (with their comments/activity).
 * - Members changed → copy memberIds onto every task, and unassign/unmention removed members.
 */
export const onBoardWritten = onDocumentWritten("boards/{boardId}", async (event) => {
  const { boardId } = event.params;
  const before = event.data?.before.exists ? (event.data.before.data() as BoardDoc) : null;
  const after = event.data?.after.exists ? (event.data.after.data() as BoardDoc) : null;

  if (!after) {
    await db.recursiveDelete(db.collection(`boards/${boardId}/columns`));
    const tasks = await db.collection("tasks").where("boardId", "==", boardId).get();
    for (const t of tasks.docs) await db.recursiveDelete(t.ref);
    logger.info("Board deleted; cleaned up", { boardId, tasks: tasks.size });
    return;
  }
  if (!before || sameMembers(before.memberIds, after.memberIds)) return;

  const members = new Set(after.memberIds);
  const tasks = await db.collection("tasks").where("boardId", "==", boardId).get();
  const writer = db.bulkWriter();
  for (const t of tasks.docs) {
    const task = t.data() as TaskDoc;
    const assigneeIds = task.assigneeIds.filter((id) => members.has(id));
    const mentionedUserIds = task.mentionedUserIds.filter((id) => members.has(id));
    const patch: Record<string, unknown> = { memberIds: after.memberIds, mentionedUserIds };
    if (assigneeIds.length !== task.assigneeIds.length) {
      Object.assign(patch, { assigneeIds, updatedBy: "system", updatedAt: FieldValue.serverTimestamp() });
    }
    void writer.update(t.ref, patch);
  }
  await writer.close();
  logger.info("Board members synced to tasks", { boardId, tasks: tasks.size });
});

/** When a column's "done" flag flips, update the denormalized `done` flag on its tasks. */
export const onColumnUpdated = onDocumentUpdated("boards/{boardId}/columns/{columnId}", async (event) => {
  const before = event.data?.before.data() as ColumnDoc | undefined;
  const after = event.data?.after.data() as ColumnDoc | undefined;
  if (!before || !after || before.isDone === after.isDone) return;
  const { boardId, columnId } = event.params;
  const tasks = await db.collection("tasks").where("boardId", "==", boardId).where("columnId", "==", columnId).get();
  const writer = db.bulkWriter();
  for (const t of tasks.docs) void writer.update(t.ref, { done: after.isDone });
  await writer.close();
});
