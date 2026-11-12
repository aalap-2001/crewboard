import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { newId } from "@/lib/firestore";
import type { ChecklistItem, TaskDoc } from "@/lib/types";
import { useTaskUpdate } from "./useTaskUpdate";

function Item({ item, onChange, onRemove }: { item: ChecklistItem; onChange: (i: ChecklistItem) => void; onRemove: () => void }) {
  const [text, setText] = useState(item.text);
  const commitText = () => {
    const t = text.trim();
    if (!t) return setText(item.text);
    if (t !== item.text) onChange({ ...item, text: t });
  };
  return (
    <li className="group flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <input
        type="checkbox"
        checked={item.done}
        aria-label={`Mark “${item.text}” ${item.done ? "not done" : "done"}`}
        onChange={() => onChange({ ...item, done: !item.done })}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <input
        aria-label="Checklist item"
        value={text}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={clsx("min-w-0 flex-1 rounded border-0 bg-transparent px-1 py-0.5 text-sm focus:ring-1 focus:ring-brand-500", item.done && "text-slate-500 line-through")}
      />
      <button onClick={onRemove} aria-label={`Remove “${item.text}”`} className="rounded p-1 text-slate-400 opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

export function Checklist({ task }: { task: TaskDoc }) {
  const save = useTaskUpdate(task.id);
  const [text, setText] = useState("");
  const done = task.checklist.filter((i) => i.done).length;
  const pct = task.checklist.length ? Math.round((done / task.checklist.length) * 100) : 0;
  const setList = (checklist: ChecklistItem[]) => save({ checklist });

  async function add(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (await setList([...task.checklist, { id: newId(), text: t, done: false }])) setText("");
  }

  return (
    <section aria-labelledby="check-h">
      <div className="mb-2 flex items-center justify-between">
        <h3 id="check-h" className="font-sans text-sm font-semibold">Checklist</h3>
        {task.checklist.length > 0 && <span className="text-xs text-slate-500">{done} of {task.checklist.length} done</span>}
      </div>
      {task.checklist.length > 0 && (
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist progress">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <ul>
        {task.checklist.map((item) => (
          <Item
            key={item.id}
            item={item}
            onChange={(next) => void setList(task.checklist.map((i) => (i.id === item.id ? next : i)))}
            onRemove={() => void setList(task.checklist.filter((i) => i.id !== item.id))}
          />
        ))}
      </ul>
      <form onSubmit={add} className="mt-1">
        <label htmlFor="new-check" className="sr-only">Add checklist item</label>
        <input
          id="new-check"
          value={text}
          maxLength={200}
          placeholder="Add an item and press Enter"
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm ring-1 ring-transparent placeholder:text-slate-400 hover:ring-slate-200 focus:ring-2 focus:ring-brand-500 dark:hover:ring-slate-700"
        />
      </form>
    </section>
  );
}
