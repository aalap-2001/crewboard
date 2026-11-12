import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  limit,
  type FirestoreDataConverter,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  type WithFieldValue,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  DEFAULT_COLUMNS,
  type ActivityDoc,
  type BoardDoc,
  type BoardLabel,
  type ColumnDoc,
  type CommentDoc,
  type NotificationDoc,
  type NotificationPrefs,
  type Priority,
  type TaskDoc,
  type UserDoc,
} from "./types";
import { STEP } from "./position";

type OnError = (err: FirestoreError) => void;

/** Typed converter for docs that store their own id field (users). */
export function converter<T extends object>(): FirestoreDataConverter<T, DocumentData> {
  return {
    toFirestore: (data: WithFieldValue<T>) => data as DocumentData,
    fromFirestore: (snap: QueryDocumentSnapshot) => snap.data({ serverTimestamps: "estimate" }) as T,
  };
}

/** Typed converter that adds the Firestore doc id as `id` on read and strips it on write. */
export function idConverter<T extends { id: string }>(): FirestoreDataConverter<T, DocumentData> {
  return {
    toFirestore: (data: WithFieldValue<T>) => {
      const { id: _id, ...rest } = data as Record<string, unknown>;
      return rest as DocumentData;
    },
    fromFirestore: (snap: QueryDocumentSnapshot) => ({ ...snap.data({ serverTimestamps: "estimate" }), id: snap.id }) as T,
  };
}

// ======================= users =======================
export const usersCol = collection(db, "users").withConverter(converter<UserDoc>());
export const userRef = (uid: string) => doc(usersCol, uid);

export function watchUser(uid: string, onNext: (user: UserDoc | null) => void, onError: OnError): Unsubscribe {
  return onSnapshot(userRef(uid), (s) => onNext(s.exists() ? s.data() : null), onError);
}

export function watchUsers(onNext: (users: UserDoc[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(query(usersCol, orderBy("displayName")), (s) => onNext(s.docs.map((d) => d.data())), onError);
}

export interface ProfilePatch {
  displayName: string;
  avatarUrl: string | null;
  notificationPrefs: NotificationPrefs;
}

/** Self sign-up: creates the signed-in (verified) user's own profile. Rules allow role "manager" only. */
export function createMyProfile(uid: string, email: string, displayName: string) {
  return setDoc(doc(db, "users", uid), {
    uid,
    email: email.toLowerCase(),
    displayName: displayName.trim().slice(0, 80) || email.split("@")[0],
    role: "manager",
    active: true,
    avatarUrl: null,
    notificationPrefs: { emailOnAssignment: true, emailOnMention: true, dailyDigest: true },
    invitedBy: null,
    lastInviteSentAt: null,
    claimsUpdatedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Only these fields are writable by the user (enforced in firestore.rules). */
export function updateMyProfile(uid: string, patch: ProfilePatch) {
  return updateDoc(doc(db, "users", uid), { ...patch, updatedAt: serverTimestamp() });
}

// ======================= boards =======================
const boardsCol = collection(db, "boards").withConverter(idConverter<BoardDoc>());
const boardRef = (id: string) => doc(boardsCol, id);
const columnsCol = (boardId: string) => collection(db, "boards", boardId, "columns").withConverter(idConverter<ColumnDoc>());

export function watchMyBoards(uid: string, onNext: (boards: BoardDoc[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    query(boardsCol, where("memberIds", "array-contains", uid)),
    (s) => onNext(s.docs.map((d) => d.data()).sort((a, b) => a.name.localeCompare(b.name))),
    onError
  );
}

export function watchBoard(boardId: string, onNext: (b: BoardDoc | null) => void, onError: OnError): Unsubscribe {
  return onSnapshot(boardRef(boardId), (s) => onNext(s.exists() ? s.data() : null), onError);
}

export function watchColumns(boardId: string, onNext: (c: ColumnDoc[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(query(columnsCol(boardId), orderBy("position")), (s) => onNext(s.docs.map((d) => d.data())), onError);
}

/** Creates a board with the default columns in one batch. Returns the new board id. */
export async function createBoard(uid: string, input: { name: string; description: string; memberIds: string[] }) {
  const batch = writeBatch(db);
  const ref = doc(collection(db, "boards"));
  batch.set(ref, {
    name: input.name,
    description: input.description,
    memberIds: Array.from(new Set([uid, ...input.memberIds])),
    labels: [],
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  DEFAULT_COLUMNS.forEach((c, i) => {
    batch.set(doc(collection(db, "boards", ref.id, "columns")), {
      name: c.name,
      isDone: c.isDone,
      position: (i + 1) * STEP,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return ref.id;
}

export function updateBoard(
  boardId: string,
  patch: Partial<{ name: string; description: string; memberIds: string[]; labels: BoardLabel[] }>
) {
  return updateDoc(doc(db, "boards", boardId), { ...patch, updatedAt: serverTimestamp() });
}

/**
 * Changes a board's members and, in the same batch, copies them onto every task on the board
 * (clearing assignees/mentions of anyone removed). Replaces the onBoardWritten Cloud Function.
 */
export async function setBoardMembers(uid: string, boardId: string, memberIds: string[]) {
  const tasks = await getDocs(query(collection(db, "tasks"), where("boardId", "==", boardId), where("memberIds", "array-contains", uid)));
  const keep = new Set(memberIds);
  const batch = writeBatch(db);
  batch.update(doc(db, "boards", boardId), { memberIds, updatedAt: serverTimestamp() });
  tasks.docs.slice(0, 450).forEach((t) => {
    const d = t.data();
    batch.update(t.ref, {
      memberIds,
      assigneeIds: (d.assigneeIds ?? []).filter((id: string) => keep.has(id)),
      mentionedUserIds: (d.mentionedUserIds ?? []).filter((id: string) => keep.has(id)),
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/** Deletes a board's tasks, then the board (replaces server-side cleanup in onBoardWritten). */
export async function deleteBoard(uid: string, boardId: string) {
  const tasks = await getDocs(query(collection(db, "tasks"), where("boardId", "==", boardId), where("memberIds", "array-contains", uid)));
  for (let i = 0; i < tasks.docs.length; i += 400) {
    const batch = writeBatch(db);
    tasks.docs.slice(i, i + 400).forEach((t) => batch.delete(t.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "boards", boardId));
}

export function addColumn(boardId: string, name: string, position: number) {
  return addDoc(collection(db, "boards", boardId, "columns"), { name, position, isDone: false, createdAt: serverTimestamp() });
}

export function updateColumn(boardId: string, columnId: string, patch: Partial<{ name: string; position: number; isDone: boolean }>) {
  return updateDoc(doc(db, "boards", boardId, "columns", columnId), patch);
}

export const deleteColumn = (boardId: string, columnId: string) => deleteDoc(doc(db, "boards", boardId, "columns", columnId));

// ======================= tasks =======================
const tasksCol = collection(db, "tasks").withConverter(idConverter<TaskDoc>());

export function watchBoardTasks(boardId: string, uid: string, onNext: (t: TaskDoc[]) => void, onError: OnError): Unsubscribe {
  // memberIds filter is required so the query is provable against the security rules.
  return onSnapshot(
    query(tasksCol, where("boardId", "==", boardId), where("memberIds", "array-contains", uid)),
    (s) => onNext(s.docs.map((d) => d.data())),
    onError
  );
}

/** Tasks where `field` (assigneeIds or mentionedUserIds) contains uid — provable by the rules. */
export function watchTasksFor(
  field: "assigneeIds" | "mentionedUserIds",
  uid: string,
  onNext: (t: TaskDoc[]) => void,
  onError: OnError
): Unsubscribe {
  return onSnapshot(query(tasksCol, where(field, "array-contains", uid)), (s) => onNext(s.docs.map((d) => d.data())), onError);
}

export function watchTask(taskId: string, onNext: (t: TaskDoc | null) => void, onError: OnError): Unsubscribe {
  return onSnapshot(doc(tasksCol, taskId), (s) => onNext(s.exists() ? s.data() : null), onError);
}

export interface NewTask {
  board: BoardDoc;
  columnId: string;
  columnIsDone: boolean;
  position: number;
  title: string;
  priority?: Priority;
}

export async function createTask(uid: string, t: NewTask) {
  const ref = await addDoc(collection(db, "tasks"), {
    boardId: t.board.id,
    columnId: t.columnId,
    position: t.position,
    title: t.title,
    description: "",
    priority: t.priority ?? "medium",
    labelIds: [],
    dueDate: null,
    assigneeIds: [],
    mentionedUserIds: [],
    memberIds: t.board.memberIds,
    checklist: [],
    attachments: [],
    done: t.columnIsDone,
    commentCount: 0,
    createdBy: uid,
    updatedBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Client-editable task fields. */
export type TaskPatch = Partial<
  Pick<
    TaskDoc,
    | "columnId" | "position" | "title" | "description" | "priority" | "labelIds" | "dueDate"
    | "assigneeIds" | "mentionedUserIds" | "checklist" | "attachments" | "done"
  >
>;

export function updateTask(uid: string, taskId: string, patch: TaskPatch) {
  return updateDoc(doc(db, "tasks", taskId), { ...patch, updatedBy: uid, updatedAt: serverTimestamp() });
}

/** Renumbers a column's tasks evenly when fractional positions get too close. */
export async function rebalanceColumn(uid: string, orderedTaskIds: string[]) {
  const batch = writeBatch(db);
  orderedTaskIds.forEach((id, i) =>
    batch.update(doc(db, "tasks", id), { position: (i + 1) * STEP, updatedBy: uid, updatedAt: serverTimestamp() })
  );
  await batch.commit();
}

export const deleteTask = (taskId: string) => deleteDoc(doc(db, "tasks", taskId));

// ======================= comments & activity =======================
const commentsCol = (taskId: string) => collection(db, "tasks", taskId, "comments").withConverter(idConverter<CommentDoc>());
const activityCol = (taskId: string) => collection(db, "tasks", taskId, "activity").withConverter(idConverter<ActivityDoc>());

export function watchComments(taskId: string, onNext: (c: CommentDoc[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(query(commentsCol(taskId), orderBy("createdAt")), (s) => onNext(s.docs.map((d) => d.data())), onError);
}

export function watchActivity(taskId: string, onNext: (a: ActivityDoc[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(query(activityCol(taskId), orderBy("createdAt", "desc")), (s) => onNext(s.docs.map((d) => d.data())), onError);
}

export function addComment(uid: string, taskId: string, body: string, mentionedUserIds: string[] = []) {
  return addDoc(collection(db, "tasks", taskId, "comments"), {
    authorId: uid,
    body,
    mentionedUserIds,
    edited: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function editComment(taskId: string, commentId: string, body: string, mentionedUserIds: string[] = []) {
  return updateDoc(doc(db, "tasks", taskId, "comments", commentId), {
    body,
    mentionedUserIds,
    edited: true,
    updatedAt: serverTimestamp(),
  });
}

export const deleteComment = (taskId: string, commentId: string) => deleteDoc(doc(db, "tasks", taskId, "comments", commentId));

// ======================= notifications =======================
const notificationsCol = collection(db, "notifications").withConverter(idConverter<NotificationDoc>());

/** Latest notifications for the bell (the recipientId filter is required by the rules). */
export function watchNotifications(uid: string, max: number, onNext: (n: NotificationDoc[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    query(notificationsCol, where("recipientId", "==", uid), orderBy("createdAt", "desc"), limit(max)),
    (s) => onNext(s.docs.map((d) => d.data())),
    onError
  );
}

/** Live unread notifications (capped) — used for the badge count and "Mark all read". */
export function watchUnread(uid: string, onNext: (ids: string[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    query(notificationsCol, where("recipientId", "==", uid), where("read", "==", false), limit(100)),
    (s) => onNext(s.docs.map((d) => d.id)),
    onError
  );
}

export function setNotificationRead(id: string, read: boolean) {
  return updateDoc(doc(db, "notifications", id), { read, readAt: read ? serverTimestamp() : null });
}

export async function markAllRead(ids: string[]) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => batch.update(doc(db, "notifications", id), { read: true, readAt: serverTimestamp() }));
    await batch.commit();
  }
}

export const newId = () => doc(collection(db, "_ids")).id;
