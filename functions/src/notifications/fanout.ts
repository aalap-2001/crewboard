import { logger } from "firebase-functions/v2";
import { db, FieldValue } from "../lib/firebase";
import type { BoardDoc, NotificationDoc, UserDoc } from "../lib/types";

export interface FanoutInput {
  /** Trigger event id; makes notification ids retry-safe. */
  eventId: string;
  actorId: string;
  taskId: string;
  boardId: string;
  taskTitle: string;
  assigned: string[];
  mentioned: string[];
  source: NotificationDoc["source"];
  commentId?: string | null;
  snippet: string;
}

/**
 * Creates one in-app notification per recipient:
 *  - never for the person who acted,
 *  - assigned + mentioned in the same action → a single "assigned" notification with alsoMentioned,
 *  - only for active users.
 * Emails are sent by onNotificationCreated, which applies each person's preferences.
 */
export async function fanOut(input: FanoutInput): Promise<number> {
  const assigned = new Set(input.assigned.filter((id) => id !== input.actorId));
  const mentioned = new Set(input.mentioned.filter((id) => id !== input.actorId));
  const recipients = [...new Set([...assigned, ...mentioned])];
  if (!recipients.length || input.actorId === "system") return 0;

  const [boardSnap, ...userSnaps] = await db.getAll(
    db.doc(`boards/${input.boardId}`),
    ...recipients.map((id) => db.doc(`users/${id}`))
  );
  const board = boardSnap.data() as BoardDoc | undefined;
  if (!board) return 0;

  const batch = db.batch();
  let count = 0;
  for (const snap of userSnaps) {
    const u = snap.data() as UserDoc | undefined;
    if (!u?.active || !board.memberIds.includes(snap.id)) continue;
    const isAssigned = assigned.has(snap.id);
    const doc: NotificationDoc = {
      recipientId: snap.id,
      type: isAssigned ? "assigned" : "mentioned",
      alsoMentioned: isAssigned && mentioned.has(snap.id),
      actorId: input.actorId,
      taskId: input.taskId,
      boardId: input.boardId,
      taskTitle: input.taskTitle,
      boardName: board.name,
      source: input.source,
      commentId: input.commentId ?? null,
      snippet: input.snippet,
      read: false,
      readAt: null,
      emailStatus: "pending",
      createdAt: FieldValue.serverTimestamp(),
    };
    batch.set(db.doc(`notifications/${input.eventId}_${snap.id}`), doc);
    count++;
  }
  if (count) await batch.commit();
  logger.info("Notifications created", { taskId: input.taskId, count, source: input.source });
  return count;
}
