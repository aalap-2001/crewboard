import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { AlertTriangle, ChevronLeft, Columns3, List, Lock, Settings } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { watchBoard, watchBoardTasks, watchColumns } from "@/lib/firestore";
import { errorMessage } from "@/lib/api";
import { useUsers } from "@/lib/users";
import type { BoardDoc, ColumnDoc, TaskDoc, UserDoc } from "@/lib/types";
import { AvatarStack } from "@/components/Avatar";
import { BoardContext, type BoardData } from "@/components/board/BoardContext";
import { BoardSettingsModal } from "@/components/board/BoardSettingsModal";
import { KanbanBoard } from "@/components/board/KanbanBoard";
import { ListView } from "@/components/board/ListView";
import { TaskPanel } from "@/components/task/TaskPanel";
import { Button, FullPageSpinner, StateMessage } from "@/components/ui";

export function BoardPage() {
  // One route (boards/:boardId/*) so opening a task doesn't remount the board.
  const { boardId = "", "*": rest = "" } = useParams();
  const taskId = /^tasks\/([^/]+)/.exec(rest)?.[1];
  const [search, setSearch] = useSearchParams();
  const view = search.get("view") === "list" ? "list" : "board";
  const { user, role } = useSignedIn();
  const { byId: usersById } = useUsers();
  const [board, setBoard] = useState<BoardDoc | null | undefined>(undefined);
  const [columns, setColumns] = useState<ColumnDoc[] | null>(null);
  const [tasks, setTasks] = useState<TaskDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setBoard(undefined);
    setColumns(null);
    setTasks(null);
    setError(null);
    const onErr = (e: { code?: string; message: string }) =>
      e.code === "permission-denied" ? setBoard(null) : setError(errorMessage(e));
    const unsubs = [
      watchBoard(boardId, setBoard, onErr),
      watchColumns(boardId, setColumns, onErr),
      watchBoardTasks(boardId, user.uid, setTasks, onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [boardId, user.uid]);

  useEffect(() => {
    document.title = board ? `${board.name} · Crewboard` : "Crewboard";
    return () => { document.title = "Crewboard"; };
  }, [board]);

  const data = useMemo<BoardData | null>(() => {
    if (!board || !columns || !tasks) return null;
    const members = board.memberIds
      .map((id) => usersById.get(id))
      .filter((u): u is UserDoc => !!u)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    return {
      board,
      columns,
      tasks,
      tasksById: new Map(tasks.map((t) => [t.id, t])),
      columnsById: new Map(columns.map((c) => [c.id, c])),
      members,
      usersById,
      canManage: role === "admin" || role === "manager",
    };
  }, [board, columns, tasks, usersById, role]);

  if (error) return <StateMessage icon={AlertTriangle} tone="error" title="This board couldn't load" body={error} />;
  if (board === null) {
    return (
      <StateMessage
        icon={Lock}
        title="You can't open this board"
        body="It doesn't exist, or you aren't a member. Ask a manager to add you."
        action={<Link to="/" className="text-sm font-semibold text-brand-600 dark:text-brand-400">Back to your boards</Link>}
      />
    );
  }
  if (!data) return <FullPageSpinner />;

  return (
    <BoardContext.Provider value={data}>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Boards
        </Link>
        <div className="min-w-0 flex-1 basis-60">
          <h1 className="truncate text-2xl font-bold">{data.board.name}</h1>
          {data.board.description && <p className="truncate text-sm text-slate-600 dark:text-slate-400">{data.board.description}</p>}
        </div>
        <button onClick={() => setSettingsOpen(true)} className="rounded-full" aria-label={`${data.members.length} board members. Open board settings`}>
          <AvatarStack people={data.members} max={5} size="md" />
        </button>
        <div role="group" aria-label="View" className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {([["board", "Board", Columns3], ["list", "List", List]] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setSearch(v === "list" ? { view: "list" } : {}, { replace: true })}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold",
                view === v ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />{label}
            </button>
          ))}
        </div>
        <Button variant="secondary" icon={Settings} onClick={() => setSettingsOpen(true)}>
          <span className="hidden sm:inline">Board settings</span><span className="sm:hidden">Settings</span>
        </Button>
      </div>

      {view === "list" ? <ListView /> : <KanbanBoard />}

      {taskId && <TaskPanel taskId={taskId} loaded={!!tasks} />}
      <BoardSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </BoardContext.Provider>
  );
}
