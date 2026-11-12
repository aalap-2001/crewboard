import { Link, useNavigate } from "react-router-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { AlertCircle, CalendarDays, CheckSquare, Link2, MessageSquare } from "lucide-react";
import { dueState, formatDue } from "@/lib/dates";
import type { TaskDoc, UserDoc } from "@/lib/types";
import { AvatarStack } from "@/components/Avatar";
import { LabelChip, PriorityIcon } from "@/components/chips";
import { useBoard } from "./BoardContext";

export function taskUrl(boardId: string, taskId: string) {
  return `/boards/${boardId}/tasks/${taskId}`;
}

/** Visual card, shared by the board and the drag overlay. */
export function TaskCardBody({ task, overlay }: { task: TaskDoc; overlay?: boolean }) {
  const { board, usersById } = useBoard();
  const labels = task.labelIds.map((id) => board.labels.find((l) => l.id === id)).filter((l) => !!l);
  const assignees = task.assigneeIds.map((id) => usersById.get(id)).filter((u): u is UserDoc => !!u);
  const due = dueState(task.dueDate, task.done);
  const doneItems = task.checklist.filter((c) => c.done).length;

  return (
    <div
      className={clsx(
        "rounded-xl bg-white p-3 text-left shadow-sm ring-1 dark:bg-slate-900",
        due === "overdue" ? "ring-red-300 dark:ring-red-900" : "ring-slate-200 dark:ring-slate-800",
        due === "overdue" && "border-l-4 border-l-red-500",
        overlay && "rotate-2 shadow-xl ring-brand-400"
      )}
    >
      {labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {labels.map((l) => <LabelChip key={l.id} label={l} small />)}
        </div>
      )}
      <Link
        to={taskUrl(board.id, task.id)}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        className={clsx("block text-sm font-semibold text-slate-900 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300", task.done && "text-slate-500 line-through dark:text-slate-500")}
      >
        {task.title}
      </Link>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        <PriorityIcon priority={task.priority} />
        {task.dueDate && (
          <span
            className={clsx(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold",
              due === "overdue" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
              due === "today" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
              due === "soon" && "text-amber-700 dark:text-amber-300"
            )}
          >
            {due === "overdue" ? <AlertCircle className="h-3.5 w-3.5" aria-hidden /> : <CalendarDays className="h-3.5 w-3.5" aria-hidden />}
            {due === "overdue" ? "Overdue · " : due === "today" ? "Today · " : ""}
            {formatDue(task.dueDate)}
          </span>
        )}
        {task.checklist.length > 0 && (
          <span className={clsx("inline-flex items-center gap-1", doneItems === task.checklist.length && "text-emerald-600 dark:text-emerald-400")}>
            <CheckSquare className="h-3.5 w-3.5" aria-hidden />
            {doneItems}/{task.checklist.length}
            <span className="sr-only">checklist items done</span>
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            {task.commentCount}
            <span className="sr-only">comments</span>
          </span>
        )}
        {task.attachments.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {task.attachments.length}
            <span className="sr-only">links</span>
          </span>
        )}
        {assignees.length > 0 && <span className="ml-auto"><AvatarStack people={assignees} /></span>}
      </div>
    </div>
  );
}

export function SortableTaskCard({ task }: { task: TaskDoc }) {
  const navigate = useNavigate();
  const { board } = useBoard();
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `task:${task.id}`,
    data: { type: "task" },
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable task"
      aria-label={`${task.title}. Press Enter to open, Space to move.`}
      onClick={() => navigate(taskUrl(board.id, task.id))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isDragging) {
          e.preventDefault();
          navigate(taskUrl(board.id, task.id));
        } else listeners?.onKeyDown?.(e);
      }}
      className={clsx("cursor-grab touch-manipulation rounded-xl active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <TaskCardBody task={task} />
    </li>
  );
}
