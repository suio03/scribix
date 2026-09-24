"use client";

import { ArrowUpRight } from "lucide-react";
import { getPathname, Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useLoginModal } from "@/app/components/LoginModal";

export function ClipLandingUploadButton({ signedIn, className = "" }: {
  signedIn: boolean;
  className?: string;
}) {
  const { openLogin } = useLoginModal();
  const locale = useLocale();
  const t = useTranslations("LongVideoLanding");
  const destination = getPathname({ href: "/dashboard/new", locale });
  const content = <>{t("upload")} <ArrowUpRight size={18} aria-hidden="true" /></>;

  if (signedIn) {
    return <Link href="/dashboard/new" className={`guide-button ${className}`}>{content}</Link>;
  }

  return (
    <button type="button" onClick={() => openLogin(destination)} className={`guide-button ${className}`}>
      {content}
    </button>
  );
}
