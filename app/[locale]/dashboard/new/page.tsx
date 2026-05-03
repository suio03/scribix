import { getLocale } from "next-intl/server";
import { UploadOrRecord } from "@/app/components/UploadOrRecord";
import { getPathname, Link } from "@/i18n/navigation";

export default async function NewTranscriptPage() {
  const locale = await getLocale();
  const newHref = getPathname({ href: "/dashboard/new", locale });

  return (
    <main className="mx-auto max-w-[720px] px-4 py-12 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">New transcript</h1>
        <Link
          href="/dashboard"
          className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
        >
          Back
        </Link>
      </div>

      <div className="mt-8">
        <UploadOrRecord signedIn={true} postSignInPath={newHref} />
      </div>
    </main>
  );
}
