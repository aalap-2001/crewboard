import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSignedIn } from "@/auth/AuthProvider";
import { createBoard } from "@/lib/firestore";
import { errorMessage } from "@/lib/api";
import { useUsers } from "@/lib/users";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Alert, Button, TextField } from "@/components/ui";
import { MemberChecklist } from "./MemberChecklist";

export function NewBoardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSignedIn();
  const { users } = useUsers();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setMemberIds([]);
      setError(null);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await createBoard(user.uid, { name: name.trim(), description: description.trim(), memberIds });
      toast(`Board “${name.trim()}” created`);
      onClose();
      navigate(`/boards/${id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Create a board" description="It starts with Backlog, To Do, In Progress, In Review and Done. You can change the columns later.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextField label="Board name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
        <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} hint="Optional. What this board is for." />
        <MemberChecklist
          label="Members"
          people={(users ?? []).filter((u) => u.active)}
          selected={memberIds}
          onChange={setMemberIds}
          locked={[user.uid]}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>Create board</Button>
        </div>
      </form>
    </Modal>
  );
}
