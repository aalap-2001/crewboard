import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { errorMessage } from "@/lib/api";
import { Alert, Button, FullPageSpinner, TextField } from "@/components/ui";
import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  const { status, signIn, notice } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "signedIn") return <Navigate to={from} replace />;
  if (status === "loading" && !busy) return <FullPageSpinner />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Crewboard accounts are created by your team's admin.">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {notice && !error && <Alert tone="info">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link to="/forgot-password" className="mt-2 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" loading={busy} disabled={!email || !password} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
