import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, LayoutGrid, Plus } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { watchMyBoards } from "@/lib/firestore";
import { errorMessage } from "@/lib/api";
import { useUsers } from "@/lib/users";
import type { BoardDoc, UserDoc } from "@/lib/types";
import { AvatarStack } from "@/components/Avatar";
import { NewBoardModal } from "@/components/board/NewBoardModal";
import { Button, Spinner, StateMessage } from "@/components/ui";

export function BoardsPage() {
  const { user, profile, role } = useSignedIn();
  const { byId } = useUsers();
  const [boards, setBoards] = useState<BoardDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const canCreate = role === "admin" || role === "manager";

  useEffect(() => watchMyBoards(user.uid, setBoards, (e) => setError(errorMessage(e))), [user.uid]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Hi, {profile.displayName.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Boards you're a member of.</p>
        </div>
        {canCreate && <Button icon={Plus} onClick={() => setCreating(true)}>New board</Button>}
      </div>

      <div className="mt-6">
        {error ? (
          <StateMessage icon={AlertTriangle} tone="error" title="Boards couldn't load" body={error} />
        ) : !boards ? (
          <div className="grid place-items-center py-16"><Spinner /></div>
        ) : boards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <StateMessage
              icon={LayoutGrid}
              title="No boards yet"
              body={canCreate ? "Create a board for a project or team, then add the people working on it." : "When a manager adds you to a board, it shows up here."}
              action={canCreate ? <Button icon={Plus} onClick={() => setCreating(true)}>New board</Button> : undefined}
            />
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => {
              const people = b.memberIds.map((id) => byId.get(id)).filter((u): u is UserDoc => !!u);
              return (
                <li key={b.id}>
                  <Link
                    to={`/boards/${b.id}`}
                    className="group flex h-full flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition hover:ring-brand-400 dark:bg-slate-900 dark:ring-slate-800 dark:hover:ring-brand-500"
                  >
                    <span className="flex gap-1" aria-hidden>
                      {[10, 6, 8].map((h, i) => (
                        <span key={i} className="w-2 rounded-sm bg-brand-500/70 group-hover:bg-brand-600" style={{ height: h * 2 }} />
                      ))}
                    </span>
                    <span className="mt-4 font-display text-lg font-semibold text-slate-900 dark:text-white">{b.name}</span>
                    {b.description && <span className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{b.description}</span>}
                    <span className="mt-auto flex items-center justify-between pt-5 text-xs text-slate-500">
                      <AvatarStack people={people} max={4} />
                      {b.memberIds.length} {b.memberIds.length === 1 ? "member" : "members"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {canCreate && <NewBoardModal open={creating} onClose={() => setCreating(false)} />}
    </>
  );
}
