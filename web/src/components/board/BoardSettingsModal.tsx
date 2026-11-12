import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Trash2, X } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { deleteBoard, newId, updateBoard } from "@/lib/firestore";
import { errorMessage } from "@/lib/api";
import { useUsers } from "@/lib/users";
import { LABEL_COLORS, type BoardLabel, type LabelColor } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { LABEL_CLASSES, LabelChip } from "@/components/chips";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Badge, Button, TextField } from "@/components/ui";
import { MemberChecklist } from "./MemberChecklist";
import { useBoard } from "./BoardContext";

export function ColorPicker({ value, onChange }: { value: LabelColor; onChange: (c: LabelColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Label color" className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={clsx("h-6 w-6 rounded-full ring-offset-2 dark:ring-offset-slate-900", LABEL_CLASSES[c].dot, value === c && "ring-2 ring-slate-900 dark:ring-white")}
        />
      ))}
    </div>
  );
}

export function useLabelActions() {
  const { board } = useBoard();
  return {
    add: async (name: string, color: LabelColor): Promise<BoardLabel> => {
      const label = { id: newId(), name, color };
      await updateBoard(board.id, { labels: [...board.labels, label] });
      return label;
    },
    save: (labels: BoardLabel[]) => updateBoard(board.id, { labels }),
  };
}

export function BoardSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { board, members, canManage } = useBoard();
  const { user } = useSignedIn();
  const { users } = useUsers();
  const toast = useToast();
  const navigate = useNavigate();
  const labelActions = useLabelActions();

  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);
  const [savingDetails, setSavingDetails] = useState(false);
  const [adding, setAdding] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<LabelColor>("indigo");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setName(board.name);
      setDescription(board.description);
      setAdding([]);
      setConfirmDelete(false);
    }
  }, [open, board.name, board.description]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast(success);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  async function saveDetails(e: FormEvent) {
    e.preventDefault();
    setSavingDetails(true);
    await run(() => updateBoard(board.id, { name: name.trim(), description: description.trim() }), "Board details saved");
    setSavingDetails(false);
  }

  const nonMembers = (users ?? []).filter((u) => u.active && !board.memberIds.includes(u.uid));

  const removeMember = (uid: string) => {
    if (board.memberIds.length <= 1) return toast("A board needs at least one member.", "error");
    void run(
      () => updateBoard(board.id, { memberIds: board.memberIds.filter((m) => m !== uid) }),
      uid === user.uid ? "You left the board" : "Member removed. Their assignments on this board were cleared."
    ).then(() => uid === user.uid && navigate("/"));
  };

  const section = "border-t border-slate-200 pt-5 dark:border-slate-800";

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Board settings">
      <div className="space-y-6">
        {canManage && (
          <form onSubmit={saveDetails} className="space-y-4">
            <TextField label="Board name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                loading={savingDetails}
                disabled={!name.trim() || (name.trim() === board.name && description.trim() === board.description)}
              >
                Save details
              </Button>
            </div>
          </form>
        )}

        <section className={clsx(canManage && section)} aria-labelledby="members-h">
          <h3 id="members-h" className="font-sans text-sm font-semibold">Members ({members.length})</h3>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((m) => (
              <li key={m.uid} className="flex items-center gap-3 py-2">
                <Avatar name={m.displayName} url={m.avatarUrl} seed={m.uid} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {m.displayName} {m.uid === user.uid && <span className="text-slate-500">(you)</span>}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{m.email}</span>
                </span>
                {!m.active && <Badge tone="muted">Deactivated</Badge>}
                {canManage && (
                  <Button size="sm" variant="ghost" aria-label={`Remove ${m.displayName}`} onClick={() => removeMember(m.uid)}>
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {canManage && nonMembers.length > 0 && (
            <div className="mt-3 space-y-3">
              <MemberChecklist label="Add people" people={nonMembers} selected={adding} onChange={setAdding} />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!adding.length}
                  onClick={() =>
                    void run(() => updateBoard(board.id, { memberIds: [...board.memberIds, ...adding] }), `${adding.length} added to the board`).then(() =>
                      setAdding([])
                    )
                  }
                >
                  Add {adding.length || ""} to board
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className={section} aria-labelledby="labels-h">
          <h3 id="labels-h" className="font-sans text-sm font-semibold">Labels</h3>
          <p className="text-sm text-slate-500">Anyone on the board can manage labels.</p>
          <ul className="mt-3 space-y-2">
            {board.labels.map((l) => (
              <li key={l.id} className="flex items-center gap-3">
                <LabelChip label={l} />
                <span className="flex-1" />
                <ColorPicker
                  value={l.color}
                  onChange={(c) => void labelActions.save(board.labels.map((x) => (x.id === l.id ? { ...x, color: c } : x)))}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete label ${l.name}`}
                  onClick={() => void run(() => labelActions.save(board.labels.filter((x) => x.id !== l.id)), `Label “${l.name}” deleted`)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
            {board.labels.length === 0 && <li className="text-sm text-slate-500">No labels yet.</li>}
          </ul>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newLabel.trim()) return;
              void run(() => labelActions.add(newLabel.trim(), newColor), `Label “${newLabel.trim()}” added`).then(() => setNewLabel(""));
            }}
          >
            <TextField label="New label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={30} className="min-w-[10rem] flex-1" />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <Button type="submit" size="sm" variant="secondary" disabled={!newLabel.trim()}>Add label</Button>
          </form>
        </section>

        {canManage && (
          <section className={section} aria-labelledby="danger-h">
            <h3 id="danger-h" className="font-sans text-sm font-semibold text-red-700 dark:text-red-400">Delete board</h3>
            <p className="mt-1 text-sm text-slate-500">Deletes the board and every task, comment and activity entry on it. This can't be undone.</p>
            {confirmDelete ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    void run(async () => {
                      await deleteBoard(board.id);
                      onClose();
                      navigate("/");
                    }, `Board “${board.name}” deleted`)
                  }
                >
                  Yes, delete “{board.name}”
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Keep board</Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" className="mt-3" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                Delete board
              </Button>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
