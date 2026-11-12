import clsx from "clsx";
import { AlertCircle, CalendarDays, ChevronDown, ChevronUp, ChevronsUp, Equal } from "lucide-react";
import { dueState, formatDue } from "@/lib/dates";
import type { BoardLabel, LabelColor, Priority } from "@/lib/types";
import { PRIORITY_LABELS } from "@/lib/types";

// Full class strings so Tailwind keeps them.
export const LABEL_CLASSES: Record<LabelColor, { chip: string; dot: string }> = {
  slate: { chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200", dot: "bg-slate-500" },
  red: { chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", dot: "bg-red-500" },
  amber: { chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", dot: "bg-amber-500" },
  emerald: { chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200", dot: "bg-emerald-500" },
  sky: { chip: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200", dot: "bg-sky-500" },
  indigo: { chip: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200", dot: "bg-indigo-500" },
  violet: { chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200", dot: "bg-violet-500" },
  pink: { chip: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200", dot: "bg-pink-500" },
};

export function LabelChip({ label, small }: { label: BoardLabel; small?: boolean }) {
  const c = LABEL_CLASSES[label.color] ?? LABEL_CLASSES.slate;
  return (
    <span className={clsx("inline-flex max-w-full items-center gap-1.5 truncate rounded-md font-semibold", c.chip, small ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs")}>
      <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", c.dot)} aria-hidden />
      <span className="truncate">{label.name}</span>
    </span>
  );
}

const PRIORITY_STYLE: Record<Priority, { icon: typeof Equal; cls: string }> = {
  low: { icon: ChevronDown, cls: "text-slate-500 dark:text-slate-400" },
  medium: { icon: Equal, cls: "text-sky-600 dark:text-sky-400" },
  high: { icon: ChevronUp, cls: "text-amber-600 dark:text-amber-400" },
  urgent: { icon: ChevronsUp, cls: "text-red-600 dark:text-red-400" },
};

export function PriorityIcon({ priority, withLabel }: { priority: Priority; withLabel?: boolean }) {
  const { icon: Icon, cls } = PRIORITY_STYLE[priority];
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs font-semibold", cls)} title={`${PRIORITY_LABELS[priority]} priority`}>
      <Icon className="h-4 w-4" aria-hidden />
      {withLabel ? PRIORITY_LABELS[priority] : <span className="sr-only">{PRIORITY_LABELS[priority]} priority</span>}
    </span>
  );
}

export function DueChip({ dueDate, done }: { dueDate: string | null; done: boolean }) {
  if (!dueDate) return <span className="text-xs text-slate-400">—</span>;
  const state = dueState(dueDate, done);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-semibold",
        state === "overdue" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        state === "today" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
        state === "soon" && "text-amber-700 dark:text-amber-300",
        (state === "later" || state === "none") && "text-slate-600 dark:text-slate-400"
      )}
    >
      {state === "overdue" ? <AlertCircle className="h-3.5 w-3.5" aria-hidden /> : <CalendarDays className="h-3.5 w-3.5" aria-hidden />}
      {state === "overdue" ? "Overdue · " : state === "today" ? "Today · " : ""}
      {formatDue(dueDate)}
    </span>
  );
}
