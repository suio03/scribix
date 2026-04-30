import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { SectionLabel } from "./SectionLabel";
import { PricingClient } from "./PricingClient";

export async function Pricing() {
  const t = await getTranslations("Pricing");
  const session = await auth();
  const locale = await getLocale();
  const homePath = getPathname({ href: "/", locale });
  const dashboardPath = getPathname({ href: "/dashboard", locale });

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

        <PricingClient
          signedIn={Boolean(session)}
          postSignInPath={`${homePath}#pricing`}
          dashboardPath={dashboardPath}
          mostLoved={t("mostLoved")}
        />
      </div>
    </section>
  );
}
