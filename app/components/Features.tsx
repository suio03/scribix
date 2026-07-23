import {
  Users,
  Globe,
  Clock,
  FileDown,
  Files,
  Sparkles,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionLabel } from "./SectionLabel";

type FeatureIcon =
  | "Users"
  | "Globe"
  | "Clock"
  | "FileDown"
  | "Files"
  | "Sparkles"
  | "Lock";
type Item = { title: string; body: string; span?: string; icon?: FeatureIcon };

const icons: LucideIcon[] = [Users, Globe, Clock, FileDown, Sparkles, Lock];
const iconByName: Record<FeatureIcon, LucideIcon> = {
  Users,
  Globe,
  Clock,
  FileDown,
  Files,
  Sparkles,
  Lock,
};

type FeaturesNamespace = "Features" | "AiNoteTaker.features";

export async function Features({
  namespace = "Features",
}: {
  namespace?: FeaturesNamespace;
} = {}) {
  const t = await getTranslations(namespace);
  const items = t.raw("items") as Item[];

  return (
    <section
      id="features"
      className="scroll-mt-20 px-4 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={t("number")} label={t("label")} />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end">
          <h2 className="font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[52px]">
            {t.rich("h2", {
              accent: (chunks) => (
                <span className="italic text-accent">{chunks}</span>
              ),
            })}
          </h2>
          <p className="text-[16px] leading-[1.7] text-muted">{t("intro")}</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f, i) => {
            const Icon = f.icon ? iconByName[f.icon] : icons[i];
            return (
              <article
                key={f.title}
                className={`group relative flex flex-col gap-4 bg-card p-7 transition hover:bg-paper ${
                  f.span ?? ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid size-10 place-items-center rounded-lg border border-line bg-paper text-accent transition group-hover:border-accent">
                    <Icon size={18} strokeWidth={1.6} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-display text-[22px] font-medium tracking-tight">
                  {f.title}
                </h3>
                <p className="text-[14px] leading-[1.65] text-muted">
                  {f.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
