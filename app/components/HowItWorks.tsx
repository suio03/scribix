import { CloudUpload, Cpu, Download, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionLabel } from "./SectionLabel";
import { Waveform } from "./Waveform";

type Step = {
  n: string;
  title: string;
  body: string;
  duration: string;
};

const icons: LucideIcon[] = [CloudUpload, Cpu, Download];

export async function HowItWorks() {
  const t = await getTranslations("HowItWorks");
  const steps = t.raw("steps") as Step[];

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
            const Icon = icons[i];
            return (
              <article
                key={s.n}
                className="relative flex flex-col gap-5 border-t border-line pt-7"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-[42px] font-medium leading-none tracking-tight tabular text-accent">
                    {s.n}
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
                  <span>{s.duration}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
