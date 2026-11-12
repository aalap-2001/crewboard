import { useMemo, useState, type FormEvent } from "react";
import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { addColumn, rebalanceColumn, updateColumn, updateTask } from "@/lib/firestore";
import { errorMessage } from "@/lib/api";
import { between, endPosition, needsRebalance } from "@/lib/position";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";
import { useBoard } from "./BoardContext";
import { ColumnPreview, ColumnView } from "./ColumnView";
import { TaskCardBody } from "./TaskCard";

type Items = Record<string, string[]>; // columnId → ordered taskIds

const isCol = (id: UniqueIdentifier) => String(id).startsWith("col:");
const rawId = (id: UniqueIdentifier) => String(id).slice(String(id).indexOf(":") + 1);

/** Column drags only collide with columns; card drags use corners for multi-list sorting. */
const collision: CollisionDetection = (args) =>
  isCol(args.active.id)
    ? closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => isCol(c.id)) })
    : closestCorners(args);

function AddColumn() {
  const { board, columns } = useBoard();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addColumn(board.id, name.trim(), endPosition(columns.map((c) => c.position)));
      setName("");
      setOpen(false);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return open ? (
    <form onSubmit={submit} className="w-[19rem] shrink-0 rounded-2xl bg-slate-100 p-3 dark:bg-slate-900/60">
      <label htmlFor="new-col" className="sr-only">Column name</label>
      <input
        id="new-col"
        autoFocus
        value={name}
        maxLength={40}
        placeholder="Column name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500 dark:bg-slate-900 dark:ring-slate-700"
      />
      <div className="mt-2 flex gap-2">
        <Button type="submit" size="sm" disabled={!name.trim()}>Add column</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  ) : (
    <button
      onClick={() => setOpen(true)}
      className="flex h-12 w-[19rem] shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:hover:text-brand-300"
    >
      <Plus className="h-4 w-4" aria-hidden /> Add column
    </button>
  );
}

export function KanbanBoard() {
  const { board, columns, tasks, tasksById, columnsById, canManage } = useBoard();
  const { user } = useSignedIn();
  const toast = useToast();

  const serverItems = useMemo<Items>(() => {
    const items: Items = Object.fromEntries(columns.map((c) => [c.id, [] as string[]]));
    for (const t of [...tasks].sort((a, b) => a.position - b.position)) items[t.columnId]?.push(t.id);
    return items;
  }, [columns, tasks]);

  // While dragging we work on a local copy so cards can hop between columns smoothly.
  const [drag, setDrag] = useState<{ items: Items; colOrder: string[] } | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const items = drag?.items ?? serverItems;
  const colOrder = drag?.colOrder ?? columns.map((c) => c.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    })
  );

  const containerOf = (id: UniqueIdentifier, from: Items): string | undefined => {
    if (isCol(id)) return rawId(id);
    const taskId = rawId(id);
    return Object.keys(from).find((col) => from[col].includes(taskId));
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(e.active.id);
    setDrag({ items: structuredClone(serverItems), colOrder: columns.map((c) => c.id) });
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || isCol(active.id) || !drag) return;
    const from = containerOf(active.id, drag.items);
    const to = containerOf(over.id, drag.items);
    if (!from || !to || from === to) return;
    const taskId = rawId(active.id);
    setDrag((d) => {
      if (!d) return d;
      const next = { ...d.items, [from]: d.items[from].filter((x) => x !== taskId), [to]: [...d.items[to]] };
      const overIndex = isCol(over.id) ? next[to].length : next[to].indexOf(rawId(over.id));
      next[to].splice(overIndex < 0 ? next[to].length : overIndex, 0, taskId);
      return { ...d, items: next };
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const state = drag;
    setActiveId(null);
    if (!over || !state) return setDrag(null);

    try {
      if (isCol(active.id)) {
        const overCol = containerOf(over.id, state.items);
        const oldIdx = state.colOrder.indexOf(rawId(active.id));
        const newIdx = overCol ? state.colOrder.indexOf(overCol) : -1;
        setDrag(null);
        if (newIdx < 0 || oldIdx === newIdx) return;
        const order = arrayMove(state.colOrder, oldIdx, newIdx);
        const prev = columnsById.get(order[newIdx - 1])?.position;
        const next = columnsById.get(order[newIdx + 1])?.position;
        await updateColumn(board.id, rawId(active.id), { position: between(prev, next) });
        return;
      }

      const taskId = rawId(active.id);
      const col = containerOf(active.id, state.items);
      if (!col) return setDrag(null);
      let list = state.items[col];
      if (!isCol(over.id)) {
        const oldIdx = list.indexOf(taskId);
        const overIdx = list.indexOf(rawId(over.id));
        if (overIdx >= 0 && oldIdx !== overIdx) list = arrayMove(list, oldIdx, overIdx);
      }
      setDrag(null);

      const idx = list.indexOf(taskId);
      const prev = tasksById.get(list[idx - 1])?.position;
      const next = tasksById.get(list[idx + 1])?.position;
      const task = tasksById.get(taskId)!;
      const position = between(prev, next);
      const column = columnsById.get(col)!;
      if (task.columnId === col && list.join() === serverItems[col].join()) return; // no-op drop

      if (needsRebalance(prev, next)) {
        await updateTask(user.uid, taskId, { columnId: col, done: column.isDone });
        await rebalanceColumn(user.uid, list);
      } else {
        await updateTask(user.uid, taskId, { columnId: col, position, done: column.isDone });
      }
    } catch (err) {
      setDrag(null);
      toast(errorMessage(err), "error");
    }
  }

  const activeTask = activeId && !isCol(activeId) ? tasksById.get(rawId(activeId)) : undefined;
  const activeColumn = activeId && isCol(activeId) ? columnsById.get(rawId(activeId)) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={(e) => void onDragEnd(e)}
      onDragCancel={() => { setDrag(null); setActiveId(null); }}
    >
      <div className="-mx-4 flex h-[calc(100vh-12rem)] min-h-[24rem] snap-x gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        <SortableContext items={colOrder.map((id) => `col:${id}`)} strategy={horizontalListSortingStrategy}>
          {colOrder.map((id) => {
            const c = columnsById.get(id);
            return c ? <ColumnView key={id} column={c} taskIds={items[id] ?? []} /> : null;
          })}
        </SortableContext>
        {canManage && <AddColumn />}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCardBody task={activeTask} overlay /> : activeColumn ? <ColumnPreview column={activeColumn} taskIds={items[activeColumn.id] ?? []} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
