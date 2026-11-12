import { useState } from "react";
import { MailCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { errorMessage } from "@/lib/api";
import { Alert, Button } from "@/components/ui";
import { AuthLayout } from "./AuthLayout";

/** Shown to signed-in users who haven't clicked the verification link yet. */
export function VerifyEmailPage() {
  const { user, resendVerification, refreshVerification, signOut } = useAuth();
  const [busy, setBusy] = useState<"resend" | "check" | null>(null);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const act = async (kind: "resend" | "check") => {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === "resend") {
        await resendVerification();
        setMsg({ tone: "info", text: "Sent. Check your inbox and spam folder." });
      } else {
        await refreshVerification();
        setMsg({ tone: "info", text: "Not verified yet. Click the link in the email, then try again." });
      }
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthLayout title="Verify your email" subtitle={<>We sent a link to <strong>{user?.email}</strong>.</>}>
      <div className="space-y-5">
        <div className="flex gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900 dark:bg-brand-950/60 dark:text-brand-100">
          <MailCheck className="h-5 w-5 shrink-0" aria-hidden />
          <p>Open the email from Crewboard and click the link to activate your account. Then come back here.</p>
        </div>
        {msg && <Alert tone={msg.tone === "info" ? "info" : undefined}>{msg.text}</Alert>}
        <Button className="w-full" loading={busy === "check"} onClick={() => void act("check")}>I've verified, continue</Button>
        <Button className="w-full" variant="secondary" loading={busy === "resend"} onClick={() => void act("resend")}>Resend email</Button>
        <button type="button" onClick={() => void signOut()} className="block w-full text-center text-sm font-semibold text-brand-600 dark:text-brand-400">
          Sign out
        </button>
      </div>
    </AuthLayout>
  );
}
