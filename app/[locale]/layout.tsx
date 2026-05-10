import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "../../i18n/routing";
import Analytics from "../components/Analytics";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

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

  return {
    metadataBase: new URL(SITE),
    title: {
      default: "Video to Text — Free AI Transcription Online | Scribix",
      template: "%s · Scribix",
    },
    description:
      "Convert any video to text free online. Upload MP4, MOV, or WebM — or paste a YouTube link — and get accurate, speaker-labeled transcripts in 200+ languages.",
    keywords: [
      "video to text",
      "video to text converter",
      "convert video to text",
      "video transcription",
      "youtube to text",
      "mp4 to text",
      "audio to text",
      "ai transcription",
      "speaker recognition",
    ],
    alternates: {
      canonical,
      languages: homeLanguages(),
    },
    openGraph: {
      title: "Video to Text — Free AI Transcription | Scribix",
      description:
        "Upload a video or paste a YouTube link. Get an accurate, speaker-labeled transcript in seconds. Free with Google sign-in, 200+ languages.",
      type: "website",
      siteName: "Scribix",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: "Video to Text — Free AI Transcription | Scribix",
      description:
        "Convert any video to text free online. Speaker labels, word-level timestamps, 200+ languages.",
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function homeLanguages(): Record<string, URL> {
  const languages: Record<string, URL> = {
    "x-default": metadataUrlFor(routing.defaultLocale, ""),
  };
  for (const locale of routing.locales) {
    languages[locale] = metadataUrlFor(locale, "");
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
      className={`${fraunces.variable} ${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <Analytics />
      <body className="bg-paper text-ink antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
