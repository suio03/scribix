import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Shell } from "@/app/components/Shell";
import { ProductTopbar } from "@/app/components/ProductTopbar";
import { Footer } from "@/app/components/Footer";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartners } from "@/lib/partners";
import { renderPartners, selectPartners, type PartnerLink } from "@/lib/partner-links-renderer";

export const dynamic = "force-dynamic";

const title = "Partners & Directories — Scribix";
const description = "Explore the partners and directories listed by Scribix.";
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://scribix.io/partners", languages: {} },
  openGraph: { title, description, url: "https://scribix.io/partners" },
  twitter: { title, description },
};

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "en") redirect("/partners");
  setRequestLocale(locale);
  let links: PartnerLink[] = [];
  let unavailable = false;
  try {
    links = await getPartners();
  } catch {
    unavailable = true;
  }

  const directoryCount = selectPartners(links, "directory").length;

  return (
    <Shell>
    <ProductTopbar />
    <main className="bg-paper text-ink">
      <div className="mx-auto max-w-[1100px] px-6 pb-24 pt-16 sm:pt-24">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[13px] text-muted transition-colors hover:text-ink">
          <span aria-hidden="true">←</span> Back to Scribix
        </Link>
        <header className="mb-10 mt-8 border-b border-line pb-10 sm:mb-12 sm:pb-14">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.2em] text-accent">The Scribix directory</p>
          <h1 className="max-w-[700px] font-display text-5xl leading-[1.05] sm:text-7xl">
            Partners <span className="italic text-muted">&amp; directories</span>
          </h1>
          <div className="mt-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <p className="max-w-[520px] text-[16px] leading-7 text-muted">
              Browse more partners and directories beyond those featured on our homepage. Follow a name or badge to visit their website.
            </p>
            {!unavailable && (
              <p className="shrink-0 text-[12px] uppercase tracking-[0.12em] text-muted">{directoryCount + 1} listings</p>
            )}
          </div>
        </header>
        <section aria-label="ToolPilot partner" className="border-b border-line py-5">
          <a href="https://www.toolpilot.ai/" target="_blank" rel="noopener" className="inline-flex min-h-[52px] items-center">
            {/* Official brand asset; a native image preserves the publisher's SVG. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.toolpilot.ai/cdn/shop/files/tp-b-h_bec97d1a-5538-498b-8a26-77de74f90ed5_690x190_crop_center.svg?v=1695882612"
              alt="ToolPilot.ai"
              width={180}
              height={50}
              className="h-auto w-[180px] object-contain"
            />
          </a>
        </section>
        {unavailable ? (
          <div className="border border-line bg-card p-8 text-muted">
            <h2 className="font-display text-2xl text-ink">The directory is temporarily unavailable</h2>
            <p className="mt-3 text-sm leading-6">Please try again in a moment.</p>
            <a href="/partners" className="mt-5 inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4">Try again</a>
          </div>
        ) : directoryCount ? (
          <div className="text-muted" dangerouslySetInnerHTML={{ __html: renderPartners(links, "directory") }} />
        ) : null}
        <div className="mt-14 border-t border-line pt-7">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted transition-colors hover:text-ink">
            <span aria-hidden="true">←</span> Back to Scribix
          </Link>
        </div>
      </div>
    </main>
    <Footer />
    </Shell>
  );
}
