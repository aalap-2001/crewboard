import { useState } from "react";
import clsx from "clsx";
import { Check, Plus, Tag, UserPlus } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import type { LabelColor, TaskDoc } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { LabelChip, LABEL_CLASSES } from "@/components/chips";
import { Popover } from "@/components/Popover";
import { useBoard } from "@/components/board/BoardContext";
import { ColorPicker, useLabelActions } from "@/components/board/BoardSettingsModal";
import { useTaskUpdate } from "./useTaskUpdate";

const pillBtn =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";

export function AssigneePicker({ task }: { task: TaskDoc }) {
  const { members, usersById } = useBoard();
  const { user } = useSignedIn();
  const save = useTaskUpdate(task.id);
  const [q, setQ] = useState("");
  const toggle = (uid: string) =>
    void save({ assigneeIds: task.assigneeIds.includes(uid) ? task.assigneeIds.filter((x) => x !== uid) : [...task.assigneeIds, uid] });
  const options = members.filter((m) => m.active && (!q || m.displayName.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {task.assigneeIds.map((id) => {
        const u = usersById.get(id);
        return (
          <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2.5 text-sm dark:bg-slate-800">
            <Avatar name={u?.displayName ?? "?"} url={u?.avatarUrl} seed={id} size="sm" />
            {u?.displayName ?? "Former teammate"}
          </span>
        );
      })}
      <Popover
        label="Change assignees"
        width="w-72"
        buttonClassName={pillBtn}
        buttonContent={<><UserPlus className="h-4 w-4" aria-hidden />{task.assigneeIds.length ? "Edit" : "Assign"}</>}
      >
        {() => (
          <div>
            <input
              autoFocus
              type="search"
              aria-label="Search board members"
              placeholder="Search board members"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mb-1 w-full rounded-lg border-0 bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:ring-slate-700"
            />
            <ul className="max-h-64 overflow-y-auto" role="listbox" aria-multiselectable="true" aria-label="Board members">
              {options.map((m) => {
                const on = task.assigneeIds.includes(m.uid);
                return (
                  <li key={m.uid} role="option" aria-selected={on}>
                    <button
                      type="button"
                      onClick={() => toggle(m.uid)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Avatar name={m.displayName} url={m.avatarUrl} seed={m.uid} size="sm" />
                      <span className="flex-1 truncate">{m.displayName}{m.uid === user.uid && " (you)"}</span>
                      {on && <Check className="h-4 w-4 text-brand-600" aria-hidden />}
                    </button>
                  </li>
                );
              })}
              {options.length === 0 && <li className="px-2 py-3 text-sm text-slate-500">No board members match.</li>}
            </ul>
          </div>
        )}
      </Popover>
      {!task.assigneeIds.includes(user.uid) && (
        <button type="button" className={clsx(pillBtn, "text-brand-700 dark:text-brand-300")} onClick={() => void save({ assigneeIds: [...task.assigneeIds, user.uid] })}>
          Assign to me
        </button>
      )}
    </div>
  );
}

export function LabelPicker({ task }: { task: TaskDoc }) {
  const { board } = useBoard();
  const save = useTaskUpdate(task.id);
  const labelActions = useLabelActions();
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("sky");
  const current = task.labelIds.map((id) => board.labels.find((l) => l.id === id)).filter((l) => !!l);
  const toggle = (id: string) =>
    void save({ labelIds: task.labelIds.includes(id) ? task.labelIds.filter((x) => x !== id) : [...task.labelIds, id] });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {current.map((l) => <LabelChip key={l.id} label={l} />)}
      <Popover label="Change labels" width="w-72" buttonClassName={pillBtn} buttonContent={<><Tag className="h-4 w-4" aria-hidden />{current.length ? "Edit" : "Add label"}</>}>
        {() => (
          <div>
            <ul className="max-h-56 overflow-y-auto">
              {board.labels.map((l) => {
                const on = task.labelIds.includes(l.id);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(l.id)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className={clsx("h-3 w-3 rounded-full", LABEL_CLASSES[l.color].dot)} aria-hidden />
                      <span className="flex-1 truncate">{l.name}</span>
                      {on && <Check className="h-4 w-4 text-brand-600" aria-hidden />}
                    </button>
                  </li>
                );
              })}
              {board.labels.length === 0 && <li className="px-2 py-2 text-sm text-slate-500">This board has no labels yet.</li>}
            </ul>
            <form
              className="mt-1 space-y-2 border-t border-slate-200 p-2 dark:border-slate-700"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim()) return;
                const label = await labelActions.add(name.trim(), color);
                setName("");
                await save({ labelIds: [...task.labelIds, label.id] });
              }}
            >
              <input
                aria-label="New label name"
                placeholder="New label"
                value={name}
                maxLength={30}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border-0 bg-slate-50 px-3 py-1.5 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:ring-slate-700"
              />
              <div className="flex items-center justify-between gap-2">
                <ColorPicker value={color} onChange={setColor} />
                <button type="submit" disabled={!name.trim()} aria-label="Create label" className="rounded-md bg-brand-600 p-1.5 text-white disabled:opacity-50">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </Popover>
    </div>
  );
}
