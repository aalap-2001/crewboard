import { useState, type FormEvent } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { CheckCircle2, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { createTask, deleteColumn, updateColumn } from "@/lib/firestore";
import { errorMessage } from "@/lib/api";
import { endPosition } from "@/lib/position";
import type { ColumnDoc } from "@/lib/types";
import { Popover, menuItemCls } from "@/components/Popover";
import { useToast } from "@/components/Toast";
import { useBoard } from "./BoardContext";
import { SortableTaskCard, TaskCardBody } from "./TaskCard";

function QuickAdd({ column }: { column: ColumnDoc }) {
  const { board, tasks } = useBoard();
  const { user } = useSignedIn();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      const positions = tasks.filter((x) => x.columnId === column.id).map((x) => x.position);
      await createTask(user.uid, { board, columnId: column.id, columnIsDone: column.isDone, position: endPosition(positions), title: t });
      setTitle("");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <Plus className="h-4 w-4" aria-hidden /> Add task
      </button>
    );
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor={`qa-${column.id}`} className="sr-only">New task title in {column.name}</label>
      <textarea
        id={`qa-${column.id}`}
        autoFocus
        rows={2}
        value={title}
        maxLength={200}
        disabled={busy}
        placeholder="What needs doing?"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit(e as unknown as FormEvent);
          }
          if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        onBlur={() => !title.trim() && setOpen(false)}
        className="block w-full resize-none rounded-lg border-0 bg-white p-2.5 text-sm shadow-sm ring-1 ring-brand-400 focus:ring-2 focus:ring-brand-500 dark:bg-slate-900"
      />
      <p className="mt-1 px-1 text-xs text-slate-500">Enter to add · Esc to close</p>
    </form>
  );
}

function ColumnMenu({ column, taskCount, onRename }: { column: ColumnDoc; taskCount: number; onRename: () => void }) {
  const { board } = useBoard();
  const toast = useToast();
  const run = (fn: () => Promise<unknown>, ok: string) => fn().then(() => toast(ok), (e) => toast(errorMessage(e), "error"));
  return (
    <Popover
      label={`Options for ${column.name}`}
      align="right"
      width="w-64"
      buttonClassName="rounded-md p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
      buttonContent={<MoreHorizontal className="h-4 w-4" />}
    >
      {(close) => (
        <>
          <button className={menuItemCls} onClick={() => { close(); onRename(); }}>
            <Pencil className="h-4 w-4" aria-hidden /> Rename column
          </button>
          <button
            className={menuItemCls}
            onClick={() => {
              close();
              void run(() => updateColumn(board.id, column.id, { isDone: !column.isDone }), column.isDone ? `“${column.name}” no longer marks tasks done` : `Tasks in “${column.name}” now count as done`);
            }}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {column.isDone ? "Stop marking tasks done" : "Mark tasks here as done"}
          </button>
          <button
            className={clsx(menuItemCls, "text-red-700 dark:text-red-400")}
            disabled={taskCount > 0}
            title={taskCount > 0 ? "Move or delete its tasks first" : undefined}
            onClick={() => {
              close();
              void run(() => deleteColumn(board.id, column.id), `Column “${column.name}” deleted`);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {taskCount > 0 ? "Delete (move its tasks first)" : "Delete column"}
          </button>
        </>
      )}
    </Popover>
  );
}

/** Static copy of a column shown under the pointer while it's being dragged. */
export function ColumnPreview({ column, taskIds }: { column: ColumnDoc; taskIds: string[] }) {
  const { tasksById } = useBoard();
  return (
    <section aria-hidden className="flex max-h-[70vh] w-[19rem] rotate-1 flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl dark:bg-slate-900">
      <header className="px-4 pb-2 pt-3 text-sm font-semibold">{column.name}</header>
      <ul className="flex flex-col gap-2 px-2 pb-2">
        {taskIds.slice(0, 6).map((id) => {
          const t = tasksById.get(id);
          return t ? <li key={id}><TaskCardBody task={t} /></li> : null;
        })}
      </ul>
    </section>
  );
}

export function ColumnView({ column, taskIds }: { column: ColumnDoc; taskIds: string[] }) {
  const { board, tasksById, canManage } = useBoard();
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `col:${column.id}`,
    data: { type: "column" },
    disabled: { draggable: !canManage, droppable: false },
  });

  const saveName = async () => {
    setRenaming(false);
    const n = name.trim();
    if (!n || n === column.name) return setName(column.name);
    try {
      await updateColumn(board.id, column.id, { name: n });
    } catch (err) {
      setName(column.name);
      toast(errorMessage(err), "error");
    }
  };

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={`${column.name} column, ${taskIds.length} tasks`}
      className={clsx(
        "flex max-h-full w-[19rem] shrink-0 snap-start flex-col rounded-2xl bg-slate-100 dark:bg-slate-900/60",
        isDragging && "opacity-40"
      )}
    >
      <header className="flex items-center gap-1.5 px-3 pb-2 pt-3">
        {canManage && (
          <button
            {...attributes}
            {...listeners}
            aria-label={`Reorder column ${column.name}`}
            aria-roledescription="draggable column"
            className="-ml-1 cursor-grab rounded p-0.5 text-slate-400 hover:text-slate-700 active:cursor-grabbing dark:hover:text-slate-200"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {renaming ? (
          <input
            autoFocus
            aria-label="Column name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveName();
              if (e.key === "Escape") { setName(column.name); setRenaming(false); }
            }}
            className="min-w-0 flex-1 rounded-md border-0 bg-white px-2 py-1 text-sm font-semibold ring-1 ring-brand-400 dark:bg-slate-900"
          />
        ) : (
          <h2 className="min-w-0 flex-1 truncate font-sans text-sm font-semibold" onDoubleClick={() => canManage && setRenaming(true)}>
            {column.name}
          </h2>
        )}
        {column.isDone && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Done column" />}
        <span className="rounded-full bg-slate-200 px-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">{taskIds.length}</span>
        {canManage && <ColumnMenu column={column} taskCount={taskIds.length} onRename={() => setRenaming(true)} />}
      </header>

      <SortableContext items={taskIds.map((id) => `task:${id}`)} strategy={verticalListSortingStrategy}>
        <ul className="flex min-h-[3rem] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {taskIds.map((id) => {
            const t = tasksById.get(id);
            return t ? <SortableTaskCard key={id} task={t} /> : null;
          })}
          {taskIds.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700">
              Drop tasks here
            </li>
          )}
        </ul>
      </SortableContext>

      <div className="px-2 pb-2"><QuickAdd column={column} /></div>
    </section>
  );
}
