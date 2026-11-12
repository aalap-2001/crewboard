import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { AlertTriangle, AtSign, CircleCheckBig, UserCheck } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { watchColumns, watchMyBoards, watchTasksFor } from "@/lib/firestore";
import { errorMessage } from "@/lib/api";
import { DUE_GROUP_LABELS, dueGroup, type DueGroup } from "@/lib/dates";
import { useUsers } from "@/lib/users";
import type { BoardDoc, ColumnDoc, TaskDoc, UserDoc } from "@/lib/types";
import { AvatarStack } from "@/components/Avatar";
import { DueChip, PriorityIcon } from "@/components/chips";
import { taskUrl } from "@/components/board/TaskCard";
import { Badge, Spinner, StateMessage, Switch } from "@/components/ui";

type Scope = "all" | "assigned" | "mentioned";
const ORDER: DueGroup[] = ["overdue", "today", "tomorrow", "week", "later", "none"];
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

/** Live column names for the boards that appear in My Tasks. */
function useColumnNames(boardIds: string[]) {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const key = [...boardIds].sort().join(",");
  useEffect(() => {
    const unsubs = key
      ? key.split(",").map((id) =>
          watchColumns(id, (cols: ColumnDoc[]) => setNames((m) => { const n = new Map(m); cols.forEach((c) => n.set(c.id, c.name)); return n; }), () => undefined)
        )
      : [];
    return () => unsubs.forEach((u) => u());
  }, [key]);
  return names;
}

export function MyTasksPage() {
  const { user } = useSignedIn();
  const { byId } = useUsers();
  const [assigned, setAssigned] = useState<TaskDoc[] | null>(null);
  const [mentioned, setMentioned] = useState<TaskDoc[] | null>(null);
  const [boards, setBoards] = useState<BoardDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    const onErr = (e: { message: string }) => setError(errorMessage(e));
    const unsubs = [
      watchTasksFor("assigneeIds", user.uid, setAssigned, onErr),
      watchTasksFor("mentionedUserIds", user.uid, setMentioned, onErr),
      watchMyBoards(user.uid, setBoards, onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user.uid]);

  const boardName = useMemo(() => new Map(boards.map((b) => [b.id, b.name])), [boards]);

  const all = useMemo(() => {
    const m = new Map<string, { task: TaskDoc; isAssigned: boolean; isMentioned: boolean }>();
    for (const t of assigned ?? []) m.set(t.id, { task: t, isAssigned: true, isMentioned: false });
    for (const t of mentioned ?? []) {
      const cur = m.get(t.id);
      if (cur) cur.isMentioned = true;
      else m.set(t.id, { task: t, isAssigned: false, isMentioned: true });
    }
    // Only boards I can still open.
    return [...m.values()].filter((x) => boardName.has(x.task.boardId));
  }, [assigned, mentioned, boardName]);

  const columnNames = useColumnNames([...new Set(all.map((x) => x.task.boardId))]);

  const visible = all.filter((x) => (scope === "all" || (scope === "assigned" ? x.isAssigned : x.isMentioned)) && (showDone || !x.task.done));
  const doneCount = all.filter((x) => x.task.done && (scope === "all" || (scope === "assigned" ? x.isAssigned : x.isMentioned))).length;

  const groups = useMemo(() => {
    const g = new Map<DueGroup, typeof visible>();
    for (const x of visible) {
      const key = dueGroup(x.task.dueDate);
      g.set(key, [...(g.get(key) ?? []), x]);
    }
    for (const list of g.values()) {
      list.sort((a, b) => (a.task.dueDate ?? "").localeCompare(b.task.dueDate ?? "") || PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority]);
    }
    return ORDER.filter((k) => g.has(k)).map((k) => [k, g.get(k)!] as const);
  }, [visible]);

  const loading = !assigned || !mentioned;
  const scopes: [Scope, string, number][] = [
    ["all", "All", all.filter((x) => showDone || !x.task.done).length],
    ["assigned", "Assigned to me", all.filter((x) => x.isAssigned && (showDone || !x.task.done)).length],
    ["mentioned", "Mentioned me", all.filter((x) => x.isMentioned && (showDone || !x.task.done)).length],
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">My Tasks</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Everything assigned to you or mentioning you, across your boards.</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {scopes.map(([v, label, n]) => (
            <button
              key={v}
              aria-pressed={scope === v}
              onClick={() => setScope(v)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-semibold",
                scope === v ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              {label} <span className="ml-1 text-xs text-slate-400">{loading ? "" : n}</span>
            </button>
          ))}
        </div>
        <div className="w-56">
          <Switch label={`Show done tasks${doneCount ? ` (${doneCount})` : ""}`} checked={showDone} onChange={setShowDone} />
        </div>
      </div>

      <div className="mt-4">
        {error ? (
          <StateMessage icon={AlertTriangle} tone="error" title="My Tasks couldn't load" body={error} />
        ) : loading ? (
          <div className="grid place-items-center py-16"><Spinner /></div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <StateMessage
              icon={CircleCheckBig}
              title={all.length ? "Nothing open here" : "Nothing on your plate"}
              body={all.length ? "You've finished everything in this view." : "Tasks you're assigned to or @mentioned in will show up here."}
              action={<Link to="/" className="text-sm font-semibold text-brand-600 dark:text-brand-400">Go to your boards</Link>}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([key, list]) => (
              <section key={key} aria-labelledby={`g-${key}`}>
                <h2 id={`g-${key}`} className={clsx("mb-2 flex items-center gap-2 font-sans text-sm font-semibold", key === "overdue" && "text-red-700 dark:text-red-400")}>
                  {DUE_GROUP_LABELS[key]} <span className="rounded-full bg-slate-200 px-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">{list.length}</span>
                </h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
                  {list.map(({ task: t, isAssigned, isMentioned }) => {
                    const people = t.assigneeIds.map((id) => byId.get(id)).filter((u): u is UserDoc => !!u);
                    return (
                      <li key={t.id} className={key === "overdue" && !t.done ? "border-l-4 border-l-red-500" : "border-l-4 border-l-transparent"}>
                        <Link to={`${taskUrl(t.boardId, t.id)}?from=my-tasks`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <PriorityIcon priority={t.priority} />
                          <span className="min-w-0 flex-1 basis-56">
                            <span className={clsx("block truncate text-sm font-semibold", t.done ? "text-slate-500 line-through" : "text-slate-900 dark:text-slate-100")}>{t.title}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {boardName.get(t.boardId)}{columnNames.get(t.columnId) ? ` · ${columnNames.get(t.columnId)}` : ""}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            {isAssigned && <Badge tone="brand"><UserCheck className="mr-1 h-3 w-3" aria-hidden />Assigned</Badge>}
                            {isMentioned && <Badge><AtSign className="mr-1 h-3 w-3" aria-hidden />Mentioned</Badge>}
                          </span>
                          <DueChip dueDate={t.dueDate} done={t.done} />
                          {people.length > 0 && <AvatarStack people={people} />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
