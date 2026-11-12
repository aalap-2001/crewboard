/** Single source of truth for email branding. Matches web/tailwind.config.js `brand`. */
export const BRAND = {
  name: "Crewboard",
  tagline: "Your crew, your board, your flow.",
  color: "#4f46e5", // indigo-600 — sits between the logo gradient's #6366F1 and #4338CA
  colorDark: "#3730a3", // indigo-800
  colorSoft: "#e0e7ff", // indigo-100
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  canvas: "#f1f5f9",
  font: "'Figtree', 'Segoe UI', Helvetica, Arial, sans-serif",
  /** Matches the logo file (web/public/crewboard-logo.svg). */
  wordmarkFont: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif",
  wordmarkInk: "#111827",
} as const;
