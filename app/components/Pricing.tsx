import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionLabel } from "./SectionLabel";

type Plan = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  primary: boolean;
};

export async function Pricing() {
  const t = await getTranslations("Pricing");
  const plans = t.raw("plans") as Plan[];

  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-y border-line bg-card/50 px-4 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={t("number")} label={t("label")} />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <h2 className="font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[52px]">
            {t.rich("h2", {
              accent: (chunks) => (
                <span className="italic text-accent">{chunks}</span>
              ),
            })}
          </h2>
          <p className="text-[16px] leading-[1.7] text-muted">{t("intro")}</p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <article
              key={p.name}
              className={`relative flex flex-col gap-7 rounded-2xl border p-8 transition ${
                p.primary
                  ? "border-accent bg-card shadow-[0_30px_80px_-30px_rgba(220,74,31,0.35)]"
                  : "border-line bg-card hover:border-ink/30"
              }`}
            >
              {p.primary && (
                <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-paper">
                  {t("mostLoved")}
                </span>
              )}

              <div>
                <h3 className="font-display text-[26px] font-medium tracking-tight">
                  {p.name}
                </h3>
                <p className="mt-1.5 text-[13.5px] text-muted">{p.blurb}</p>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-display text-[48px] font-medium leading-none tracking-tight tabular">
                  {p.price}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                  {p.cadence}
                </span>
              </div>

              <ul className="space-y-3 border-t border-line pt-6">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 text-[14px] text-ink/90"
                  >
                    <Check
                      size={15}
                      strokeWidth={2}
                      className={`mt-0.5 shrink-0 ${
                        p.primary ? "text-accent" : "text-sage"
                      }`}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#generator"
                className={`mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[14px] font-medium transition ${
                  p.primary
                    ? "bg-accent text-paper hover:opacity-90"
                    : "border border-ink bg-ink text-paper hover:bg-accent hover:border-accent"
                }`}
              >
                {p.cta}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
