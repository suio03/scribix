export function SectionLabel({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
      <span className="text-accent">{number}</span>
      <span className="h-px w-8 bg-line" />
      <span>{label}</span>
    </div>
  );
}
