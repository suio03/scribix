import {
  CloudUpload,
  Cpu,
  Download,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { mergeLocalizedItems } from "@/lib/localized-items";
import { PLANS } from "@/lib/plans";
import { SectionLabel } from "./SectionLabel";
import { Waveform } from "./Waveform";

type Step = {
  title: string;
  body: string;
  duration?: string;
};

type HowItWorksNamespace = "HowItWorks" | "AiNoteTaker.howItWorks";

type StepDefinition = {
  key: string;
  number: string;
  icon: LucideIcon;
};

const STEP_DEFINITIONS = {
  HowItWorks: [
    { key: "upload", number: "01", icon: CloudUpload },
    { key: "transcribe", number: "02", icon: Cpu },
    { key: "export", number: "03", icon: Download },
  ],
  "AiNoteTaker.howItWorks": [
    { key: "addConversation", number: "01", icon: CloudUpload },
    { key: "transcribe", number: "02", icon: Cpu },
    { key: "generateNotes", number: "03", icon: ListChecks },
  ],
} satisfies Record<HowItWorksNamespace, readonly StepDefinition[]>;

export async function HowItWorks({
  namespace = "HowItWorks",
}: {
  namespace?: HowItWorksNamespace;
} = {}) {
  const t = await getTranslations(namespace);
  const stepCopy = t.raw("steps") as Step[];
  const steps = mergeLocalizedItems(
    stepCopy,
    STEP_DEFINITIONS[namespace],
    `${namespace}.steps`
  );
  const freeMinutes = PLANS.free.minutesPerCycle;
  const paidHours = PLANS.pro.maxFileSec / 3600;

  return (
    <section
      id="how"
      className="scroll-mt-20 border-y border-line bg-card/50 px-4 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={t("number")} label={t("label")} />

        <h2 className="max-w-[16ch] font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[52px]">
          {t("h2Part1")}{" "}
          {t.rich("h2Part2", {
            accent: (chunks) => (
              <span className="italic text-accent">{chunks}</span>
            ),
          })}
        </h2>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <article
                key={s.key}
                className="relative flex flex-col gap-5 border-t border-line pt-7"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-[42px] font-medium leading-none tracking-tight tabular text-accent">
                    {s.number}
                  </span>
                  <Icon size={28} strokeWidth={1.4} className="text-ink/70" />
                </div>
                <h3 className="font-display text-[26px] font-medium leading-[1.15] tracking-tight">
                  {s.title}
                </h3>
                <p className="text-[14.5px] leading-[1.65] text-muted">
                  {s.body}
                </p>
                <div className="mt-2 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                  <Waveform
                    bars={i === 1 ? 22 : 14}
                    animated={i === 1}
                    className="h-4 text-accent"
                  />
                  <span>
                    {namespace === "HowItWorks" && i === 0
                      ? t("uploadLimits", { freeMinutes, paidHours })
                      : s.duration}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
