import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import clsx from "clsx";
import { Loader2, type LucideIcon } from "lucide-react";

// ---------- Button ----------
type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/60",
  secondary:
    "bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800",
  ghost: "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/60",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon: Icon, className, children, disabled, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        variants[variant],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
});

// ---------- Form fields ----------
const fieldBase =
  "block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-500 focus-visible:ring-offset-0 disabled:bg-slate-100 disabled:text-slate-500 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:disabled:bg-slate-800";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
}

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  function TextField({ label, hint, error, className, id, ...rest }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;
    return (
      <div className={className}>
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className={clsx(fieldBase, error && "ring-red-500 focus:ring-red-500")}
          {...rest}
        />
        {error ? (
          <p id={`${inputId}-err`} className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
        ) : null}
      </div>
    );
  }
);

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  hideLabel,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps & { hideLabel?: boolean }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={clsx("mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300", hideLabel && "sr-only")}>
        {label}
      </label>
      <select id={id} className={clsx(fieldBase, "pr-8")} {...rest}>
        {children}
      </select>
      {hint && !error && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// ---------- Switch ----------
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p id={`${id}-l`} className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        {description && <p id={`${id}-d`} className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700"
        )}
      >
        <span
          aria-hidden
          className={clsx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

// ---------- Feedback ----------
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("h-5 w-5 animate-spin text-brand-600", className)} aria-label="Loading" />;
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function StateMessage({
  icon: Icon,
  title,
  body,
  action,
  tone = "neutral",
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center" role={tone === "error" ? "alert" : undefined}>
      <div
        className={clsx(
          "mb-4 grid h-12 w-12 place-items-center rounded-xl",
          tone === "error" ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400" : "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
        )}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={clsx(
        "rounded-lg px-3.5 py-3 text-sm",
        tone === "error" && "bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-200",
        tone === "success" && "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
        tone === "info" && "bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200"
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "brand" | "success" | "muted"; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        tone === "brand" && "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200",
        tone === "success" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        tone === "muted" && "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
      )}
    >
      {children}
    </span>
  );
}
