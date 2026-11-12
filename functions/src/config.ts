import { defineSecret, defineString } from "firebase-functions/params";

/** Pick the region closest to your team. Keep web/.env VITE_FUNCTIONS_REGION in sync. */
export const REGION = "us-central1";

export const SMTP_HOST = defineSecret("SMTP_HOST");
export const SMTP_PORT = defineSecret("SMTP_PORT");
export const SMTP_USER = defineSecret("SMTP_USER");
export const SMTP_PASS = defineSecret("SMTP_PASS");
export const SMTP_FROM = defineSecret("SMTP_FROM");

/** Every function that sends email must list these in its `secrets` option. */
export const SMTP_SECRETS = [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM];

export const APP_URL = defineString("APP_URL", {
  description: "Public URL of the Crewboard web app, e.g. https://your-project.web.app",
});

export function appUrl(path = ""): string {
  return APP_URL.value().replace(/\/+$/, "") + path;
}

/** IANA time zone for the 9:00 AM daily digest and its idea of "today", e.g. "Europe/London". */
export const DIGEST_TIMEZONE = defineString("DIGEST_TIMEZONE", {
  description: "IANA time zone for the 9:00 AM daily digest, e.g. America/New_York, Europe/London, Asia/Singapore",
});
