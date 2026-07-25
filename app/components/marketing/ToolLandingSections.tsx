import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Captions,
  Check,
  Clock3,
  CloudUpload,
  Download,
  FileAudio,
  FileText,
  Globe,
  Lock,
  Mic,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { SectionLabel } from "@/app/components/SectionLabel";
import { Waveform } from "@/app/components/Waveform";
import { mergeLocalizedItems } from "@/lib/localized-items";

export type ToolLandingIcon =
  | "BadgeCheck"
  | "Captions"
  | "Check"
  | "Clock3"
  | "CloudUpload"
  | "Download"
  | "FileAudio"
  | "FileText"
  | "Globe"
  | "Lock"
  | "Mic"
  | "Search"
  | "ShieldCheck"
  | "Sparkles"
  | "Users"
  | "X";

export type ProofItem = {
  key: string;
  icon: ToolLandingIcon;
  label: string;
};

export type TableRow = {
  item: string;
  detail: string;
};

export type FitListItem = {
  title: string;
  items: string[];
};

export type LandingStep = {
  key: string;
  n: string;
  icon: ToolLandingIcon;
  title: string;
  body: string;
  meta: string;
};

export type GridCard = {
  key: string;
  icon: ToolLandingIcon;
  title: string;
  body?: string;
  who?: string;
  output?: string;
};

export type InsightCard = {
  key: string;
  icon: ToolLandingIcon;
  title: string;
  body: string[];
  link?: {
    href: string;
    label: string;
    suffix?: string;
  };
};

export type ComparisonRow = {
  approach: string;
  bestFor: string;
  tradeoff: string;
};

export type FaqItem = {
  q: string;
  a: string;
};

export function mergeItemDefinitions<
  Copy extends object,
  Definition extends object,
>(
  copy: readonly Copy[],
  definitions: readonly Definition[],
  source: string
): Array<Copy & Definition> {
  return mergeLocalizedItems(copy, definitions, source);
}

const icons: Record<ToolLandingIcon, LucideIcon> = {
  BadgeCheck,
  Captions,
  Check,
  Clock3,
  CloudUpload,
  Download,
  FileAudio,
  FileText,
  Globe,
  Lock,
  Mic,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
};

export function ToolHero({
  issue,
  issueLabel,
  title,
  accentTitle,
  description,
  primaryCta,
  signedInPrimaryCta,
  signedIn,
  secondaryCta,
  secondaryHref,
  proof,
  children,
}: {
  issue: string;
  issueLabel: string;
  title: string;
  accentTitle: string;
  description: ReactNode;
  primaryCta: string;
  signedInPrimaryCta?: string;
  signedIn: boolean;
  secondaryCta?: string;
  secondaryHref?: string;
  proof: ProofItem[];
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:pt-20">
      <div className="mx-auto max-w-[1100px]">
        <div>
          <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-rec rec-dot" />
              {issue}
            </span>
            <span className="h-px flex-1 bg-line" />
            <span>{issueLabel}</span>
          </div>

          <h1 className="font-display text-[44px] font-medium leading-[1.02] tracking-[-0.02em] sm:text-[60px] lg:text-[76px]">
            {title}
            <br />
            <span className="italic text-accent">{accentTitle}</span>
          </h1>

          <p className="mt-6 max-w-[58ch] text-[16px] leading-[1.65] text-muted sm:text-[17px]">
            {description}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href="#upload"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-medium text-paper transition hover:bg-accent"
            >
              {signedIn && signedInPrimaryCta ? signedInPrimaryCta : primaryCta}
              <ArrowRight size={16} strokeWidth={1.8} />
            </a>
            {secondaryCta && secondaryHref ? (
              <Link
                href={secondaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-5 py-3 text-[14px] font-medium text-ink transition hover:bg-ink/5"
              >
                {secondaryCta}
              </Link>
            ) : null}
          </div>

          <ProofRow items={proof} />
        </div>

        <div id="upload" className="mt-10 scroll-mt-24">
          {children}
        </div>
      </div>
    </section>
  );
}

export function ProofRow({ items }: { items: ProofItem[] }) {
  return (
    <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px]">
      {items.map((item) => {
        const Icon = icons[item.icon];
        return (
          <li key={item.key} className="flex items-center gap-2 text-ink/85">
            <Icon size={16} strokeWidth={1.7} className="text-accent" />
            <span className="font-medium">{item.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function QuickAnswerSection({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <section className="border-y border-line bg-card/50 px-4 py-10 sm:px-8">
      <div className="mx-auto grid max-w-[1100px] gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            {kicker}
          </p>
          <h2 className="mt-3 font-display text-[30px] font-medium tracking-tight">
            {title}
          </h2>
        </div>
        <p className="text-[16px] leading-[1.75] text-muted">{body}</p>
      </div>
    </section>
  );
}

export function OverviewSection({
  number,
  label,
  rows,
  bestFor,
  notBestFor,
}: {
  number: string;
  label: string;
  rows: TableRow[];
  bestFor: FitListItem;
  notBestFor: FitListItem;
}) {
  return (
    <section className="px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={number} label={label} />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            <table className="w-full text-left text-[14px]">
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.item}>
                    <th className="w-[34%] bg-paper/50 px-4 py-4 align-top font-mono text-[11px] uppercase tracking-[0.16em] text-muted sm:px-5">
                      {row.item}
                    </th>
                    <td className="px-4 py-4 leading-[1.55] text-ink/85 sm:px-5">
                      {row.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4">
            <FitList title={bestFor.title} items={bestFor.items} icon="Check" />
            <FitList title={notBestFor.title} items={notBestFor.items} icon="X" muted />
          </div>
        </div>
      </div>
    </section>
  );
}

function FitList({
  title,
  items,
  icon,
  muted = false,
}: {
  title: string;
  items: string[];
  icon: ToolLandingIcon;
  muted?: boolean;
}) {
  const Icon = icons[icon];
  return (
    <article className="rounded-2xl border border-line bg-card p-6">
      <h3 className="font-display text-[24px] font-medium tracking-tight">{title}</h3>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-[14.5px] leading-[1.6] text-muted">
            <span
              className={`mt-0.5 inline-grid size-5 shrink-0 place-items-center rounded-full ${
                muted ? "bg-ink/8 text-muted" : "bg-accent-soft text-accent"
              }`}
            >
              <Icon size={13} strokeWidth={2} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function StepsSection({
  number,
  label,
  title,
  accentTitle,
  steps,
}: {
  number: string;
  label: string;
  title: string;
  accentTitle: string;
  steps: LandingStep[];
}) {
  return (
    <section className="border-y border-line bg-card/50 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={number} label={label} />
        <h2 className="max-w-[16ch] font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[52px]">
          {title} <span className="italic text-accent">{accentTitle}</span>
        </h2>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = icons[step.icon];
            return (
              <article key={step.key} className="relative flex flex-col gap-5 border-t border-line pt-7">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[42px] font-medium leading-none tracking-tight tabular text-accent">
                    {step.n}
                  </span>
                  <Icon size={28} strokeWidth={1.4} className="text-ink/70" />
                </div>
                <h3 className="font-display text-[26px] font-medium leading-[1.15] tracking-tight">
                  {step.title}
                </h3>
                <p className="text-[14.5px] leading-[1.65] text-muted">{step.body}</p>
                <div className="mt-2 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                  <Waveform
                    bars={i === 1 ? 22 : 14}
                    animated={i === 1}
                    className="h-4 text-accent"
                  />
                  <span>{step.meta}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function UseCaseGridSection({
  number,
  label,
  title,
  accentTitle,
  items,
}: {
  number: string;
  label: string;
  title: string;
  accentTitle: string;
  items: GridCard[];
}) {
  return (
    <section className="px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={number} label={label} />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <div>
            <h2 className="font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[52px]">
              {title} <span className="italic text-accent">{accentTitle}</span>
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {items.map((item) => {
              const Icon = icons[item.icon];
              return (
                <article key={item.key} className="bg-card p-6 transition hover:bg-paper">
                  <Icon size={22} strokeWidth={1.5} className="text-accent" />
                  <h3 className="mt-5 font-display text-[23px] font-medium tracking-tight">
                    {item.title}
                  </h3>
                  {item.who ? (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                      {item.who}
                    </p>
                  ) : null}
                  <p className="mt-4 text-[14px] leading-[1.65] text-muted">
                    {item.output ?? item.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function DemoTranscriptSection({
  number,
  label,
  title,
  body,
  filename,
  transcript,
}: {
  number: string;
  label: string;
  title: string;
  body: string;
  filename: string;
  transcript: string;
}) {
  return (
    <section className="border-y border-line bg-card/50 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={number} label={label} />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-start">
          <div>
            <h2 className="font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[48px]">
              {title}
            </h2>
            <p className="mt-5 text-[15px] leading-[1.7] text-muted">{body}</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-ink text-paper shadow-[0_30px_80px_-45px_rgba(14,13,11,0.42)]">
            <div className="flex items-center justify-between border-b border-paper/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-rec" />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper/60">
                  {filename}
                </span>
              </div>
              <FileText size={17} strokeWidth={1.6} className="text-paper/60" />
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap p-5 font-mono text-[12.5px] leading-[1.75] text-paper/86 sm:p-7">
              {transcript}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeatureGridSection({
  number,
  label,
  title,
  accentTitle,
  intro,
  items,
}: {
  number: string;
  label: string;
  title: string;
  accentTitle: string;
  intro: string;
  items: GridCard[];
}) {
  return (
    <section className="px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={number} label={label} />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <h2 className="font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[52px]">
            {title}
            <br />
            <span className="italic text-accent">{accentTitle}</span>
          </h2>
          <p className="text-[16px] leading-[1.7] text-muted">{intro}</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const Icon = icons[item.icon];
            return (
              <article key={item.key} className="bg-card p-6 transition hover:bg-paper">
                <span className="inline-grid size-10 place-items-center rounded-lg border border-line bg-paper text-accent">
                  <Icon size={18} strokeWidth={1.6} />
                </span>
                <h3 className="mt-5 font-display text-[22px] font-medium tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.65] text-muted">{item.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function InsightCardsSection({ items }: { items: InsightCard[] }) {
  return (
    <section className="border-y border-line bg-card/50 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-[1100px] gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-2">
        {items.map((item) => {
          const Icon = icons[item.icon];
          return (
            <article key={item.key} className="bg-card p-7 sm:p-9">
              <Icon size={24} strokeWidth={1.5} className="text-accent" />
              <h2 className="mt-5 font-display text-[31px] font-medium tracking-tight">
                {item.title}
              </h2>
              {item.body.map((paragraph, i) => (
                <p key={paragraph} className="mt-4 text-[15px] leading-[1.75] text-muted">
                  {paragraph}
                  {item.link && i === item.body.length - 1 ? (
                    <>
                      {" "}
                      <Link
                        href={item.link.href}
                        className="text-ink underline decoration-accent decoration-2 underline-offset-4"
                      >
                        {item.link.label}
                      </Link>
                      {item.link.suffix}
                    </>
                  ) : null}
                </p>
              ))}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ApproachComparisonSection({
  number,
  label,
  title,
  headers,
  rows,
}: {
  number: string;
  label: string;
  title: string;
  headers: [string, string, string];
  rows: ComparisonRow[];
}) {
  return (
    <section className="px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={number} label={label} />
        <h2 className="max-w-[18ch] font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[52px]">
          {title}
        </h2>
        <div className="mt-12 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="bg-paper/60 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-5 py-4">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.approach}>
                  <th className="px-5 py-5 font-display text-[20px] font-medium tracking-tight">
                    {row.approach}
                  </th>
                  <td className="px-5 py-5 leading-[1.6] text-muted">{row.bestFor}</td>
                  <td className="px-5 py-5 leading-[1.6] text-muted">{row.tradeoff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function FaqSection({
  number,
  label,
  title,
  accentTitle,
  intro,
  items,
}: {
  number: string;
  label: string;
  title: string;
  accentTitle: string;
  intro: string;
  items: FaqItem[];
}) {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-line px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={number} label={label} />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <h2 className="font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[48px]">
              {title}
              <br />
              <span className="italic text-accent">{accentTitle}</span>
            </h2>
            <p className="mt-5 max-w-[36ch] text-[15px] leading-[1.7] text-muted">
              {intro}
            </p>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {items.map((faq, i) => (
              <li key={faq.q}>
                <details className="group py-5">
                  <summary className="flex cursor-pointer items-start justify-between gap-4">
                    <div className="flex flex-1 items-start gap-4">
                      <span className="font-mono text-[11px] tabular text-muted">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-display text-[18px] font-medium leading-snug tracking-tight">
                        {faq.q}
                      </span>
                    </div>
                    <span className="faq-icon mt-1 shrink-0 text-muted transition">+</span>
                  </summary>
                  <p className="ml-9 mt-3 text-[14.5px] leading-[1.7] text-muted">
                    {faq.a}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function FinalToolCta({
  kicker,
  title,
  body,
  primaryCta,
  signedInPrimaryCta,
  signedIn,
  stats,
}: {
  kicker: string;
  title: string;
  body: string;
  primaryCta: string;
  signedInPrimaryCta?: string;
  signedIn: boolean;
  stats: Array<{ value: string; label: string }>;
}) {
  return (
    <section className="px-4 pb-20 sm:px-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="relative overflow-hidden rounded-3xl border border-ink bg-ink p-10 text-paper sm:p-16">
          <div className="grain" />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-paper/70">
                <span className="size-1.5 rounded-full bg-rec rec-dot" />
                {kicker}
              </div>
              <h2 className="font-display text-[40px] font-medium leading-[1.02] tracking-[-0.02em] sm:text-[60px]">
                {title}
              </h2>
              <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.7] text-paper/75">
                {body}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#upload"
                  className="group inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3.5 text-[14px] font-medium text-ink transition hover:bg-rec hover:text-paper"
                >
                  {signedIn && signedInPrimaryCta ? signedInPrimaryCta : primaryCta}
                  <ArrowUpRight
                    size={15}
                    strokeWidth={2}
                    className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </a>
              </div>
            </div>

            <div className="hidden text-paper/40 lg:block">
              <Waveform bars={48} animated className="h-44 w-full text-rec" />
              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-paper/15 pt-6 font-mono text-[10.5px] uppercase tracking-[0.2em]">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-rec">{stat.value}</div>
                    <div className="mt-1 text-paper/50">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
