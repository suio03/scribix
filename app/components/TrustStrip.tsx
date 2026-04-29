import { getTranslations } from "next-intl/server";

type Stat = { value: string; label: string };

export async function TrustStrip() {
  const t = await getTranslations("TrustStrip");
  const logos = t.raw("logos") as string[];
  const stats = t.raw("stats") as Stat[];

  return (
    <section className="border-y border-line bg-card/40 px-4 py-12 sm:px-8">
      <div className="mx-auto max-w-[1100px]">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
          {t("tagline")}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-center text-[13px] font-medium text-muted/80 sm:grid-cols-3 lg:grid-cols-6">
          {logos.map((logo) => (
            <span
              key={logo}
              className="font-display tracking-tight transition hover:text-ink"
            >
              {logo}
            </span>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-start gap-1 bg-card px-6 py-7"
            >
              <span className="font-display text-[40px] font-medium leading-none tracking-tight tabular sm:text-[52px]">
                {s.value}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
