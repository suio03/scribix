import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Waveform } from "./Waveform";

type Stat = { value: string; label: string };

type FinalCtaNamespace = "FinalCTA" | "AiNoteTaker.finalCta";

export async function FinalCTA({
  namespace = "FinalCTA",
}: {
  namespace?: FinalCtaNamespace;
} = {}) {
  const t = await getTranslations(namespace);
  const stats = t.raw("stats") as Stat[];

  return (
    <section className="px-4 pb-20 sm:px-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="relative overflow-hidden rounded-3xl border border-ink bg-ink p-10 text-paper sm:p-16">
          <div className="grain" />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-paper/70">
                <span className="size-1.5 rounded-full bg-rec rec-dot" />
                {t("kicker")}
              </div>
              <h2 className="font-display text-[40px] font-medium leading-[1.02] tracking-[-0.02em] sm:text-[60px]">
                {t("h2Part1")}
                <br />
                {t.rich("h2Part2", {
                  accent: (chunks) => (
                    <span className="italic text-rec">{chunks}</span>
                  ),
                })}
              </h2>
              <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.7] text-paper/75">
                {t("body")}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#generator"
                  className="group inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3.5 text-[14px] font-medium text-ink transition hover:bg-rec hover:text-paper"
                >
                  {t("primaryCta")}
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
                {stats.map((s) => (
                  <div key={s.label}>
                    <div className="text-rec">{s.value}</div>
                    <div className="mt-1 text-paper/50">{s.label}</div>
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
