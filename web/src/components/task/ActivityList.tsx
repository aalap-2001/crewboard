import { useEffect, useState, type ReactNode } from "react";
import { errorMessage } from "@/lib/api";
import { formatDue } from "@/lib/dates";
import { watchActivity } from "@/lib/firestore";
import { relativeTime } from "@/lib/format";
import { useUserName } from "@/lib/users";
import { PRIORITY_LABELS, type ActivityChange, type ActivityDoc, type Priority } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { useBoard } from "@/components/board/BoardContext";

const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-slate-800 dark:text-slate-200">{children}</strong>;

function useDescribe() {
  const { columnsById, board } = useBoard();
  const name = useUserName();
  const col = (id?: string | null) => (id && columnsById.get(id)?.name) || "a deleted column";
  const label = (id: string) => board.labels.find((l) => l.id === id)?.name ?? "a deleted label";
  const list = (xs: string[]) => xs.join(", ");

  return (c: ActivityChange): ReactNode => {
    switch (c.field) {
      case "title":
        return <>renamed the task to <B>{c.to}</B></>;
      case "column":
        return <>moved it from <B>{col(c.from)}</B> to <B>{col(c.to)}</B></>;
      case "priority":
        return <>set priority to <B>{PRIORITY_LABELS[c.to as Priority] ?? c.to}</B></>;
      case "dueDate":
        return c.to ? <>set the due date to <B>{formatDue(c.to)}</B></> : <>removed the due date</>;
      case "description":
        return <>edited the description</>;
      case "assignees":
        return (
          <>
            {c.added?.length ? <>assigned <B>{list(c.added.map(name))}</B></> : null}
            {c.added?.length && c.removed?.length ? " and " : null}
            {c.removed?.length ? <>unassigned <B>{list(c.removed.map(name))}</B></> : null}
          </>
        );
      case "labels":
        return (
          <>
            {c.added?.length ? <>added label <B>{list(c.added.map(label))}</B></> : null}
            {c.added?.length && c.removed?.length ? " and " : null}
            {c.removed?.length ? <>removed label <B>{list(c.removed.map(label))}</B></> : null}
          </>
        );
      case "checklist":
        if (c.action === "renamed") return <>renamed checklist item <B>{c.from}</B> to <B>{c.text}</B></>;
        return <>{c.action === "added" ? "added" : c.action === "removed" ? "removed" : c.action === "checked" ? "checked off" : "unchecked"} <B>{c.text}</B>{c.action === "added" ? " to the checklist" : ""}</>;
      case "attachments":
        return (
          <>
            {c.added?.length ? <>added link <B>{list(c.added)}</B></> : null}
            {c.added?.length && c.removed?.length ? " and " : null}
            {c.removed?.length ? <>removed link <B>{list(c.removed)}</B></> : null}
          </>
        );
      default:
        return <>updated the task</>;
    }
  };
}

export function ActivityList({ taskId }: { taskId: string }) {
  const { usersById } = useBoard();
  const name = useUserName();
  const describe = useDescribe();
  const [items, setItems] = useState<ActivityDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchActivity(taskId, setItems, (e) => setError(errorMessage(e))), [taskId]);

  if (error) return <p role="alert" className="text-sm text-red-600">Activity couldn't load: {error}</p>;
  if (!items) return <Spinner />;
  if (items.length === 0) return <p className="text-sm text-slate-500">No activity yet.</p>;

  return (
    <ol className="space-y-3">
      {items.map((a) => {
        const actor = usersById.get(a.actorId);
        const lines: ReactNode[] =
          a.type === "created" ? ["created this task"] : a.type === "commented" ? ["commented"] : a.changes.map(describe);
        return (
          <li key={a.id} className="flex gap-3 text-sm text-slate-600 dark:text-slate-400">
            <Avatar name={a.actorId === "system" ? "Crewboard" : actor?.displayName ?? "?"} url={actor?.avatarUrl} seed={a.actorId} size="sm" />
            <div className="min-w-0 flex-1">
              {lines.map((line, i) => (
                <p key={i}>
                  <B>{name(a.actorId)}</B> {line}
                </p>
              ))}
              <p className="text-xs text-slate-400">{relativeTime(a.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
