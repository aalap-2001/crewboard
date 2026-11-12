import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListFilter, Search, X } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { addDaysISO, todayISO } from "@/lib/dates";
import { MENTION_RE } from "@/lib/mentions";
import { PRIORITIES, PRIORITY_LABELS, type Priority, type TaskDoc, type UserDoc } from "@/lib/types";
import { AvatarStack } from "@/components/Avatar";
import { DueChip, LabelChip, PriorityIcon } from "@/components/chips";
import { Button, SelectField, StateMessage } from "@/components/ui";
import { useBoard } from "./BoardContext";
import { taskUrl } from "./TaskCard";

type DueFilter = "any" | "overdue" | "today" | "week" | "none";
type SortKey = "status" | "due" | "priority" | "updated";

interface Filters {
  q: string;
  assignee: string; // "any" | "me" | "none" | uid
  label: string; // "any" | labelId
  priority: Priority | "any";
  due: DueFilter;
  status: string; // "any" | columnId
}

const EMPTY: Filters = { q: "", assignee: "any", label: "any", priority: "any", due: "any", status: "any" };
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function searchable(t: TaskDoc) {
  return `${t.title}\n${t.description.replace(MENTION_RE, "@$1")}`.toLowerCase();
}

export function ListView() {
  const { board, columns, columnsById, tasks, members, usersById } = useBoard();
  const { user } = useSignedIn();
  const [f, setF] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<SortKey>("status");
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const active = (Object.keys(EMPTY) as (keyof Filters)[]).filter((k) => f[k] !== EMPTY[k]).length;

  const rows = useMemo(() => {
    const today = todayISO();
    const weekEnd = addDaysISO(today, 7);
    const q = f.q.trim().toLowerCase();
    const colIndex = new Map(columns.map((c, i) => [c.id, i]));

    const filtered = tasks.filter((t) => {
      if (q && !searchable(t).includes(q)) return false;
      if (f.assignee === "me" && !t.assigneeIds.includes(user.uid)) return false;
      if (f.assignee === "none" && t.assigneeIds.length) return false;
      if (!["any", "me", "none"].includes(f.assignee) && !t.assigneeIds.includes(f.assignee)) return false;
      if (f.label !== "any" && !t.labelIds.includes(f.label)) return false;
      if (f.priority !== "any" && t.priority !== f.priority) return false;
      if (f.status !== "any" && t.columnId !== f.status) return false;
      if (f.due === "overdue" && !(t.dueDate && t.dueDate < today && !t.done)) return false;
      if (f.due === "today" && t.dueDate !== today) return false;
      if (f.due === "week" && !(t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd)) return false;
      if (f.due === "none" && t.dueDate) return false;
      return true;
    });

    const byStatus = (a: TaskDoc, b: TaskDoc) =>
      (colIndex.get(a.columnId) ?? 99) - (colIndex.get(b.columnId) ?? 99) || a.position - b.position;
    const cmp: Record<SortKey, (a: TaskDoc, b: TaskDoc) => number> = {
      status: byStatus,
      due: (a, b) => (a.dueDate ?? "9999") .localeCompare(b.dueDate ?? "9999") || byStatus(a, b),
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byStatus(a, b),
      updated: (a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0),
    };
    return filtered.sort(cmp[sort]);
  }, [tasks, columns, f, sort, user.uid]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
        <StateMessage icon={ListFilter} title="No tasks on this board yet" body="Switch to Board view and use “Add task” in any column." />
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,2fr)_repeat(5,minmax(0,1fr))] dark:bg-slate-900 dark:ring-slate-800">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <label htmlFor="list-q" className="sr-only">Search tasks</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id="list-q"
            type="search"
            placeholder="Search titles and descriptions"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            className="block w-full rounded-lg border-0 bg-white py-2.5 pl-9 pr-3 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-500 dark:bg-slate-900 dark:ring-slate-700"
          />
        </div>
        <SelectField label="Assignee" hideLabel value={f.assignee} onChange={(e) => set("assignee", e.target.value)}>
          <option value="any">Any assignee</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {members.map((m) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
        </SelectField>
        <SelectField label="Label" hideLabel value={f.label} onChange={(e) => set("label", e.target.value)}>
          <option value="any">Any label</option>
          {board.labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </SelectField>
        <SelectField label="Priority" hideLabel value={f.priority} onChange={(e) => set("priority", e.target.value as Priority | "any")}>
          <option value="any">Any priority</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </SelectField>
        <SelectField label="Due date" hideLabel value={f.due} onChange={(e) => set("due", e.target.value as DueFilter)}>
          <option value="any">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due in the next 7 days</option>
          <option value="none">No due date</option>
        </SelectField>
        <SelectField label="Status" hideLabel value={f.status} onChange={(e) => set("status", e.target.value)}>
          <option value="any">Any status</option>
          {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
          {rows.length} of {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          {active > 0 && (
            <button onClick={() => setF(EMPTY)} className="ml-3 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline dark:text-brand-300">
              <X className="h-3.5 w-3.5" aria-hidden /> Clear {active} {active === 1 ? "filter" : "filters"}
            </button>
          )}
        </p>
        <SelectField label="Sort by" hideLabel value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="status">Sort: status</option>
          <option value="due">Sort: due date</option>
          <option value="priority">Sort: priority</option>
          <option value="updated">Sort: recently updated</option>
        </SelectField>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <StateMessage icon={ListFilter} title="No tasks match these filters" action={<Button variant="secondary" onClick={() => setF(EMPTY)}>Clear filters</Button>} />
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div className="hidden grid-cols-[minmax(0,1fr)_9rem_6.5rem_8.5rem_6rem] gap-4 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 md:grid dark:border-slate-800" aria-hidden>
            <span>Task</span><span>Status</span><span>Priority</span><span>Due</span><span>Assignees</span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((t) => {
              const labels = t.labelIds.map((id) => board.labels.find((l) => l.id === id)).filter((l) => !!l);
              const people = t.assigneeIds.map((id) => usersById.get(id)).filter((u): u is UserDoc => !!u);
              const overdue = !!t.dueDate && t.dueDate < todayISO() && !t.done;
              return (
                <li key={t.id} className={overdue ? "border-l-4 border-l-red-500" : "border-l-4 border-l-transparent"}>
                  <Link
                    to={`${taskUrl(board.id, t.id)}?view=list`}
                    className="grid gap-2 px-4 py-3 hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_9rem_6.5rem_8.5rem_6rem] md:items-center md:gap-4 dark:hover:bg-slate-800/50"
                  >
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-semibold ${t.done ? "text-slate-500 line-through" : "text-slate-900 dark:text-slate-100"}`}>{t.title}</span>
                      {labels.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{labels.map((l) => <LabelChip key={l.id} label={l} small />)}</span>}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 md:contents">
                      <span className="truncate text-sm text-slate-600 dark:text-slate-400">{columnsById.get(t.columnId)?.name}</span>
                      <PriorityIcon priority={t.priority} withLabel />
                      <span><DueChip dueDate={t.dueDate} done={t.done} /></span>
                      <span>{people.length ? <AvatarStack people={people} /> : <span className="text-xs text-slate-400">Unassigned</span>}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
