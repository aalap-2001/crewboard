import { useId } from "react";
import clsx from "clsx";

/**
 * Crewboard board icon — drawn from web/public/crewboard-logo.svg (the source logo).
 * Inline so it stays crisp at every size; the gradient id is unique per instance.
 */
export function LogoMark({ className, shadow }: { className?: string; shadow?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="16 18 112 112"
      fill="none"
      aria-hidden="true"
      className={clsx("shrink-0", shadow && "drop-shadow-[0_4px_6px_rgba(49,46,129,0.18)]", className)}
    >
      <defs>
        <linearGradient id={`cb-${id}`} x1="16" y1="18" x2="130" y2="138" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
      </defs>
      <rect x="16" y="18" width="112" height="112" rx="31" fill={`url(#cb-${id})`} />
      <rect x="38" y="42" width="68" height="64" rx="12" fill="white" fillOpacity=".15" stroke="white" strokeOpacity=".92" strokeWidth="3" />
      <path d="M38 58h68" stroke="white" strokeOpacity=".92" strokeWidth="3" />
      <circle cx="48" cy="50" r="2.5" fill="white" />
      <circle cx="57" cy="50" r="2.5" fill="white" fillOpacity=".7" />
      <rect x="48" y="69" width="19" height="26" rx="5" fill="white" />
      <rect x="75" y="69" width="21" height="8" rx="4" fill="white" fillOpacity=".56" />
      <rect x="75" y="83" width="21" height="12" rx="5" fill="#C7D2FE" />
      <path d="m79 89 3 3 7-7" stroke="#4338CA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const WORDMARK = "font-['Inter',ui-sans-serif,system-ui,sans-serif] font-[750] tracking-[-0.045em] text-[#111827] dark:text-white";

/**
 * Icon + wordmark, matching the source logo's proportions (Inter 750, −2.5/56 tracking).
 * The wordmark is live text so it switches color in dark mode.
 */
export function Logo({
  size = "md",
  tagline = false,
  taglineClassName,
}: {
  size?: "md" | "lg";
  tagline?: boolean;
  taglineClassName?: string;
}) {
  const lg = size === "lg";
  return (
    <span className={clsx("inline-flex items-center", lg ? "gap-4" : "gap-2.5")}>
      <LogoMark className={lg ? "h-16 w-16" : "h-8 w-8"} shadow={lg} />
      <span className="flex flex-col">
        <span className={clsx(WORDMARK, "leading-none", lg ? "text-[2.125rem]" : "text-[1.3125rem]")}>Crewboard</span>
        {tagline && (
          <span
            className={clsx(
              "mt-1.5 pl-[0.1em] font-['Inter',ui-sans-serif,system-ui,sans-serif] font-[550] tracking-[0.01em] text-[#6B7280] dark:text-slate-400",
              lg ? "text-[0.8125rem]" : "text-xs",
              taglineClassName
            )}
          >
            Your crew, your board, your flow.
          </span>
        )}
      </span>
    </span>
  );
}
