/** Today's calendar date in the viewer's time zone, as YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDue(iso: string): string {
  const date = parse(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export type DueState = "overdue" | "today" | "soon" | "later" | "none";

export function dueState(iso: string | null, done: boolean): DueState {
  if (!iso || done) return "none";
  const today = todayISO();
  if (iso < today) return "overdue";
  if (iso === today) return "today";
  const diffDays = (parse(iso).getTime() - parse(today).getTime()) / 86_400_000;
  return diffDays <= 2 ? "soon" : "later";
}

export function addDaysISO(iso: string, days: number): string {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

export type DueGroup = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";

export const DUE_GROUP_LABELS: Record<DueGroup, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "Next 7 days",
  later: "Later",
  none: "No due date",
};

export function dueGroup(iso: string | null): DueGroup {
  if (!iso) return "none";
  const today = todayISO();
  if (iso < today) return "overdue";
  if (iso === today) return "today";
  if (iso === addDaysISO(today, 1)) return "tomorrow";
  if (iso <= addDaysISO(today, 7)) return "week";
  return "later";
}
