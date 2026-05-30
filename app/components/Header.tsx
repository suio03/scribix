import { Link } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { SidebarToggle } from "./SidebarToggle";

export function Header({
  showSidebarToggle = false,
}: {
  showLanguageSwitcher?: boolean;
  showSidebarToggle?: boolean;
} = {}) {
  return (
    <header
      className={`sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur ${
        showSidebarToggle ? "lg:hidden" : ""
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {showSidebarToggle ? (
            <SidebarToggle />
          ) : (
            <Link href="/" className="flex items-center gap-2.5">
              <Logo size={28} />
              <span className="font-display text-[19px] font-semibold tracking-tight">
                Scribix
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
