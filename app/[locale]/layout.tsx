import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "../../i18n/routing";
import "./globals.css";

// Runs before paint to avoid theme flash. Reads localStorage first (primary
// store), falls back to the cookie that older clients may still have.
const themeInitScript = `(function(){try{var t=localStorage.getItem("scribix-theme");if(t!=="dark"&&t!=="light"){var m=document.cookie.match(/scribix-theme=(dark|light)/);t=m?m[1]:null;}if(t==="dark")document.documentElement.classList.add("dark");}catch(e){}})();`;

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

export const metadata: Metadata = {
  metadataBase: new URL("https://scribix.io"),
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
  openGraph: {
    title: "Video to Text — Free AI Transcription | Scribix",
    description:
      "Upload a video or paste a YouTube link. Get an accurate, speaker-labeled transcript in seconds. Free with Google sign-in, 200+ languages.",
    type: "website",
    siteName: "Scribix",
  },
  twitter: {
    card: "summary_large_image",
    title: "Video to Text — Free AI Transcription | Scribix",
    description:
      "Convert any video to text free online. Speaker labels, word-level timestamps, 200+ languages.",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
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
      <head>
        <Script
          id="scribix-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="bg-paper text-ink antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
