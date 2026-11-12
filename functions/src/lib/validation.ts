import { HttpsError } from "firebase-functions/v2/https";
import { ROLES, type Role } from "./types";

const invalid = (msg: string) => new HttpsError("invalid-argument", msg);

export function asObject(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw invalid("Missing request data.");
  return data as Record<string, unknown>;
}

export function requireString(
  obj: Record<string, unknown>,
  key: string,
  { min = 1, max = 200, label = key }: { min?: number; max?: number; label?: string } = {}
): string {
  const v = obj[key];
  if (typeof v !== "string") throw invalid(`${label} is required.`);
  const t = v.trim();
  if (t.length < min || t.length > max) throw invalid(`${label} must be ${min}–${max} characters.`);
  return t;
}

export function requireEmail(obj: Record<string, unknown>, key = "email"): string {
  const v = requireString(obj, key, { max: 254, label: "Email" }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw invalid("Enter a valid email address.");
  return v;
}

export function requireRole(obj: Record<string, unknown>, key = "role"): Role {
  const v = obj[key];
  if (typeof v !== "string" || !ROLES.includes(v as Role)) {
    throw invalid(`Role must be one of: ${ROLES.join(", ")}.`);
  }
  return v as Role;
}

export function requireBool(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  if (typeof v !== "boolean") throw invalid(`${key} must be true or false.`);
  return v;
}
