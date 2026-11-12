/**
 * Mentions are stored inline in markdown as  @[Display Name](user:<uid>)  and  @[all](user:all).
 * Keep in sync with web/src/lib/mentions.ts.
 */
const MENTION_RE = /@\[([^\]\n]{1,80})\]\(user:([A-Za-z0-9_-]{1,128})\)/g;

/** Unique member ids mentioned in `text`; "@all" expands to every board member. */
export function parseMentions(text: string, memberIds: string[]): string[] {
  const members = new Set(memberIds);
  const out = new Set<string>();
  for (const m of (text ?? "").matchAll(MENTION_RE)) {
    if (m[2] === "all") memberIds.forEach((id) => out.add(id));
    else if (members.has(m[2])) out.add(m[2]);
  }
  return [...out];
}

/** Markdown → short plain text for emails and notification previews. */
export function toSnippet(text: string, max = 280): string {
  const plain = (text ?? "")
    .replace(MENTION_RE, (_m, name: string) => `@${name}`)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_~>#]+/g, "")
    .replace(/^\s*[-+]\s+(\[[ x]\]\s+)?/gm, "• ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}
