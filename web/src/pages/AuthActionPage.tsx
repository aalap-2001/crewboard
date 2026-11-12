import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { applyActionCode, confirmPasswordReset, signInWithEmailAndPassword, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/api";
import { Alert, Button, FullPageSpinner, TextField } from "@/components/ui";
import { AuthLayout } from "./AuthLayout";

const MIN_LENGTH = 8;

/** Branded landing page for invite ("setup") and password-reset links. */
export function AuthActionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = params.get("mode");
  const oobCode = params.get("oobCode") ?? "";
  const isSetup = mode === "setup";
  const isVerify = mode === "verifyEmail";
  const [verified, setVerified] = useState(false);

  const [email, setEmail] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isVerify && oobCode) {
      applyActionCode(auth, oobCode).then(
        async () => {
          await auth.currentUser?.reload();
          setVerified(true);
        },
        (err) => setLinkError(errorMessage(err))
      );
      return;
    }
    if (!oobCode || (mode !== "setup" && mode !== "resetPassword")) {
      setLinkError("This link is incomplete. Open it again from your email.");
      return;
    }
    verifyPasswordResetCode(auth, oobCode).then(setEmail, (err) => setLinkError(errorMessage(err)));
  }, [oobCode, mode, isVerify]);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || password.length < MIN_LENGTH || password !== confirm) return;
    setBusy(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (isVerify && !linkError) {
    if (!verified) return <FullPageSpinner />;
    return (
      <AuthLayout title="Email verified" subtitle="Your Crewboard account is ready.">
        <Button className="w-full" onClick={() => window.location.assign(import.meta.env.BASE_URL)}>Continue to Crewboard</Button>
      </AuthLayout>
    );
  }

  if (linkError) {
    return (
      <AuthLayout title={isVerify ? "This verification link doesn't work" : isSetup ? "This invite link doesn't work" : "This reset link doesn't work"}>
        <Alert>{linkError}</Alert>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          {isSetup ? "Ask your Crewboard admin to resend your invite, or " : "You can "}
          <Link to="/forgot-password" className="font-semibold text-brand-600 dark:text-brand-400">request a new link</Link>.
        </p>
      </AuthLayout>
    );
  }
  if (!email) return <FullPageSpinner />;

  return (
    <AuthLayout
      title={isSetup ? "Set up your account" : "Choose a new password"}
      subtitle={<>For <strong className="text-slate-900 dark:text-white">{email}</strong></>}
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && <Alert>{error}</Alert>}
        <input type="email" autoComplete="username" value={email} readOnly hidden />
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
        <Button type="submit" loading={busy} disabled={password.length < MIN_LENGTH || password !== confirm} className="w-full">
          {isSetup ? "Set password and sign in" : "Save password and sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
