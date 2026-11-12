import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { ALLOWED_DOMAINS, isAllowedEmail, useAuth } from "@/auth/AuthProvider";
import { errorMessage } from "@/lib/api";
import { Alert, Button, TextField } from "@/components/ui";
import { AuthLayout } from "./AuthLayout";

const MIN_LENGTH = 8;
const domains = ALLOWED_DOMAINS.map((d) => "@" + d).join(" or ");

export function SignUpPage() {
  const { status, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "signedIn" || status === "unverified") return <Navigate to="/" replace />;

  const badDomain = email.includes("@") && !isAllowedEmail(email);
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ok = name.trim() && isAllowedEmail(email) && password.length >= MIN_LENGTH && password === confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await signUp(name, email, password);
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(
        code === "auth/email-already-in-use"
          ? "An account with this email already exists. Sign in or reset your password."
          : code === "crewboard/domain"
            ? `Use your ${domains} email.`
            : errorMessage(err)
      );
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle={`Use your ${domains} work email.`}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextField label="Full name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <TextField
          label="Work email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={badDomain ? `Only ${domains} addresses can sign up.` : null}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={`At least ${MIN_LENGTH} characters.`}
          error={tooShort ? `Use at least ${MIN_LENGTH} characters.` : null}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "Passwords don't match." : null}
        />
        <Button type="submit" loading={busy} disabled={!ok} className="w-full">Create account</Button>
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-600 dark:text-brand-400">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
