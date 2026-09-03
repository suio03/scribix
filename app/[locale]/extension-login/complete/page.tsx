import type { Metadata } from "next";
import { Logo } from "@/app/components/Logo";
import { safeYouTubeReturnUrl } from "@/lib/youtube-return-url";

export const metadata: Metadata = {
  title: "Scribix Extension Signed In",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ExtensionLoginCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnUrl = safeYouTubeReturnUrl(params.returnUrl);

  return (
    <main className="extension-auth-page grid min-h-screen place-items-center bg-paper px-6 py-12 text-ink">
      <section className="extension-auth-card w-full max-w-sm rounded-xl border border-line bg-card p-6 shadow-sm">
        <div className="mb-8 flex items-center gap-2">
          <Logo size={34} variant="app" />
          <div>
            <p className="text-lg font-[560] leading-tight tracking-[-0.035em]">Scribix</p>
            <p className="text-sm text-muted">YouTube Extension</p>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-3xl leading-tight">You are signed in</h1>
          <p className="text-sm leading-6 text-muted">
            Return to YouTube to continue using Scribix summaries.
          </p>
        </div>

        {returnUrl ? (
          <a
            className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-lg bg-ink px-5 text-sm font-semibold text-paper transition hover:opacity-90"
            href={returnUrl}
          >
            Back to YouTube
          </a>
        ) : null}
      </section>
    </main>
  );
}
