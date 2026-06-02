"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export function DashboardHeaderLink() {
  const pathname = usePathname();
  const t = useTranslations("Dashboard.layout");
  const isAccountPage = pathname === "/dashboard/account";

  return (
    <Link
      href={isAccountPage ? "/dashboard" : "/dashboard/account"}
      className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
    >
      {isAccountPage ? t("dashboard") : t("account")}
    </Link>
  );
}
