import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { auth, signIn } from "@/auth";
import { getPathname, Link } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { SidebarToggle } from "./SidebarToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

export async function Header() {
  const t = await getTranslations("Header");
  const session = await auth();
  const locale = await getLocale();
  const dashboardHref = getPathname({ href: "/dashboard", locale });

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex items-center gap-2">
          {/* <SidebarToggle /> */}
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-display text-[19px] font-semibold tracking-tight">
              Scribix
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeToggle />

          {session ? (
            <Link
              href={dashboardHref}
              className="ml-1 inline-flex items-center gap-2 rounded-full border border-line px-2 py-1 text-[13px] font-medium hover:bg-ink/5"
            >
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt=""
                  width={22}
                  height={22}
                  className="rounded-full"
                />
              ) : (
                <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-ink/10 text-[11px]">
                  {(session.user.name ?? session.user.email ?? "?")[0]?.toUpperCase()}
                </span>
              )}
              <span className="pr-1">Dashboard</span>
            </Link>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: dashboardHref });
              }}
            >
              <button
                type="submit"
                className="ml-1 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
              >
                Sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
