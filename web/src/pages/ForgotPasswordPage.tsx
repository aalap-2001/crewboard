import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { appUrl } from "@/auth/AuthProvider";
import { errorMessage } from "@/lib/api";
import { Alert, Button, TextField } from "@/components/ui";
import { AuthLayout } from "./AuthLayout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      try {
        await sendPasswordResetEmail(auth, email.trim(), { url: appUrl("/login") });
      } catch (err) {
        // Don't reveal whether an account exists.
        if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
      }
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email">
        <div className="flex gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900 dark:bg-brand-950/60 dark:text-brand-100">
          <MailCheck className="h-5 w-5 shrink-0" aria-hidden />
          <p>
            If <strong>{email.trim()}</strong> has a Crewboard account, a reset link is on its way. The link works for 1 hour.
          </p>
        </div>
        <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-brand-600 dark:text-brand-400">Back to sign in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your work email and we'll send you a link to choose a new password.">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" loading={busy} disabled={!email.trim()} className="w-full">Send reset link</Button>
        <Link to="/login" className="block text-center text-sm font-semibold text-brand-600 dark:text-brand-400">Back to sign in</Link>
      </form>
    </AuthLayout>
  );
}
