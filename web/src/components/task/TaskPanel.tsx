import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Link2, SearchX, Trash2, X } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { deleteTask } from "@/lib/firestore";
import { errorMessage } from "@/lib/api";
import { dueState } from "@/lib/dates";
import { relativeTime } from "@/lib/format";
import { useUserName } from "@/lib/users";
import { endPosition } from "@/lib/position";
import { PRIORITIES, PRIORITY_LABELS, type Priority, type TaskDoc } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Button, StateMessage } from "@/components/ui";
import { useBoard } from "@/components/board/BoardContext";
import { ActivityList } from "./ActivityList";
import { Attachments } from "./Attachments";
import { Checklist } from "./Checklist";
import { Comments } from "./Comments";
import { Description } from "./Description";
import { AssigneePicker, LabelPicker } from "./Pickers";
import { useTaskUpdate } from "./useTaskUpdate";

const selectCls =
  "rounded-lg border-0 bg-transparent py-1 pl-2 pr-8 text-sm font-medium ring-1 ring-transparent hover:bg-slate-100 hover:ring-slate-200 focus:ring-2 focus:ring-brand-500 dark:hover:bg-slate-800 dark:hover:ring-slate-700";

function Row({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2 py-1">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm text-slate-500">{label}</label>
      ) : (
        <span className="text-sm text-slate-500">{label}</span>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function TitleEditor({ task }: { task: TaskDoc }) {
  const save = useTaskUpdate(task.id);
  const [title, setTitle] = useState(task.title);
  useEffect(() => setTitle(task.title), [task.title]);
  const commit = () => {
    const t = title.trim();
    if (!t) return setTitle(task.title);
    if (t !== task.title) void save({ title: t });
  };
  return (
    <textarea
      id="task-title"
      aria-label="Task title"
      rows={1}
      value={title}
      maxLength={200}
      onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
        if (e.key === "Escape") { e.preventDefault(); setTitle(task.title); }
      }}
      className="block w-full resize-none rounded-lg border-0 bg-transparent px-2 py-1 font-display text-xl font-semibold text-slate-900 [field-sizing:content] hover:bg-slate-50 focus:ring-2 focus:ring-brand-500 dark:text-white dark:hover:bg-slate-800"
    />
  );
}

function TaskBody({ task }: { task: TaskDoc }) {
  const { columns, columnsById, tasks } = useBoard();
  const save = useTaskUpdate(task.id);
  const name = useUserName();
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const due = dueState(task.dueDate, task.done);

  const moveTo = (columnId: string) => {
    const col = columnsById.get(columnId);
    if (!col || columnId === task.columnId) return;
    const positions = tasks.filter((t) => t.columnId === columnId).map((t) => t.position);
    void save({ columnId, position: endPosition(positions), done: col.isDone });
  };

  const tabCls = (t: string) =>
    clsx("border-b-2 px-1 pb-2 text-sm font-semibold", tab === t ? "border-brand-600 text-brand-700 dark:text-brand-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200");

  return (
    <div className="space-y-7">
      <div>
        <TitleEditor task={task} />
        <p className="mt-1 px-2 text-xs text-slate-500">
          Created by {name(task.createdBy)} {relativeTime(task.createdAt)} · updated {relativeTime(task.updatedAt)}
        </p>
      </div>

      <div className="px-2">
        <Row label="Status" htmlFor="t-status">
          <select id="t-status" className={selectCls} value={task.columnId} onChange={(e) => moveTo(e.target.value)}>
            {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Row>
        <Row label="Priority" htmlFor="t-priority">
          <select id="t-priority" className={selectCls} value={task.priority} onChange={(e) => void save({ priority: e.target.value as Priority })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </Row>
        <Row label="Due date" htmlFor="t-due">
          <div className="flex items-center gap-2">
            <input
              id="t-due"
              type="date"
              value={task.dueDate ?? ""}
              onChange={(e) => void save({ dueDate: e.target.value || null })}
              className={clsx(selectCls, "pr-2", due === "overdue" && "text-red-700 ring-red-300 dark:text-red-300")}
            />
            {due === "overdue" && <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">Overdue</span>}
            {task.dueDate && (
              <button className="text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => void save({ dueDate: null })}>Clear</button>
            )}
          </div>
        </Row>
        <Row label="Assignees"><AssigneePicker task={task} /></Row>
        <Row label="Labels"><LabelPicker task={task} /></Row>
      </div>

      <div className="space-y-7 px-2">
        <Description task={task} />
        <Checklist task={task} />
        <Attachments task={task} />
      </div>

      <div className="px-2">
        <div role="tablist" aria-label="Task discussion" className="mb-4 flex gap-5 border-b border-slate-200 dark:border-slate-800">
          <button role="tab" aria-selected={tab === "comments"} className={tabCls("comments")} onClick={() => setTab("comments")}>
            Comments{task.commentCount > 0 && ` (${task.commentCount})`}
          </button>
          <button role="tab" aria-selected={tab === "activity"} className={tabCls("activity")} onClick={() => setTab("activity")}>Activity</button>
        </div>
        <div role="tabpanel">{tab === "comments" ? <Comments task={task} /> : <ActivityList taskId={task.id} />}</div>
      </div>
    </div>
  );
}

/** Side panel for one task. Lives at /boards/:boardId/tasks/:taskId so the URL can be shared. */
export function TaskPanel({ taskId, loaded }: { taskId: string; loaded: boolean }) {
  const { board, tasksById, canManage } = useBoard();
  const { user } = useSignedIn();
  const toast = useToast();
  const navigate = useNavigate();
  const panel = useRef<HTMLElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const task = tasksById.get(taskId);
  const { search } = useLocation();
  // Return to wherever the task was opened from: My Tasks, the list view, or the board.
  const close = () => {
    const params = new URLSearchParams(search);
    if (params.get("from") === "my-tasks") navigate("/my-tasks");
    else navigate(`/boards/${board.id}${params.get("view") === "list" ? "?view=list" : ""}`);
  };

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
      const el = e.target as HTMLElement;
      if (el.closest("textarea, input")) return; // let fields handle their own Esc
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied");
    } catch {
      toast("Couldn't copy. Copy the address from your browser instead.", "error");
    }
  };

  const canDelete = !!task && (task.createdBy === user.uid || canManage);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={close} aria-hidden />
      <aside
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={task ? "task-title" : undefined}
        aria-label={task ? undefined : "Task"}
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl outline-none dark:bg-slate-900"
      >
        <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <p className="min-w-0 flex-1 truncate text-sm text-slate-500">{board.name}</p>
          <Button size="sm" variant="ghost" icon={Link2} onClick={() => void copyLink()}>Copy link</Button>
          {canDelete && (
            <Button size="sm" variant="ghost" aria-label="Delete task" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          )}
          <button onClick={close} aria-label="Close task" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-3 py-5 sm:px-5">
          {task ? (
            <TaskBody key={task.id} task={task} />
          ) : loaded ? (
            <StateMessage icon={SearchX} title="This task isn't here" body="It may have been deleted, or the link is from another board." action={<Button variant="secondary" onClick={close}>Back to board</Button>} />
          ) : null}
        </div>
      </aside>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this task?"
        description="Its checklist, links, comments and activity are deleted too. This can't be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep task</Button>
            <Button
              variant="danger"
              onClick={async () => {
                setConfirmDelete(false);
                try {
                  await deleteTask(taskId);
                  toast("Task deleted");
                  close();
                } catch (err) {
                  toast(errorMessage(err), "error");
                }
              }}
            >
              Delete task
            </Button>
          </>
        }
      />
    </div>
  );
}
