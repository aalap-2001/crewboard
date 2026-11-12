import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { AtSign, Bell, BellOff, Check, CheckCheck, UserPlus } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { markAllRead, setNotificationRead, watchNotifications, watchUnread } from "@/lib/firestore";
import { errorMessage } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useUsers } from "@/lib/users";
import type { NotificationDoc } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Popover } from "./Popover";
import { useToast } from "./Toast";

const LIMIT = 30;

function describe(n: NotificationDoc) {
  if (n.type === "assigned") return n.alsoMentioned ? "assigned you and mentioned you in" : "assigned you to";
  return n.source === "comment" ? "mentioned you in a comment on" : "mentioned you in";
}

function Item({ n, onOpen }: { n: NotificationDoc; onOpen: () => void }) {
  const { byId } = useUsers();
  const toast = useToast();
  const actor = byId.get(n.actorId);
  const Icon = n.type === "assigned" ? UserPlus : AtSign;
  return (
    <li className={clsx("group relative flex gap-3 rounded-lg px-2.5 py-2.5", !n.read && "bg-brand-50/70 dark:bg-brand-950/40")}>
      <span className="relative shrink-0">
        <Avatar name={actor?.displayName ?? "?"} url={actor?.avatarUrl} seed={n.actorId} size="md" />
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <Icon className="h-3 w-3 text-brand-600" aria-hidden />
        </span>
      </span>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left after:absolute after:inset-0">
        <span className="block text-sm text-slate-700 dark:text-slate-300">
          <strong className="font-semibold text-slate-900 dark:text-white">{actor?.displayName ?? "A teammate"}</strong> {describe(n)}{" "}
          <strong className="font-semibold text-slate-900 dark:text-white">{n.taskTitle}</strong>
        </span>
        {n.snippet && <span className="mt-0.5 line-clamp-2 block text-sm text-slate-500">{n.snippet}</span>}
        <span className="mt-1 block text-xs text-slate-400">{n.boardName} · {relativeTime(n.createdAt)}</span>
      </button>
      <button
        onClick={() => void setNotificationRead(n.id, !n.read).catch((e) => toast(errorMessage(e), "error"))}
        aria-label={n.read ? "Mark as unread" : "Mark as read"}
        title={n.read ? "Mark as unread" : "Mark as read"}
        className="relative z-10 self-start rounded-md p-1 text-slate-400 hover:bg-white hover:text-brand-700 dark:hover:bg-slate-800"
      >
        {n.read ? <span className="block h-4 w-4" /> : <Check className="h-4 w-4" />}
        {!n.read && <span className="sr-only">Unread</span>}
      </button>
      {!n.read && <span className="absolute left-0.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-brand-600" aria-hidden />}
    </li>
  );
}

export function NotificationBell() {
  const { user } = useSignedIn();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationDoc[] | null>(null);
  const [unread, setUnread] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u1 = watchNotifications(user.uid, LIMIT, setItems, (e) => setError(errorMessage(e)));
    const u2 = watchUnread(user.uid, setUnread, () => undefined);
    return () => { u1(); u2(); };
  }, [user.uid]);

  const count = unread.length;
  const badge = count > 99 ? "99+" : String(count);

  return (
    <Popover
      label={count ? `Notifications, ${count} unread` : "Notifications"}
      align="right"
      width="sm:w-96 max-sm:fixed max-sm:inset-x-3 max-sm:top-14"
      buttonClassName="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      buttonContent={
        <>
          <Bell className="h-5 w-5" aria-hidden />
          {count > 0 && (
            <span className="absolute right-0.5 top-0.5 min-w-[1.125rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-[1.125rem] text-white" aria-hidden>
              {badge}
            </span>
          )}
        </>
      }
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-2.5 py-2">
            <h2 className="font-sans text-sm font-semibold">Notifications</h2>
            <button
              disabled={!count}
              onClick={() => void markAllRead(unread).catch((e) => toast(errorMessage(e), "error"))}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:text-slate-400 disabled:hover:bg-transparent dark:text-brand-300 dark:hover:bg-brand-950"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Mark all read
            </button>
          </div>
          <div className="max-h-[min(28rem,70vh)] overflow-y-auto" aria-live="polite">
            {error ? (
              <p role="alert" className="px-3 py-6 text-center text-sm text-red-600">Notifications couldn't load. {error}</p>
            ) : !items ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BellOff className="mx-auto h-6 w-6 text-slate-400" aria-hidden />
                <p className="mt-2 text-sm font-semibold">You're all caught up</p>
                <p className="mt-1 text-sm text-slate-500">You'll hear here when someone assigns or @mentions you.</p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {items.map((n) => (
                  <Item
                    key={n.id}
                    n={n}
                    onOpen={() => {
                      close();
                      if (!n.read) void setNotificationRead(n.id, true);
                      navigate(`/boards/${n.boardId}/tasks/${n.taskId}`);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
          {items && items.length >= LIMIT && <p className="px-3 py-2 text-center text-xs text-slate-500">Showing your latest {LIMIT}.</p>}
        </div>
      )}
    </Popover>
  );
}
