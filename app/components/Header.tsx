import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "./Logo";
import { SidebarToggle } from "./SidebarToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

export async function Header() {
  const t = await getTranslations("Header");

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex items-center gap-2">
          {/* <SidebarToggle /> */}
          <a href="#top" className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-display text-[19px] font-semibold tracking-tight">
              Scribix
            </span>
          </a>
        </div>

        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeToggle />
          <a
            href="#generator"
            className="group ml-1 inline-flex items-center gap-1 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-paper transition hover:bg-accent"
          >
            {t("tryFree")}
            <ArrowUpRight
              size={14}
              strokeWidth={2}
              className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </div>
      </div>
    </header>
  );
}
