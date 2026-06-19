export function isTodayUtc(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  return (
    parsed.getUTCFullYear() === now.getUTCFullYear() &&
    parsed.getUTCMonth() === now.getUTCMonth() &&
    parsed.getUTCDate() === now.getUTCDate()
  );
}
