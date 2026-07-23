import {
  Clapperboard,
  Mic,
  Newspaper,
  FlaskConical,
  GraduationCap,
  Scale,
  BriefcaseBusiness,
  Handshake,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionLabel } from "./SectionLabel";

type Case = {
  title: string;
  icon?: UseCaseIcon;
  audience: string;
  body: string;
  workflow: string[];
};

type UseCaseIcon =
  | "Clapperboard"
  | "Mic"
  | "Newspaper"
  | "FlaskConical"
  | "GraduationCap"
  | "Scale"
  | "BriefcaseBusiness"
  | "Handshake";

const icons: LucideIcon[] = [
  Clapperboard,
  Mic,
  Newspaper,
  FlaskConical,
  GraduationCap,
  Scale,
];
const iconByName: Record<UseCaseIcon, LucideIcon> = {
  Clapperboard,
  Mic,
  Newspaper,
  FlaskConical,
  GraduationCap,
  Scale,
  BriefcaseBusiness,
  Handshake,
};

type UseCasesNamespace = "UseCases" | "AiNoteTaker.useCases";

export async function UseCases({
  namespace = "UseCases",
}: {
  namespace?: UseCasesNamespace;
} = {}) {
  const t = await getTranslations(namespace);
  const cases = t.raw("items") as Case[];

  return (
    <section id="use-cases" className="scroll-mt-20 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={t("number")} label={t("label")} />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <h2 className="font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[52px]">
            {t("h2Part1")} <br />
            {t.rich("h2Part2", {
              accent: (chunks) => (
                <span className="italic text-accent">{chunks}</span>
              ),
            })}
          </h2>
          <p className="text-[16px] leading-[1.7] text-muted">{t("intro")}</p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c, i) => {
            const Icon = c.icon ? iconByName[c.icon] : icons[i];
            return (
              <article
                key={c.title}
                className="group flex flex-col gap-5 rounded-2xl border border-line bg-card p-6 transition hover:-translate-y-0.5 hover:border-ink/30"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-grid size-10 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Icon size={18} strokeWidth={1.6} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                    {c.audience}
                  </span>
                </div>

                <h3 className="font-display text-[22px] font-medium tracking-tight">
                  {c.title}
                </h3>

                <p className="text-[14px] leading-[1.65] text-muted">
                  {c.body}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line pt-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
                  {c.workflow.map((w, idx) => (
                    <span key={w} className="flex items-center gap-2">
                      {idx > 0 && (
                        <span className="text-accent" aria-hidden>
                          →
                        </span>
                      )}
                      <span>{w}</span>
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
