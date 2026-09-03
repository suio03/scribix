import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { isAdmin } from "@/lib/admin";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session) redirect({ href: "/", locale });
  if (!isAdmin(session!.user.email)) redirect({ href: "/dashboard", locale });

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-3 sm:px-8">
          <div className="flex items-center gap-6">
            <span className="font-display text-base font-semibold tracking-tight">Admin</span>
            <nav className="flex items-center gap-4 text-[13px]">
              <Link href="/admin/users" className="hover:text-accent">
                Users
              </Link>
              <Link href="/admin/transcripts" className="hover:text-accent">
                Transcripts
              </Link>
            </nav>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
          >
            Back to app
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
