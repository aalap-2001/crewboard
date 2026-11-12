import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSignedIn } from "@/auth/AuthProvider";
import { updateMyProfile } from "@/lib/firestore";
import { api, errorMessage } from "@/lib/api";
import { ROLE_LABELS, type NotificationPrefs } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Badge, Button, Switch, TextField } from "@/components/ui";
import { useToast } from "@/components/Toast";

const PREF_COPY: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: "emailOnAssignment", label: "Email me when I'm assigned a task", description: "Sent right away, with a link to the task." },
  { key: "emailOnMention", label: "Email me when someone @mentions me", description: "Includes a snippet of the comment." },
  { key: "dailyDigest", label: "Daily digest", description: "“Your Crewboard day” at 9:00 AM: tasks assigned to you that are due today or overdue. Skipped on days with nothing due." },
];

export function ProfilePage() {
  const { profile, role, user } = useSignedIn();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [prefs, setPrefs] = useState<NotificationPrefs>(profile.notificationPrefs);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Re-sync if the profile changes elsewhere (another tab, an admin).
  useEffect(() => {
    setDisplayName(profile.displayName);
    setAvatarUrl(profile.avatarUrl ?? "");
    setPrefs(profile.notificationPrefs);
  }, [profile]);

  const nameError = displayName.trim().length === 0 ? "Enter your name." : displayName.trim().length > 80 ? "Keep it under 80 characters." : null;
  const urlError = avatarUrl.trim() && !/^https:\/\/.+/.test(avatarUrl.trim()) ? "Use an image link that starts with https://" : null;

  const dirty = useMemo(
    () =>
      displayName.trim() !== profile.displayName ||
      (avatarUrl.trim() || null) !== profile.avatarUrl ||
      (Object.keys(prefs) as (keyof NotificationPrefs)[]).some((k) => prefs[k] !== profile.notificationPrefs[k]),
    [displayName, avatarUrl, prefs, profile]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (nameError || urlError) return;
    setSaving(true);
    try {
      await updateMyProfile(user.uid, { displayName: displayName.trim(), avatarUrl: avatarUrl.trim() || null, notificationPrefs: prefs });
      toast("Profile saved");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function sendReset() {
    setSendingReset(true);
    try {
      await api.requestPasswordReset({ email: profile.email });
      toast(`Password reset link sent to ${profile.email}`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSendingReset(false);
    }
  }

  const section = "rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6 dark:bg-slate-900 dark:ring-slate-800";

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6" noValidate>
      <div className="flex items-center gap-4">
        <Avatar name={displayName || profile.displayName} url={urlError ? null : avatarUrl.trim() || null} seed={profile.uid} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{profile.displayName}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="truncate">{profile.email}</span>
            <Badge tone="brand">{ROLE_LABELS[role]}</Badge>
          </p>
        </div>
      </div>

      <section className={section} aria-labelledby="profile-h">
        <h2 id="profile-h" className="text-base font-semibold">Profile</h2>
        <div className="mt-4 grid gap-4">
          <TextField label="Display name" value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} error={nameError} autoComplete="name" />
          <TextField
            label="Avatar image link"
            type="url"
            placeholder="https://…"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            error={urlError}
            hint="Optional. Leave blank to show your initials."
          />
        </div>
      </section>

      <section className={section} aria-labelledby="notif-h">
        <h2 id="notif-h" className="text-base font-semibold">Email notifications</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">In-app notifications are always on. Choose which ones also arrive by email.</p>
        <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          {PREF_COPY.map((p) => (
            <Switch
              key={p.key}
              label={p.label}
              description={p.description}
              checked={prefs[p.key]}
              onChange={(v) => setPrefs((cur) => ({ ...cur, [p.key]: v }))}
            />
          ))}
        </div>
      </section>

      <section className={section} aria-labelledby="pw-h">
        <h2 id="pw-h" className="text-base font-semibold">Password</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">We'll email you a link to choose a new password.</p>
        <Button variant="secondary" className="mt-4" loading={sendingReset} onClick={sendReset}>Email me a reset link</Button>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" loading={saving} disabled={!dirty || !!nameError || !!urlError} className="shadow-lg">
          Save changes
        </Button>
      </div>
    </form>
  );
}
