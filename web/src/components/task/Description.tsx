import { useEffect, useState } from "react";
import clsx from "clsx";
import { parseMentions } from "@/lib/mentions";
import type { TaskDoc, UserDoc } from "@/lib/types";
import { Markdown } from "@/components/Markdown";
import { MentionTextarea } from "@/components/MentionTextarea";
import { useBoard } from "@/components/board/BoardContext";
import { Button } from "@/components/ui";
import { useTaskUpdate } from "./useTaskUpdate";

export function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder,
  rows = 6,
  onSubmitShortcut,
  autoFocus,
  people,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  rows?: number;
  onSubmitShortcut?: () => void;
  autoFocus?: boolean;
  /** Enables @mention autocomplete for these people. */
  people?: UserDoc[];
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const tabCls = (t: string) =>
    clsx("rounded-md px-2.5 py-1 text-xs font-semibold", tab === t ? "bg-white shadow-sm dark:bg-slate-700" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200");
  return (
    <div className="rounded-xl ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-brand-500 dark:ring-slate-700">
      <div className="flex items-center gap-1 rounded-t-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label={`${label} editor`}>
        <button type="button" role="tab" aria-selected={tab === "write"} className={tabCls("write")} onClick={() => setTab("write")}>Write</button>
        <button type="button" role="tab" aria-selected={tab === "preview"} className={tabCls("preview")} onClick={() => setTab("preview")}>Preview</button>
        <span className="ml-auto pr-2 text-[11px] text-slate-500">{people ? "Type @ to mention · " : ""}Markdown supported</span>
      </div>
      {tab === "write" ? (
        <MentionTextarea
          aria-label={label}
          autoFocus={autoFocus}
          value={value}
          rows={rows}
          placeholder={placeholder}
          people={people ?? []}
          allowAll={!!people}
          onChange={onChange}
          onKeyDown={(e) => {
            if (onSubmitShortcut && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmitShortcut();
            }
          }}
          className="block w-full resize-y rounded-b-xl border-0 bg-white p-3 text-sm focus:ring-0 dark:bg-slate-900"
        />
      ) : (
        <div className="min-h-[6rem] rounded-b-xl bg-white p-3 dark:bg-slate-900">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-slate-500">Nothing to preview.</p>}
        </div>
      )}
    </div>
  );
}

export function Description({ task }: { task: TaskDoc }) {
  const save = useTaskUpdate(task.id);
  const { members } = useBoard();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.description);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(task.description);
  }, [task.description, editing]);

  const commit = async () => {
    setBusy(true);
    // mentionedUserIds = everyone ever mentioned on this task (description or comments); used by My Tasks.
    const mentioned = parseMentions(draft, task.memberIds);
    const mentionedUserIds = Array.from(new Set([...task.mentionedUserIds, ...mentioned])).filter((id) => task.memberIds.includes(id));
    if (await save({ description: draft, mentionedUserIds })) setEditing(false);
    setBusy(false);
  };

  return (
    <section aria-labelledby="desc-h">
      <div className="mb-2 flex items-center justify-between">
        <h3 id="desc-h" className="font-sans text-sm font-semibold">Description</h3>
        {!editing && task.description && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>}
      </div>
      {editing ? (
        <>
          <MarkdownEditor label="Description" value={draft} onChange={setDraft} rows={8} autoFocus people={members} onSubmitShortcut={() => void commit()} placeholder="Add context, links, acceptance criteria…" />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setDraft(task.description); setEditing(false); }}>Cancel</Button>
            <Button size="sm" loading={busy} disabled={draft === task.description} onClick={() => void commit()}>Save description</Button>
          </div>
        </>
      ) : task.description ? (
        <Markdown>{task.description}</Markdown>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-4 text-left text-sm text-slate-500 hover:border-brand-400 hover:text-slate-700 dark:border-slate-700 dark:hover:text-slate-300"
        >
          Add a description
        </button>
      )}
    </section>
  );
}
