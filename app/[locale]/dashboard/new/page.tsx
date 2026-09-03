import { getLocale, getTranslations } from "next-intl/server";
import { Uploader } from "@/app/components/Uploader";
import { TrackToolVisit } from "@/app/components/Track";
import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { getPathname, Link } from "@/i18n/navigation";
import type { Tier } from "@/lib/plans";

export default async function NewProjectPage() {
  const locale = await getLocale();
  const t = await getTranslations("Dashboard.new");
  const newHref = getPathname({ href: "/dashboard/new", locale });
  const session = await auth();
  let tier: Tier = "free";

  if (session) {
    const env = await cf();
    const user = await getOrCreateCurrentUser(env.DB, session);
    tier = user?.tier ?? "free";
  }

  return (
    <main className="product-surface-refresh mx-auto max-w-[980px] px-4 py-10 sm:px-8 sm:py-14">
      <TrackToolVisit slug="dashboard-clips" />
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-[640px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            {t("eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            {t("clipsTitle")}
          </h1>
          <p className="mt-3 max-w-[58ch] text-[15px] leading-6 text-muted">
            {t("clipsDescription")}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 rounded-full border border-line bg-card px-4 py-2 text-[13px] font-medium text-ink transition hover:border-ink/25 hover:bg-paper"
        >
          {t("back")}
        </Link>
      </div>

      <section className="dashboard-create-panel workspace-upload-surface mt-10 overflow-hidden rounded-[24px] border border-line bg-card p-3 shadow-[0_24px_70px_-52px_rgba(18,17,14,0.55)]">
        <Uploader
          signedIn
          postSignInPath={newHref}
          checkoutSuccessPath={newHref}
          tier={tier}
          toolSlug="dashboard-clips"
          videoOnly
        />
      </section>
    </main>
  );
}
