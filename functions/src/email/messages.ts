import { renderEmail, type RenderedEmail } from "./render";
import type { Role } from "../lib/types";

const roleWithArticle: Record<Role, string> = {
  admin: "an admin",
  manager: "a manager",
  member: "a member",
};

export function welcomeEmail(p: { name: string; inviterName: string; role: Role; setupUrl: string }): RenderedEmail {
  return renderEmail({
    subject: "Welcome to Crewboard — set up your account",
    preheader: `${p.inviterName} invited you to Crewboard. Choose a password to get started.`,
    heading: "Welcome to Crewboard",
    paragraphs: [
      `Hi ${p.name},`,
      `${p.inviterName} added you to your team's Crewboard as ${roleWithArticle[p.role]}. Crewboard is where your crew plans work, picks up tasks and keeps everything moving.`,
      "Choose a password to finish setting up your account.",
    ],
    cta: { label: "Set up my account", url: p.setupUrl },
    footnote:
      "This link works for 1 hour. If it expires, ask your admin to resend the invite. If you weren't expecting this, you can ignore this email.",
  });
}

export function passwordResetEmail(p: { name: string; resetUrl: string }): RenderedEmail {
  return renderEmail({
    subject: "Reset your Crewboard password",
    preheader: "Use this link to choose a new Crewboard password.",
    heading: "Reset your password",
    paragraphs: [`Hi ${p.name},`, "We got a request to reset your Crewboard password. Choose a new one below."],
    cta: { label: "Choose a new password", url: p.resetUrl },
    footnote: "This link works for 1 hour. If you didn't ask for a reset, ignore this email — your password stays the same.",
  });
}

const PREFS_FOOTNOTE = "You can change which emails you get under Profile and notifications in Crewboard.";

export function assignmentEmail(p: {
  name: string;
  actorName: string;
  taskTitle: string;
  boardName: string;
  snippet: string;
  alsoMentioned: boolean;
  taskUrl: string;
}): RenderedEmail {
  return renderEmail({
    subject: `${p.actorName} assigned you: ${p.taskTitle}`,
    preheader: `On ${p.boardName}${p.alsoMentioned ? " — and mentioned you" : ""}.`,
    heading: "You've been assigned a task",
    paragraphs: [
      `Hi ${p.name},`,
      `${p.actorName} assigned you to “${p.taskTitle}” on the ${p.boardName} board${p.alsoMentioned ? " and mentioned you" : ""}.`,
    ],
    quote: p.snippet || undefined,
    cta: { label: "View task", url: p.taskUrl },
    footnote: PREFS_FOOTNOTE,
  });
}

export function mentionEmail(p: {
  name: string;
  actorName: string;
  taskTitle: string;
  boardName: string;
  snippet: string;
  inComment: boolean;
  taskUrl: string;
}): RenderedEmail {
  return renderEmail({
    subject: `${p.actorName} mentioned you in ${p.taskTitle}`,
    preheader: p.snippet || `On the ${p.boardName} board.`,
    heading: `${p.actorName} mentioned you`,
    paragraphs: [
      `Hi ${p.name},`,
      `${p.actorName} mentioned you ${p.inComment ? "in a comment on" : "in the description of"} “${p.taskTitle}” on the ${p.boardName} board.`,
    ],
    quote: p.snippet || undefined,
    cta: { label: "View task", url: p.taskUrl },
    footnote: PREFS_FOOTNOTE,
  });
}

export interface DigestItem { title: string; boardName: string; dueDate: string; url: string }

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function digestEmail(p: { name: string; overdue: DigestItem[]; dueToday: DigestItem[]; myTasksUrl: string; dateLabel: string }): RenderedEmail {
  const total = p.overdue.length + p.dueToday.length;
  const parts = [
    p.dueToday.length ? `${p.dueToday.length} due today` : "",
    p.overdue.length ? `${p.overdue.length} overdue` : "",
  ].filter(Boolean);
  return renderEmail({
    subject: `Your Crewboard day: ${parts.join(", ")}`,
    preheader: `${total} ${total === 1 ? "task needs" : "tasks need"} your attention today.`,
    heading: `Your Crewboard day — ${p.dateLabel}`,
    paragraphs: [`Good morning ${p.name}, here's what's on your plate.`],
    sections: [
      ...(p.overdue.length
        ? [{ title: `Overdue (${p.overdue.length})`, tone: "danger" as const, items: p.overdue.map((t) => ({ title: t.title, meta: `${t.boardName} · was due ${prettyDate(t.dueDate)}`, url: t.url })) }]
        : []),
      ...(p.dueToday.length
        ? [{ title: `Due today (${p.dueToday.length})`, items: p.dueToday.map((t) => ({ title: t.title, meta: t.boardName, url: t.url })) }]
        : []),
    ],
    cta: { label: "Open My Tasks", url: p.myTasksUrl },
    footnote: "You're getting this because the daily digest is on. Turn it off under Profile and notifications.",
  });
}
