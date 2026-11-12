// Keep in sync with functions/src/lib/types.ts
import type { Timestamp } from "firebase/firestore";

export const ROLES = ["admin", "manager", "member"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  member: "Member",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Manages people, roles and every board",
  manager: "Creates boards and manages their members",
  member: "Works on the boards they're added to",
};

export interface NotificationPrefs {
  emailOnAssignment: boolean;
  emailOnMention: boolean;
  dailyDigest: boolean;
}

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
  lastInviteSentAt: Timestamp | null;
  claimsUpdatedAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// ---------- Phase 2: boards & tasks (keep in sync with functions/src/lib/types.ts) ----------
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

export const LABEL_COLORS = ["slate", "red", "amber", "emerald", "sky", "indigo", "violet", "pink"] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export interface BoardLabel { id: string; name: string; color: LabelColor }

/** Docs read through idConverter carry their Firestore id. */
interface WithId { id: string }

export interface BoardDoc extends WithId {
  name: string;
  description: string;
  memberIds: string[];
  labels: BoardLabel[];
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ColumnDoc extends WithId {
  name: string;
  position: number;
  isDone: boolean;
  createdAt: Timestamp | null;
}

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Attachment { id: string; url: string; title: string }

export interface TaskDoc extends WithId {
  boardId: string;
  columnId: string;
  position: number;
  title: string;
  description: string;
  priority: Priority;
  labelIds: string[];
  dueDate: string | null;
  assigneeIds: string[];
  mentionedUserIds: string[];
  memberIds: string[];
  checklist: ChecklistItem[];
  attachments: Attachment[];
  done: boolean;
  commentCount: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface CommentDoc extends WithId {
  authorId: string;
  body: string;
  mentionedUserIds: string[];
  edited: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
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

export interface ActivityDoc extends WithId {
  type: "created" | "updated" | "commented";
  actorId: string;
  changes: ActivityChange[];
  commentId?: string;
  createdAt: Timestamp | null;
}

export const DEFAULT_COLUMNS: { name: string; isDone: boolean }[] = [
  { name: "Backlog", isDone: false },
  { name: "To Do", isDone: false },
  { name: "In Progress", isDone: false },
  { name: "In Review", isDone: false },
  { name: "Done", isDone: true },
];

// ---------- Phase 3: notifications ----------
export type NotificationType = "assigned" | "mentioned";

export interface NotificationDoc extends WithId {
  recipientId: string;
  type: NotificationType;
  alsoMentioned: boolean;
  actorId: string;
  taskId: string;
  boardId: string;
  taskTitle: string;
  boardName: string;
  source: "task" | "description" | "comment";
  commentId: string | null;
  snippet: string;
  read: boolean;
  readAt: Timestamp | null;
  emailStatus: "pending" | "sent" | "skipped" | "failed";
  createdAt: Timestamp | null;
}
