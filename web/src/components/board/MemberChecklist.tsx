import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { UserDoc } from "@/lib/types";
import { Avatar } from "@/components/Avatar";

/** Searchable checkbox list of people. `locked` ids are always checked. */
export function MemberChecklist({
  people,
  selected,
  onChange,
  locked = [],
  label,
}: {
  people: UserDoc[];
  selected: string[];
  onChange: (ids: string[]) => void;
  locked?: string[];
  label: string;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return people.filter((p) => !s || p.displayName.toLowerCase().includes(s) || p.email.includes(s));
  }, [people, q]);

  const toggle = (uid: string) =>
    onChange(selected.includes(uid) ? selected.filter((x) => x !== uid) : [...selected, uid]);

  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</legend>
      <div className="rounded-lg ring-1 ring-slate-300 dark:ring-slate-700">
        <div className="relative border-b border-slate-200 dark:border-slate-700">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            aria-label="Search people"
            placeholder="Search people"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-t-lg border-0 bg-transparent py-2 pl-9 pr-3 text-sm focus:ring-0"
          />
        </div>
        <ul className="max-h-56 overflow-y-auto p-1">
          {list.map((p) => {
            const isLocked = locked.includes(p.uid);
            return (
              <li key={p.uid}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={isLocked || selected.includes(p.uid)}
                    disabled={isLocked}
                    onChange={() => toggle(p.uid)}
                  />
                  <Avatar name={p.displayName} url={p.avatarUrl} seed={p.uid} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.displayName}{isLocked && " (you)"}</span>
                    <span className="block truncate text-xs text-slate-500">{p.email}</span>
                  </span>
                </label>
              </li>
            );
          })}
          {list.length === 0 && <li className="px-2 py-3 text-sm text-slate-500">No one matches “{q}”.</li>}
        </ul>
      </div>
    </fieldset>
  );
}
