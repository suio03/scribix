import { socialImages } from "@/lib/metadata-url";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Footer } from "@/app/components/Footer";
import { ProductTopbar } from "@/app/components/ProductTopbar";
import { PricingV2 } from "@/app/components/PricingV2";
import { Shell } from "@/app/components/Shell";
import { getSidebarUsage } from "@/app/components/sidebarUsage";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import type { Tier } from "@/lib/plans";

const SITE = "https://scribix.io";
const PATH = "/pricing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = metadataUrlFor(locale, PATH).toString();
  const t = await getTranslations({ locale, namespace: "PricingV2.metadata" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical, languages: pathLanguages(PATH) },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description"), images: socialImages },
    openGraph: {
      title: t("title"), description: t("description"), images: socialImages,
      type: "website", siteName: "Scribix", url: canonical,
    },
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const env = await cf();
  const session = await auth();
  let currentTier: Tier = "free";
  if (session) {
    const user = await getOrCreateCurrentUser(env.DB, session);
    currentTier = user?.tier ?? "free";
  }
  const homePath = getPathname({ href: "/", locale });
  const dashboardNewPath = getPathname({ href: "/dashboard/new", locale });
  const checkoutSuccessPath = getPathname({
    href: { pathname: "/dashboard", query: { checkout: "ok" } }, locale,
  });
  const sidebarUsage = await getSidebarUsage(session);
  // Pricing stays a standalone public page; signed-in users only get the account topbar.
  return (
    <Shell>
      <ProductTopbar
        signedIn={!!session}
        usage={sidebarUsage}
        postSignInPath={dashboardNewPath}
        signOutRedirect={homePath}
        userImage={session?.user?.image ?? null}
        userLabel={session?.user?.name ?? session?.user?.email ?? null}
      />
      <PricingV2
        currentTier={currentTier}
        checkoutEnabled={env.PADDLE_V2_CHECKOUT_ENABLED === "true"}
        signedIn={!!session}
        checkoutSuccessPath={checkoutSuccessPath}
      />
      <Footer />
    </Shell>
  );
}

function pathLanguages(path: string): Record<string, string> {
  const languages: Record<string, string> = {
    "x-default": metadataUrlFor(routing.defaultLocale, path).toString(),
  };
  for (const locale of routing.locales) {
    languages[locale] = metadataUrlFor(locale, path).toString();
  }
  return languages;
}

function metadataUrlFor(locale: string, path: string): URL {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return new URL(`${prefix}${path}`, SITE);
}
