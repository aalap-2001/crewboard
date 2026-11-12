import { useState } from "react";
import clsx from "clsx";
import { initials } from "@/lib/format";

// Stable per-person tint so initials avatars are easy to tell apart.
const TINTS = [
  "bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-100",
  "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
  "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100",
  "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100",
];

function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

const SIZES = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-sm", lg: "h-16 w-16 text-xl" };

export function Avatar({
  name,
  url,
  seed,
  size = "md",
  className,
}: {
  name: string;
  url?: string | null;
  seed?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const base = clsx("inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold", SIZES[size], className);
  if (url && !failed) {
    return <img src={url} alt="" className={clsx(base, "object-cover")} onError={() => setFailed(true)} referrerPolicy="no-referrer" />;
  }
  return (
    <span className={clsx(base, tintFor(seed ?? name))} aria-hidden>
      {initials(name)}
    </span>
  );
}

/** Overlapping avatars with a "+n" overflow chip. */
export function AvatarStack({
  people,
  max = 3,
  size = "sm",
}: {
  people: { uid: string; displayName: string; avatarUrl: string | null }[];
  max?: number;
  size?: "sm" | "md";
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex -space-x-1.5" title={people.map((p) => p.displayName).join(", ")}>
      {shown.map((p) => (
        <Avatar key={p.uid} name={p.displayName} url={p.avatarUrl} seed={p.uid} size={size} className="ring-2 ring-white dark:ring-slate-900" />
      ))}
      {extra > 0 && (
        <span className={clsx("inline-grid place-items-center rounded-full bg-slate-200 font-semibold text-slate-700 ring-2 ring-white dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-900", SIZES[size])}>
          +{extra}
        </span>
      )}
      <span className="sr-only">{people.map((p) => p.displayName).join(", ")}</span>
    </span>
  );
}
