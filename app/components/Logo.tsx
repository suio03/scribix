const MARK_PATH =
  "M62,30 C62,24 34,24 34,41.28 C34,50.4 62,45.6 62,54.72 C62,72 34,72 34,66";

export function Logo({
  size = 28,
  variant = "mark",
}: {
  size?: number;
  variant?: "mark" | "app";
}) {
  const isAppIcon = variant === "app";

  return (
    <span
      className={`scribix-logo inline-grid shrink-0 place-items-center ${
        isAppIcon ? "scribix-logo-app" : "scribix-logo-mark"
      }`}
      style={{
        width: size,
        height: size,
        borderRadius: isAppIcon ? Math.round(size * 0.23) : undefined,
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 96 96"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d={MARK_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth={15}
          strokeLinecap="round"
          transform={isAppIcon ? "translate(10.08 10.08) scale(.79)" : undefined}
        />
      </svg>
    </span>
  );
}
