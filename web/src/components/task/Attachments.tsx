import { useState, type FormEvent } from "react";
import { ExternalLink, Link2, Trash2 } from "lucide-react";
import { newId } from "@/lib/firestore";
import type { TaskDoc } from "@/lib/types";
import { Button, TextField } from "@/components/ui";
import { useTaskUpdate } from "./useTaskUpdate";

function parseUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

export function Attachments({ task }: { task: TaskDoc }) {
  const save = useTaskUpdate(task.id);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const parsed = parseUrl(url);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!parsed) return;
    const ok = await save({ attachments: [...task.attachments, { id: newId(), url: parsed.toString(), title: title.trim() || parsed.hostname }] });
    if (ok) { setUrl(""); setTitle(""); setAdding(false); }
  }

  return (
    <section aria-labelledby="att-h">
      <div className="mb-2 flex items-center justify-between">
        <h3 id="att-h" className="font-sans text-sm font-semibold">Links</h3>
        {!adding && <Button size="sm" variant="ghost" icon={Link2} onClick={() => setAdding(true)}>Add link</Button>}
      </div>
      {task.attachments.length > 0 && (
        <ul className="space-y-1">
          {task.attachments.map((a) => (
            <li key={a.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <Link2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                {a.title}
                <span className="ml-2 text-xs font-normal text-slate-500">{parseUrl(a.url)?.hostname}</span>
                <ExternalLink className="ml-1 inline h-3 w-3" aria-label="(opens in new tab)" />
              </a>
              <button
                onClick={() => void save({ attachments: task.attachments.filter((x) => x.id !== a.id) })}
                aria-label={`Remove link ${a.title}`}
                className="rounded p-1 text-slate-400 opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {task.attachments.length === 0 && !adding && <p className="text-sm text-slate-500">Link docs, designs or pull requests.</p>}
      {adding && (
        <form onSubmit={add} className="mt-2 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <TextField label="URL" type="url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" error={url && !parsed ? "Enter a full link starting with https://" : null} />
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} hint="Optional. Defaults to the site name." />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setAdding(false); setUrl(""); setTitle(""); }}>Cancel</Button>
            <Button size="sm" type="submit" disabled={!parsed}>Add link</Button>
          </div>
        </form>
      )}
    </section>
  );
}
