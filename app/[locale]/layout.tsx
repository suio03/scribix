import { socialImages } from "@/lib/metadata-url";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "../../i18n/routing";
import Analytics from "../components/Analytics";
import { LoginModalProvider } from "../components/LoginModal";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const SITE = "https://scribix.io";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = metadataUrlFor(locale, "");
  const t = await getTranslations({ locale, namespace: "SiteMetadata" });

  return {
    metadataBase: new URL(SITE),
    title: {
      default: t("title"),
      template: "%s · Scribix",
    },
    description: t("description"),
    alternates: {
      canonical,
      languages: homeLanguages(),
    },
    openGraph: {
      images: socialImages,
      title: t("openGraphTitle"),
      description: t("openGraphDescription"),
      type: "website",
      siteName: "Scribix",
      url: canonical,
    },
    twitter: {
      images: socialImages,
      card: "summary_large_image",
      title: t("twitterTitle"),
      description: t("twitterDescription"),
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function homeLanguages(): Record<string, string> {
  const languages: Record<string, string> = {
    "x-default": metadataUrlFor(routing.defaultLocale, "").toString(),
  };
  for (const locale of routing.locales) {
    languages[locale] = metadataUrlFor(locale, "").toString();
  }
  return languages;
}

function metadataUrlFor(locale: string, path: string): URL {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  if (path === "" && prefix === "") {
    return new URL("/", SITE);
  }
  return new URL(`${prefix}${path}`, SITE);
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <Analytics />
      <body className="bg-paper text-ink antialiased">
        <NextIntlClientProvider>
          <LoginModalProvider>{children}</LoginModalProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
