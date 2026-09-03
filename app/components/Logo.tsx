const OUTER_PATH =
  "M71 23C64 14 27 15 23 35C20 49 70 43 70 59C70 80 31 83 23 69";
const INNER_PATH =
  "M60 32C56 27 40 28 37 37C35 44 59 44 59 55C59 65 44 68 39 63";

export function Logo({
  size = 28,
}: {
  size?: number;
}) {
  return (
    <span
      className="scribix-logo scribix-logo-mark inline-grid shrink-0 place-items-center"
      style={{
        width: size,
        height: size,
      }}
      aria-hidden
    >
      <svg
        viewBox="8 6 80 84"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={OUTER_PATH} strokeWidth={8} />
          <path d={INNER_PATH} strokeWidth={5.5} />
        </g>
      </svg>
    </span>
  );
}
