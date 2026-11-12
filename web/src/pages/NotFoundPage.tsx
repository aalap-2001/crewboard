import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { StateMessage } from "@/components/ui";

export function NotFoundPage() {
  return (
    <StateMessage
      icon={Compass}
      title="This page doesn't exist"
      body="The link may be old, or the page was moved."
      action={<Link to="/" className="text-sm font-semibold text-brand-600 dark:text-brand-400">Go to your boards</Link>}
    />
  );
}
