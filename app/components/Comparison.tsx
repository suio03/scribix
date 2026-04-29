import { Check, Minus, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionLabel } from "./SectionLabel";

type Cell = "yes" | "no" | "partial" | string;
type Row = { feature: string; cells: Cell[] };

function CellRender({ value, primary }: { value: Cell; primary: boolean }) {
  if (value === "yes")
    return (
      <span
        className={`inline-grid size-6 place-items-center rounded-full ${
          primary ? "bg-accent text-paper" : "bg-sage/15 text-sage"
        }`}
      >
        <Check size={13} strokeWidth={2.5} />
      </span>
    );
  if (value === "no")
    return (
      <span className="inline-grid size-6 place-items-center rounded-full border border-line text-muted/60">
        <X size={12} strokeWidth={2} />
      </span>
    );
  if (value === "partial")
    return (
      <span className="inline-grid size-6 place-items-center rounded-full border border-line text-muted">
        <Minus size={12} strokeWidth={2.5} />
      </span>
    );
  return (
    <span
      className={`font-mono text-[12px] tabular ${
        primary ? "font-semibold text-accent" : "text-muted"
      }`}
    >
      {value}
    </span>
  );
}

export async function Comparison() {
  const t = await getTranslations("Comparison");
  const cols = t.raw("cols") as string[];
  const rows = t.raw("rows") as Row[];

  return (
    <section
      id="compare"
      className="scroll-mt-20 border-y border-line bg-card/50 px-4 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel number={t("number")} label={t("label")} />

        <h2 className="max-w-[18ch] font-display text-[36px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[52px]">
          {t.rich("h2", {
            accent: (chunks) => (
              <span className="italic text-accent">{chunks}</span>
            ),
          })}
        </h2>

        <p className="mt-6 max-w-[60ch] text-[15.5px] leading-[1.7] text-muted">
          {t("intro")}
        </p>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="w-[44%] py-4 pl-6 pr-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted">
                  {t("featureHeader")}
                </th>
                {cols.map((c, i) => (
                  <th
                    key={c}
                    className={`px-4 py-4 text-center font-display text-[15px] font-medium tracking-tight ${
                      i === 0 ? "text-accent" : "text-ink"
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-b border-line/70 last:border-0">
                  <td className="py-4 pl-6 pr-4 text-[14px] text-ink">
                    {r.feature}
                  </td>
                  {r.cells.map((cell, i) => (
                    <td
                      key={i}
                      className={`px-4 py-4 text-center ${
                        i === 0 ? "bg-accent-soft" : ""
                      }`}
                    >
                      <CellRender value={cell} primary={i === 0} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
