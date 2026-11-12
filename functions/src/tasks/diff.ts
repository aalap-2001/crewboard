import type { ActivityChange, TaskDoc } from "../lib/types";

function setDiff(before: string[] = [], after: string[] = []) {
  const b = new Set(before);
  const a = new Set(after);
  return { added: after.filter((x) => !b.has(x)), removed: before.filter((x) => !a.has(x)) };
}

/**
 * Human-meaningful differences between two versions of a task.
 * Ignores bookkeeping fields (position, updatedAt/By, memberIds, commentCount, done, mentions).
 */
export function diffTask(b: TaskDoc, a: TaskDoc): ActivityChange[] {
  const out: ActivityChange[] = [];
  if (b.title !== a.title) out.push({ field: "title", from: b.title, to: a.title });
  if (b.columnId !== a.columnId) out.push({ field: "column", from: b.columnId, to: a.columnId });
  if (b.priority !== a.priority) out.push({ field: "priority", from: b.priority, to: a.priority });
  if ((b.dueDate ?? null) !== (a.dueDate ?? null)) out.push({ field: "dueDate", from: b.dueDate ?? null, to: a.dueDate ?? null });
  if ((b.description ?? "") !== (a.description ?? "")) out.push({ field: "description" });

  const assignees = setDiff(b.assigneeIds, a.assigneeIds);
  if (assignees.added.length || assignees.removed.length) out.push({ field: "assignees", ...assignees });

  const labels = setDiff(b.labelIds, a.labelIds);
  if (labels.added.length || labels.removed.length) out.push({ field: "labels", ...labels });

  const bItems = new Map((b.checklist ?? []).map((i) => [i.id, i]));
  const aItems = new Map((a.checklist ?? []).map((i) => [i.id, i]));
  for (const [id, item] of aItems) {
    const prev = bItems.get(id);
    if (!prev) out.push({ field: "checklist", action: "added", text: item.text });
    else {
      if (prev.text !== item.text) out.push({ field: "checklist", action: "renamed", from: prev.text, text: item.text });
      if (prev.done !== item.done) out.push({ field: "checklist", action: item.done ? "checked" : "unchecked", text: item.text });
    }
  }
  for (const [id, item] of bItems) if (!aItems.has(id)) out.push({ field: "checklist", action: "removed", text: item.text });

  const bAtt = new Map((b.attachments ?? []).map((x) => [x.id, x]));
  const aAtt = new Map((a.attachments ?? []).map((x) => [x.id, x]));
  const attAdded = [...aAtt.values()].filter((x) => !bAtt.has(x.id)).map((x) => x.title || x.url);
  const attRemoved = [...bAtt.values()].filter((x) => !aAtt.has(x.id)).map((x) => x.title || x.url);
  if (attAdded.length || attRemoved.length) out.push({ field: "attachments", added: attAdded, removed: attRemoved });

  return out;
}
