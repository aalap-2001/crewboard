import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import { CircleCheckBig, LayoutGrid, LogOut, Monitor, Moon, Sun, UserRound, Users } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { useTheme } from "@/lib/theme";
import { ROLE_LABELS } from "@/lib/types";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { UsersProvider } from "@/lib/users";
import { NotificationBell } from "./NotificationBell";

function ThemeToggle() {
  const { pref, cycle } = useTheme();
  const Icon = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;
  const label = `Theme: ${pref}. Switch theme`;
  return (
    <button onClick={cycle} aria-label={label} title={label} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
      <Icon className="h-5 w-5" />
    </button>
  );
}

function UserMenu() {
  const { profile, role, signOut } = useSignedIn();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800";
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="rounded-full"
      >
        <Avatar name={profile.displayName} url={profile.avatarUrl} seed={profile.uid} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-60 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{profile.displayName}</p>
            <p className="truncate text-xs text-slate-500">{profile.email} · {ROLE_LABELS[role]}</p>
          </div>
          <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
          <Link role="menuitem" to="/profile" className={item}>
            <UserRound className="h-4 w-4" aria-hidden /> Profile and notifications
          </Link>
          <button role="menuitem" onClick={() => void signOut()} className={item}>
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { role } = useSignedIn();
  const { pathname } = useLocation();
  const wide = pathname.startsWith("/boards/");
  useEffect(() => {
    if (!wide) document.title = "Crewboard";
  }, [wide, pathname]);
  const nav = [
    { to: "/", label: "Boards", icon: LayoutGrid, show: true, match: (p: string) => p === "/" || p.startsWith("/boards") },
    { to: "/my-tasks", label: "My Tasks", icon: CircleCheckBig, show: true, match: (p: string) => p.startsWith("/my-tasks") },
    { to: "/admin/users", label: "People", icon: Users, show: role === "admin", match: (p: string) => p.startsWith("/admin") },
  ].filter((n) => n.show);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold",
      isActive
        ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
    );

  return (
    <UsersProvider>
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="Crewboard home"><Logo /></Link>
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end className={() => linkCls({ isActive: n.match(pathname) })}>
                <n.icon className="h-4 w-4" aria-hidden />{n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
        {/* Mobile nav */}
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto border-t border-slate-200 px-3 py-1.5 sm:hidden dark:border-slate-800">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end className={() => linkCls({ isActive: n.match(pathname) })}>
              <n.icon className="h-4 w-4" aria-hidden />{n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className={clsx("mx-auto px-4 py-6 sm:px-6 sm:py-8", wide ? "max-w-none" : "max-w-6xl")}>
        <Outlet />
      </main>
    </div>
    </UsersProvider>
  );
}
