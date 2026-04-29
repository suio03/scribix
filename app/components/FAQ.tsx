import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionLabel } from "./SectionLabel";

type Item = { q: string; a: string };

export async function FAQ() {
  const t = await getTranslations("FAQ");
  const faqs = t.raw("items") as Item[];

  return (
    <section id="faq" className="scroll-mt-20 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={t("number")} label={t("label")} />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <h2 className="font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[48px]">
              {t("h2Part1")} <br />
              {t.rich("h2Part2", {
                accent: (chunks) => (
                  <span className="italic text-accent">{chunks}</span>
                ),
              })}
            </h2>
            <p className="mt-5 max-w-[36ch] text-[15px] leading-[1.7] text-muted">
              {t("contactPrefix")}{" "}
              <a
                href={`mailto:${t("contactEmail")}`}
                className="text-ink underline decoration-accent decoration-2 underline-offset-4"
              >
                {t("contactEmail")}
              </a>{" "}
              {t("contactSuffix")}
            </p>
          </div>

          <ul className="divide-y divide-line border-y border-line">
            {faqs.map((f, i) => (
              <li key={f.q}>
                <details className="group py-5">
                  <summary className="flex cursor-pointer items-start justify-between gap-4">
                    <div className="flex flex-1 items-start gap-4">
                      <span className="font-mono text-[11px] tabular text-muted">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-display text-[18px] font-medium leading-snug tracking-tight">
                        {f.q}
                      </span>
                    </div>
                    <Plus
                      size={18}
                      strokeWidth={1.6}
                      className="faq-icon mt-1 shrink-0 text-muted transition"
                    />
                  </summary>
                  <p className="ml-9 mt-3 text-[14.5px] leading-[1.7] text-muted">
                    {f.a}
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
