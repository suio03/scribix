import type { Metadata } from "next";
import { Logo } from "@/app/components/Logo";
import { ExtensionLoginButton } from "@/app/components/ExtensionLoginButton";

export const metadata: Metadata = {
  title: "Sign in for Scribix Extension",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ExtensionLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 py-12 text-ink">
      <section className="w-full max-w-sm rounded-xl border border-line bg-card p-6 shadow-sm">
        <div className="mb-8 flex items-center gap-3">
          <Logo size={36} />
          <div>
            <p className="text-lg font-semibold leading-tight">Scribix</p>
            <p className="text-sm text-muted">YouTube Extension</p>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-3xl leading-tight">Sign in to continue</h1>
          <p className="text-sm leading-6 text-muted">
            Use your Scribix account to unlock Pro summaries in the Chrome extension.
          </p>
        </div>

        <div className="mt-7">
          <ExtensionLoginButton callbackUrl={callbackUrl} />
        </div>
      </section>
    </main>
  );
}

function safeCallbackUrl(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "/";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}
