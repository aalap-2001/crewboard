/**
 * Mentions live inline in markdown as  @[Display Name](user:<uid>)  and  @[all](user:all).
 * Keep in sync with functions/src/notifications/mentions.ts.
 */
export const MENTION_RE = /@\[([^\]\n]{1,80})\]\(user:([A-Za-z0-9_-]{1,128})\)/g;
export const ALL_ID = "all";

export function mentionToken(id: string, name: string): string {
  const safe = name.replace(/[[\]\n()]/g, "").trim().slice(0, 80) || "someone";
  return `@[${safe}](user:${id})`;
}

/** Unique member ids mentioned in `text`; "@all" expands to every board member. */
export function parseMentions(text: string, memberIds: string[]): string[] {
  const members = new Set(memberIds);
  const out = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) {
    if (m[2] === ALL_ID) memberIds.forEach((id) => out.add(id));
    else if (members.has(m[2])) out.add(m[2]);
  }
  return [...out];
}

/** Rewrites tokens so the "@" is part of the link text (renders as a single chip). */
export function prepareMentionsForMarkdown(text: string): string {
  return text.replace(MENTION_RE, (_m, name: string, id: string) => `[@${name}](user:${id})`);
}
