import { useId, useMemo, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import { Users } from "lucide-react";
import { ALL_ID, mentionToken } from "@/lib/mentions";
import type { UserDoc } from "@/lib/types";
import { Avatar } from "./Avatar";

interface Option { id: string; name: string; hint: string; user?: UserDoc }

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (v: string) => void;
  /** People who can be @mentioned (board members). */
  people: UserDoc[];
  allowAll?: boolean;
};

const TRIGGER = /(^|[\s(])@([^\s@[\]()]{0,30})$/;

/** Textarea with an "@" autocomplete for board members and @all (ARIA combobox pattern). */
export function MentionTextarea({ value, onChange, people, allowAll = true, onKeyDown, className, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);

  const options = useMemo<Option[]>(() => {
    if (!query) return [];
    const q = query.text.toLowerCase();
    const out: Option[] = [];
    if (allowAll && ("all".startsWith(q) || "everyone".startsWith(q))) {
      out.push({ id: ALL_ID, name: "all", hint: `Notify all ${people.length} people on this board` });
    }
    for (const p of people) {
      if (!p.active) continue;
      const name = p.displayName.toLowerCase();
      if (!q || name.split(/\s+/).some((w) => w.startsWith(q)) || name.startsWith(q) || p.email.startsWith(q)) {
        out.push({ id: p.uid, name: p.displayName, hint: p.email, user: p });
      }
      if (out.length >= 8) break;
    }
    return out;
  }, [query, people, allowAll]);

  const open = !!query && options.length > 0;

  function detect(text: string, caret: number) {
    const m = TRIGGER.exec(text.slice(0, caret));
    if (m) {
      setQuery({ start: caret - m[2].length - 1, text: m[2] });
      setActive(0);
    } else setQuery(null);
  }

  function pick(opt: Option) {
    const el = ref.current;
    if (!el || !query) return;
    const caret = el.selectionStart;
    const token = `${mentionToken(opt.id, opt.name)} `;
    const next = value.slice(0, query.start) + token + value.slice(caret);
    onChange(next);
    setQuery(null);
    const pos = query.start + token.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % options.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(options[active]); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setQuery(null); return; }
    }
    onKeyDown?.(e);
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(e) => { onChange(e.target.value); detect(e.target.value, e.target.selectionStart); }}
        onSelect={(e) => detect(e.currentTarget.value, e.currentTarget.selectionStart)}
        onBlur={() => setQuery(null)}
        onKeyDown={handleKey}
        className={className}
        {...rest}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="People to mention"
          className="absolute left-2 top-full z-50 mt-1 w-[min(20rem,calc(100%-1rem))] rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
        >
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActive(i)}
              className={clsx("flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5", i === active && "bg-brand-50 dark:bg-brand-950")}
            >
              {o.user ? (
                <Avatar name={o.user.displayName} url={o.user.avatarUrl} seed={o.user.uid} size="sm" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white"><Users className="h-4 w-4" aria-hidden /></span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">@{o.name}</span>
                <span className="block truncate text-xs text-slate-500">{o.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
