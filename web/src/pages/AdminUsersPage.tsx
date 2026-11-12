import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Mail, Search, UserPlus, Users } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { watchUsers } from "@/lib/firestore";
import { api, errorMessage } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role, type UserDoc } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Alert, Badge, Button, SelectField, Spinner, StateMessage, TextField } from "@/components/ui";

type StatusFilter = "all" | "active" | "deactivated";

export function AdminUsersPage() {
  const { profile: me } = useSignedIn();
  const toast = useToast();
  const [users, setUsers] = useState<UserDoc[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, setPending] = useState<Record<string, string>>({}); // uid → action label
  const [confirmTarget, setConfirmTarget] = useState<UserDoc | null>(null);

  useEffect(() => watchUsers(setUsers, (err) => setLoadError(errorMessage(err))), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users ?? []).filter(
      (u) =>
        (roleFilter === "all" || u.role === roleFilter) &&
        (statusFilter === "all" || (statusFilter === "active" ? u.active : !u.active)) &&
        (!q || u.displayName.toLowerCase().includes(q) || u.email.includes(q))
    );
  }, [users, search, roleFilter, statusFilter]);

  async function run(uid: string, label: string, fn: () => Promise<unknown>, success: string) {
    setPending((p) => ({ ...p, [uid]: label }));
    try {
      await fn();
      toast(success);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setPending(({ [uid]: _, ...rest }) => rest);
    }
  }

  const changeRole = (u: UserDoc, role: Role) =>
    run(u.uid, "role", () => api.setUserRole({ uid: u.uid, role }), `${u.displayName} is now ${ROLE_LABELS[role].toLowerCase()}`);
  const setActive = (u: UserDoc, active: boolean) =>
    run(u.uid, "active", () => api.setUserActive({ uid: u.uid, active }), `${u.displayName} ${active ? "reactivated" : "deactivated"}`);
  const resend = (u: UserDoc) =>
    run(u.uid, "invite", () => api.resendInvite({ uid: u.uid }), `Invite resent to ${u.email}`);

  const activeCount = users?.filter((u) => u.active).length ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">People</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {users ? `${activeCount} active ${activeCount === 1 ? "member" : "members"}` : "Invite your team and manage their roles."}
          </p>
        </div>
        <Button icon={UserPlus} onClick={() => setInviteOpen(true)}>Invite people</Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <label htmlFor="user-search" className="sr-only">Search people</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id="user-search"
            type="search"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-lg border-0 bg-white py-2.5 pl-9 pr-3 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-500 dark:bg-slate-900 dark:ring-slate-700"
          />
        </div>
        <SelectField label="Role" hideLabel value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "all")}>
          <option value="all">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </SelectField>
        <SelectField label="Status" hideLabel value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
          <option value="all">Everyone</option>
        </SelectField>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        {loadError ? (
          <StateMessage icon={AlertTriangle} tone="error" title="People couldn't load" body={loadError} />
        ) : !users ? (
          <div className="grid place-items-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <StateMessage
            icon={Users}
            title={users.length <= 1 ? "Invite your first teammate" : "No one matches these filters"}
            body={users.length <= 1 ? "They'll get an email with a link to set their password." : "Try a different search or filter."}
            action={users.length <= 1 ? <Button icon={UserPlus} onClick={() => setInviteOpen(true)}>Invite people</Button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((u) => {
              const isMe = u.uid === me.uid;
              const busy = pending[u.uid];
              return (
                <li key={u.uid} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center sm:gap-4 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={u.displayName} url={u.avatarUrl} seed={u.uid} className={u.active ? "" : "opacity-50"} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900 dark:text-white">
                        <span className="truncate">{u.displayName}</span>
                        {isMe && <Badge tone="brand">You</Badge>}
                        {!u.active && <Badge tone="muted">Deactivated</Badge>}
                      </p>
                      <p className="truncate text-sm text-slate-500">{u.email}</p>
                      <p className="text-xs text-slate-400">Invite sent {relativeTime(u.lastInviteSentAt)}</p>
                    </div>
                  </div>

                  <SelectField
                    label={`Role for ${u.displayName}`}
                    hideLabel
                    value={u.role}
                    disabled={isMe || !u.active || !!busy}
                    title={isMe ? "You can't change your own role" : undefined}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </SelectField>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {u.active && (
                      <Button size="sm" variant="ghost" icon={Mail} loading={busy === "invite"} disabled={!!busy} onClick={() => resend(u)}>
                        Resend invite
                      </Button>
                    )}
                    {!isMe &&
                      (u.active ? (
                        <Button size="sm" variant="secondary" disabled={!!busy} loading={busy === "active"} onClick={() => setConfirmTarget(u)}>
                          Deactivate
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled={!!busy} loading={busy === "active"} onClick={() => setActive(u, true)}>
                          Reactivate
                        </Button>
                      ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <Modal
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title={`Deactivate ${confirmTarget?.displayName ?? ""}?`}
        description="They'll be signed out everywhere and can't sign in until you reactivate them. Their tasks and comments stay."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmTarget) void setActive(confirmTarget, false);
                setConfirmTarget(null);
              }}
            >
              Deactivate
            </Button>
          </>
        }
      />
    </>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setRole("member");
      setError(null);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.inviteUser({ name: name.trim(), email: email.trim(), role });
      if (res.emailSent) toast(`Invite sent to ${email.trim()}`);
      else toast(`${name.trim()} was added, but the email didn't send. Use Resend invite once SMTP is working.`, "error");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite someone to Crewboard" description="They'll get a welcome email with a link to set their password.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" required />
        <TextField label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
        <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)} hint={ROLE_DESCRIPTIONS[role]}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </SelectField>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!name.trim() || !email.trim()}>Send invite</Button>
        </div>
      </form>
    </Modal>
  );
}
