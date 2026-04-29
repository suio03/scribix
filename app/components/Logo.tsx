export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-grid place-items-center text-sage"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 22 28 Q 22 20, 30 20 L 70 20 Q 78 20, 78 28 L 78 54 Q 78 62, 70 62 L 42 62 L 34 72 L 34 62 Q 22 62, 22 54 Z"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <g fill="currentColor">
          <circle cx="34" cy="41" r="2" />
          <circle cx="42" cy="41" r="3.5" />
          <circle cx="50" cy="41" r="5" />
          <circle cx="58" cy="41" r="3.5" />
          <circle cx="66" cy="41" r="2" />
        </g>
      </svg>
    </span>
  );
}
