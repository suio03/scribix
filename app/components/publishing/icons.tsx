// Adapted from ClipFlight (Teleo), commit cb83f86. See README.md.
"use client";

import { useId, type ComponentType, type ReactNode } from "react";

import type { Platform } from "./shared/specs";

type IconProps = {
  size?: number;
  className?: string;
};

const GOOGLE_SIGN_IN_ICON = "/google-g.png";
const YOUTUBE_ICON = "/youtube-icon.png";
// Official Core icon from https://brand.youtube/youtube-icon. Its PNG includes
// required clear space. A 40px canvas renders its 579/1075 alpha height at
// 21.54px, giving the compliance minimum a deliberate safety margin.
const YOUTUBE_ICON_CANVAS_HEIGHT = 40;
const YOUTUBE_ICON_STYLE = {
  width: "auto",
  height: YOUTUBE_ICON_CANVAS_HEIGHT,
  flexShrink: 0,
} as const;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...base}
    >
      {children}
    </svg>
  );
}

export function GoogleIcon({ size = 32, className }: IconProps) {
  return (
    <img
      width={size}
      height={size}
      className={className}
      src={GOOGLE_SIGN_IN_ICON}
      alt=""
      aria-hidden="true"
    />
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 9v4" />
      <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L14.1 3.9a2 2 0 0 0-3.6 0Z" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </Svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </Svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </Svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 17H7a5 5 0 0 1 0-10h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M8 12h8" />
    </Svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function FileTextIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M8 13h8M8 17h6" />
    </Svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11a8 8 0 0 0-14.6-4.6M4 5v5h5" />
      <path d="M4 13a8 8 0 0 0 14.6 4.6M20 19v-5h-5" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function MoreHorizontalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function CreditCardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </Svg>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </Svg>
  );
}

export function HelpCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9a2.5 2.5 0 1 1 3.8 2.1c-.9.6-1.5 1.1-1.5 2.4" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" />
      <path d="M14 8l4 4-4 4M18 12H8" />
    </Svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3 1.4 4.1a5 5 0 0 0 3.1 3.1l4.1 1.4-4.1 1.4a5 5 0 0 0-3.1 3.1L12 20.2l-1.4-4.1A5 5 0 0 0 7.5 13l-4.1-1.4 4.1-1.4a5 5 0 0 0 3.1-3.1Z" />
    </Svg>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <Svg {...props} className={`icon-spin ${props.className ?? ""}`.trim()}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </Svg>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Svg>
  );
}

// Platform marks render in each platform's own brand colours, so they stay
// recognisable instead of inheriting the surrounding UI colour.
function BrandSvg({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  const gradientId = `cf-ig-${useId()}`;

  return (
    <BrandSvg {...props}>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1="3"
          y1="21"
          x2="21"
          y2="3"
        >
          <stop offset="0" stopColor="#F9CE34" />
          <stop offset="0.25" stopColor="#F5772E" />
          <stop offset="0.6" stopColor="#EE2A7B" />
          <stop offset="1" stopColor="#6228D7" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.5" />
        <circle cx="12" cy="12" r="4.25" />
        <path d="M17.2 6.9h.01" />
      </g>
    </BrandSvg>
  );
}

export function YouTubeIcon({ className }: Pick<IconProps, "className">) {
  return (
    <img
      height={YOUTUBE_ICON_CANVAS_HEIGHT}
      style={YOUTUBE_ICON_STYLE}
      className={className}
      src={YOUTUBE_ICON}
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  );
}

export function LinkedInIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7.5 10v7M7.5 7h.01M11 17v-7M11 13a3 3 0 0 1 6 0v4" />
    </Svg>
  );
}

type CompactPlatform = Exclude<Platform, "youtube">;

const COMPACT_PLATFORM_ICONS = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  linkedin: LinkedInIcon,
} satisfies Record<CompactPlatform, ComponentType<IconProps>>;

/** YouTube's official mark cannot fit below its 20px visible-height minimum. */
export function supportsCompactPlatformIcon(
  platform: Platform,
): platform is CompactPlatform {
  return platform in COMPACT_PLATFORM_ICONS;
}

export function CompactPlatformIcon({
  platform,
  ...props
}: IconProps & { platform: Platform }) {
  if (!supportsCompactPlatformIcon(platform)) {
    return null;
  }

  const Icon = COMPACT_PLATFORM_ICONS[platform];
  return <Icon {...props} />;
}

const TIKTOK_NOTE =
  "M16.7 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.55 2.55 0 0 1-2.59 2.5 2.52 2.52 0 0 1-2.59-2.5 2.52 2.52 0 0 1 2.59-2.5c.27 0 .53.04.78.12v-3.1a5.72 5.72 0 0 0-.78-.05A5.62 5.62 0 0 0 4.24 15.5 5.62 5.62 0 0 0 9.86 21a5.62 5.62 0 0 0 5.62-5.5V9.01a7.34 7.34 0 0 0 4.28 1.38V7.3a4.27 4.27 0 0 1-3.06-1.48Z";

export function TikTokIcon(props: IconProps) {
  return (
    <BrandSvg {...props}>
      <path d={TIKTOK_NOTE} fill="#25F4EE" transform="translate(-1.1 -0.7)" />
      <path d={TIKTOK_NOTE} fill="#FE2C55" transform="translate(1.1 0.7)" />
      <path d={TIKTOK_NOTE} fill="var(--text-strong)" />
    </BrandSvg>
  );
}

export function LogoMark({ size = 22, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 73 52 A 25 25 0 1 1 48 27"
        fill="none"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M80 18 L70.4 35.6 L62.4 27.6 Z"
        fill="var(--brand)"
        stroke="var(--brand)"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
