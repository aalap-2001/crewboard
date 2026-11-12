import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Click-to-open popover. Esc and outside clicks close it; Esc is handled in the
 * capture phase and marked defaultPrevented so outer layers (the task panel) ignore it.
 */
export function Popover({
  label,
  buttonContent,
  buttonClassName,
  children,
  align = "left",
  width = "w-72",
  disabled,
}: {
  label: string;
  buttonContent: ReactNode;
  buttonClassName?: string;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrap}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
      >
        {buttonContent}
      </button>
      {open && (
        <div
          className={clsx(
            "absolute z-50 mt-1.5 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700",
            align === "right" ? "right-0" : "left-0",
            width
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export const menuItemCls =
  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800";
