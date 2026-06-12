import { getLocale, getTranslations } from "next-intl/server";
import { UploadOrRecord } from "@/app/components/UploadOrRecord";
import { TrackToolVisit } from "@/app/components/Track";
import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { getPathname, Link } from "@/i18n/navigation";
import type { BillingCycle, Tier } from "@/lib/plans";

export default async function NewTranscriptPage() {
  const locale = await getLocale();
  const t = await getTranslations("Dashboard.new");
  const newHref = getPathname({ href: "/dashboard/new", locale });
  const checkoutSuccessPath = newHref;
  const session = await auth();
  let tier: Tier = "free";
  let billingCycle: BillingCycle | null = null;

  if (session) {
    const env = await cf();
    const user = await getOrCreateCurrentUser(env.DB, session);
    tier = user?.tier ?? "free";
    billingCycle = user?.billing_cycle ?? null;
  }

  return (
    <main className="mx-auto max-w-[720px] px-4 py-12 sm:px-8">
      <TrackToolVisit slug="dashboard-transcribe" />
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <Link
          href="/dashboard"
          className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
        >
          {t("back")}
        </Link>
      </div>

      <div className="mt-8">
        <UploadOrRecord
          signedIn={true}
          postSignInPath={newHref}
          checkoutSuccessPath={checkoutSuccessPath}
          tier={tier}
          billingCycle={billingCycle}
        />
      </div>
    </main>
  );
}
