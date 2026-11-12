import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

/**
 * Signed-out screens. The left panel is a quiet board of columns and cards echoing the
 * logo's board icon; it's decorative and hidden from assistive tech.
 */
const columns = [
  { cards: [44, 28, 36] },
  { cards: [28, 52] },
  { cards: [36, 24, 40, 20] },
  { cards: [24] },
];

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside aria-hidden className="relative hidden overflow-hidden bg-brand-700 lg:block">
        <div className="absolute inset-0 flex gap-4 p-12 pt-24">
          {columns.map((col, i) => (
            <div key={i} className="flex w-1/4 flex-col gap-3 rounded-2xl bg-white/[0.07] p-3">
              <div className="mb-1 h-2.5 w-1/2 rounded-full bg-white/30" />
              {col.cards.map((h, j) => (
                <div
                  key={j}
                  className="rounded-lg bg-white/90 shadow-sm"
                  style={{ height: `${h * 2}px`, opacity: 1 - j * 0.12 }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-900 via-brand-900/80 to-transparent p-12 pt-40">
          <p className="max-w-md font-display text-4xl font-extrabold leading-tight text-white">
            Your crew, your board, your flow.
          </p>
        </div>
      </aside>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          {/* On wide screens the panel on the left already carries the tagline. */}
          <Logo size="lg" tagline taglineClassName="lg:hidden" />
          <h1 className="mt-10 text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
