import { appUrl } from "../config";
import { BRAND } from "./brand";

export interface EmailContent {
  subject: string;
  /** Hidden inbox preview line. */
  preheader: string;
  heading: string;
  /** Plain-text paragraphs; escaped for HTML. */
  paragraphs: string[];
  /** Optional quoted block, e.g. a comment snippet. */
  quote?: string;
  /** Optional linked lists, e.g. digest sections. */
  sections?: EmailSection[];
  cta?: { label: string; url: string };
  footnote?: string;
}

export interface EmailSection {
  title: string;
  tone?: "danger" | "normal";
  items: { title: string; meta: string; url: string }[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Logo lockup: the board icon as a PNG served from the hosted app (email clients block SVG),
 * followed by the wordmark as text so it still reads if images are off.
 */
function logoHtml(): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
  <td style="vertical-align:middle;"><img src="${esc(appUrl("/email-logo.png"))}" width="40" height="40" alt="" style="display:block;border:0;border-radius:11px;"></td>
  <td style="padding-left:12px;vertical-align:middle;font-family:${BRAND.wordmarkFont};font-size:24px;font-weight:800;color:${BRAND.wordmarkInk};letter-spacing:-1px;">${BRAND.name}</td>
</tr></table>`;
}

export function renderEmail(c: EmailContent): RenderedEmail {
  const paragraphs = c.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${BRAND.font};font-size:16px;line-height:1.6;color:${BRAND.body};">${esc(p)}</p>`
    )
    .join("");

  const quote = c.quote
    ? `<div style="margin:0 0 20px;padding:12px 16px;border-left:3px solid ${BRAND.color};background:${BRAND.colorSoft};border-radius:0 6px 6px 0;font-family:${BRAND.font};font-size:15px;line-height:1.55;color:${BRAND.ink};">${esc(c.quote)}</div>`
    : "";

  const sections = (c.sections ?? [])
    .map((sec) => {
      const accent = sec.tone === "danger" ? "#dc2626" : BRAND.color;
      const rows = sec.items
        .map(
          (it) => `
<tr><td style="padding:10px 0;border-top:1px solid #e2e8f0;">
  <a href="${esc(it.url)}" target="_blank" style="font-family:${BRAND.font};font-size:15px;font-weight:700;color:${BRAND.ink};text-decoration:none;">${esc(it.title)}</a>
  <div style="font-family:${BRAND.font};font-size:13px;color:${BRAND.muted};margin-top:2px;">${esc(it.meta)}</div>
</td></tr>`
        )
        .join("");
      return `
<h2 style="margin:8px 0 6px;font-family:${BRAND.font};font-size:14px;font-weight:800;color:${accent};">${esc(sec.title)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${rows}</table>`;
    })
    .join("");

  const cta = c.cta
    ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>
  <td style="border-radius:8px;background:${BRAND.color};">
    <a href="${esc(c.cta.url)}" target="_blank" style="display:inline-block;padding:13px 24px;font-family:${BRAND.font};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(c.cta.label)}</a>
  </td>
</tr></table>
<p style="margin:0 0 16px;font-family:${BRAND.font};font-size:13px;line-height:1.5;color:${BRAND.muted};">Button not working? Paste this link into your browser:<br><a href="${esc(c.cta.url)}" style="color:${BRAND.color};word-break:break-all;">${esc(c.cta.url)}</a></p>`
    : "";

  const footnote = c.footnote
    ? `<p style="margin:16px 0 0;font-family:${BRAND.font};font-size:13px;line-height:1.5;color:${BRAND.muted};">${esc(c.footnote)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(c.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.canvas};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
    <tr><td style="padding:0 4px 20px;">${logoHtml()}</td></tr>
    <tr><td style="background:#ffffff;border-radius:12px;padding:32px 32px 28px;border-top:4px solid ${BRAND.color};">
      <h1 style="margin:0 0 18px;font-family:${BRAND.font};font-size:22px;line-height:1.3;font-weight:800;color:${BRAND.ink};">${esc(c.heading)}</h1>
      ${paragraphs}${quote}${sections}${cta}${footnote}
    </td></tr>
    <tr><td style="padding:20px 4px 0;font-family:${BRAND.font};font-size:12px;line-height:1.5;color:${BRAND.muted};">
      ${BRAND.name} · ${esc(BRAND.tagline)}<br>You received this because you're part of a team on ${BRAND.name}.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

  const text = [
    BRAND.name,
    "=".repeat(BRAND.name.length),
    "",
    c.heading,
    "",
    ...c.paragraphs.flatMap((p) => [p, ""]),
    ...(c.quote ? [`> ${c.quote.replace(/\n/g, "\n> ")}`, ""] : []),
    ...(c.sections ?? []).flatMap((sec) => [
      sec.title.toUpperCase(),
      ...sec.items.flatMap((it) => [`- ${it.title} (${it.meta})`, `  ${it.url}`]),
      "",
    ]),
    ...(c.cta ? [`${c.cta.label}: ${c.cta.url}`, ""] : []),
    ...(c.footnote ? [c.footnote, ""] : []),
    "--",
    `${BRAND.name} — ${BRAND.tagline}`,
  ].join("\n");

  return { subject: c.subject, html, text };
}
