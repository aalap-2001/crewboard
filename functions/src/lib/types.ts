// Keep in sync with web/src/lib/types.ts
import type { Timestamp, FieldValue } from "firebase-admin/firestore";

export const ROLES = ["admin", "manager", "member"] as const;
export type Role = (typeof ROLES)[number];

export interface NotificationPrefs {
  emailOnAssignment: boolean;
  emailOnMention: boolean;
  dailyDigest: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  emailOnAssignment: true,
  emailOnMention: true,
  dailyDigest: true,
};

type Ts = Timestamp | FieldValue | null;

/** /users/{uid} */
export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  avatarUrl: string | null;
  notificationPrefs: NotificationPrefs;
  invitedBy: string | null;
  lastInviteSentAt: Ts;
  /** Bumped whenever custom claims change so clients refresh their ID token. */
  claimsUpdatedAt: Ts;
  createdAt: Ts;
  updatedAt: Ts;
}

// ---------- Phase 2: boards & tasks ----------
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface BoardLabel { id: string; name: string; color: string }

/** /boards/{boardId} */
export interface BoardDoc {
  name: string;
  description: string;
  memberIds: string[];
  labels: BoardLabel[];
  createdBy: string;
  createdAt: Ts;
  updatedAt: Ts;
}

/** /boards/{boardId}/columns/{columnId} */
export interface ColumnDoc {
  name: string;
  position: number;
  /** Tasks in this column count as done (not overdue, excluded from digests). */
  isDone: boolean;
  createdAt: Ts;
}

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Attachment { id: string; url: string; title: string }

/** /tasks/{taskId} */
export interface TaskDoc {
  boardId: string;
  columnId: string;
  position: number;
  title: string;
  description: string;
  priority: Priority;
  labelIds: string[];
  /** Calendar date "YYYY-MM-DD" (no time zone drift). */
  dueDate: string | null;
  assigneeIds: string[];
  mentionedUserIds: string[];
  /** Copy of the board's memberIds; maintained by onBoardWritten. Used by rules and queries. */
  memberIds: string[];
  checklist: ChecklistItem[];
  attachments: Attachment[];
  done: boolean;
  commentCount: number;
  createdBy: string;
  /** uid of the last editor, or "system" for server-side changes. */
  updatedBy: string;
  createdAt: Ts;
  updatedAt: Ts;
}

/** /tasks/{taskId}/comments/{commentId} */
export interface CommentDoc {
  authorId: string;
  body: string;
  mentionedUserIds: string[];
  edited: boolean;
  createdAt: Ts;
  updatedAt: Ts;
}

export type ActivityField =
  | "title" | "column" | "priority" | "dueDate" | "description"
  | "assignees" | "labels" | "checklist" | "attachments";

export interface ActivityChange {
  field: ActivityField;
  from?: string | null;
  to?: string | null;
  added?: string[];
  removed?: string[];
  action?: "added" | "removed" | "checked" | "unchecked" | "renamed";
  text?: string;
}

/** /tasks/{taskId}/activity/{eventId} — written only by Cloud Functions. */
export interface ActivityDoc {
  type: "created" | "updated" | "commented";
  actorId: string;
  changes: ActivityChange[];
  commentId?: string;
  createdAt: Ts;
}

// ---------- Phase 3: notifications ----------
export type NotificationType = "assigned" | "mentioned";

/** /notifications/{id} — created only by Cloud Functions; recipient may toggle `read`. */
export interface NotificationDoc {
  recipientId: string;
  type: NotificationType;
  /** True when the same action also @mentioned the recipient (assignment wins; one notification). */
  alsoMentioned: boolean;
  actorId: string;
  taskId: string;
  boardId: string;
  taskTitle: string;
  boardName: string;
  source: "task" | "description" | "comment";
  commentId: string | null;
  /** Plain-text excerpt (comment or description), ≤ 280 chars. */
  snippet: string;
  read: boolean;
  readAt: Ts;
  emailStatus: "pending" | "sent" | "skipped" | "failed";
  createdAt: Ts;
}
