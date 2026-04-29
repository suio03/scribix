export function Waveform({
  bars = 28,
  className = "",
  animated = false,
}: {
  bars?: number;
  className?: string;
  animated?: boolean;
}) {
  const heights = Array.from({ length: bars }, (_, i) => {
    const t = i / bars;
    const wave =
      0.45 +
      0.35 * Math.sin(t * Math.PI * 2.4) +
      0.18 * Math.sin(t * Math.PI * 5.7 + 1.2);
    return Math.max(0.18, Math.min(1, wave));
  });

  return (
    <div
      className={`flex items-center gap-[3px] ${className}`}
      aria-hidden
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={`block w-[3px] rounded-full bg-current ${
            animated ? "wave-bar" : ""
          }`}
          style={{
            height: `${Math.round(h * 100)}%`,
            animationDelay: animated ? `${(i % 8) * 0.07}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}
