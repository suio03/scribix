import Link from "next/link";
import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? session?.user?.email ?? "there";

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-12 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Welcome back, {name}.
          </h1>
          <p className="mt-1 text-sm text-ink/60">Your transcripts will appear here.</p>
        </div>
        <Link
          href="/dashboard/account"
          className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
        >
          Account
        </Link>
      </div>

      <div className="mt-10 rounded-2xl border border-dashed border-line p-12 text-center">
        <p className="text-sm text-ink/60">No transcripts yet.</p>
        <p className="mt-1 text-xs text-ink/40">
          Upload or record audio from the home page to get started.
        </p>
      </div>
    </main>
  );
}
