import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthProvider";
import type { Role } from "@/lib/types";
import { FullPageSpinner, StateMessage } from "@/components/ui";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "signedOut") return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useAuth();
  if (!role || !roles.includes(role)) {
    return (
      <StateMessage
        icon={ShieldAlert}
        title="You don't have access to this page"
        body="Ask a Crewboard admin if you think you should."
      />
    );
  }
  return <>{children}</>;
}
