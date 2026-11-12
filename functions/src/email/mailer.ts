import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "firebase-functions/v2";
import { SMTP_FROM, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_USER } from "../config";
import { BRAND } from "./brand";
import type { RenderedEmail } from "./render";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(SMTP_PORT.value());
    const user = SMTP_USER.value();
    transporter = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port,
      secure: port === 465,
      auth: user && user !== "none" ? { user, pass: SMTP_PASS.value() } : undefined,
    });
  }
  return transporter;
}

/** Accepts "crew@x.com" or "Anything <crew@x.com>" and returns the bare address. */
function fromAddress(): string {
  const raw = SMTP_FROM.value().trim();
  const m = raw.match(/<([^>]+)>/);
  return m ? m[1] : raw;
}

/** Sends a branded email from "Crewboard <SMTP_FROM>". */
export async function sendEmail(to: string, email: RenderedEmail): Promise<void> {
  await getTransporter().sendMail({
    from: { name: BRAND.name, address: fromAddress() },
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  logger.info("Email sent", { to, subject: email.subject });
}
