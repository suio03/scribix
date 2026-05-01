// Admin gating via env email allowlist.
// `ADMIN_EMAILS` is a comma-separated list of emails. No DB column needed.

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = process.env.ADMIN_EMAILS;
  if (!list) return false;
  const allow = list
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}
