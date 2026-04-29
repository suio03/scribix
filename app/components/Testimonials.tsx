import { Quote } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionLabel } from "./SectionLabel";

type Review = {
  quote: string;
  name: string;
  role: string;
  rating: string;
};

export async function Testimonials() {
  const t = await getTranslations("Testimonials");
  const reviews = t.raw("items") as Review[];

  return (
    <section className="scroll-mt-20 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={t("number")} label={t("label")} />

        <h2 className="max-w-[20ch] font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[52px]">
          {t.rich("h2", {
            accent: (chunks) => (
              <span className="italic text-accent">{chunks}</span>
            ),
          })}
        </h2>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <figure
              key={r.name}
              className={`relative flex flex-col gap-6 rounded-2xl border border-line bg-card p-7 ${
                i === 0 ? "lg:row-span-1" : ""
              }`}
            >
              <Quote
                size={28}
                strokeWidth={1.4}
                className="text-accent/70"
                aria-hidden
              />
              <blockquote className="font-display text-[19px] font-normal leading-[1.45] tracking-tight text-ink sm:text-[20px]">
                &ldquo;{r.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-auto flex items-center justify-between gap-4 border-t border-line pt-5">
                <div>
                  <div className="text-[14px] font-medium text-ink">
                    {r.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
                    {r.role}
                  </div>
                </div>
                <span className="font-mono text-[11px] tabular text-accent">
                  ★ {r.rating}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
