import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname, redirect } from "@/i18n/navigation";
import { TrackSignInSuccess } from "@/app/components/Track";
import { FeedbackWidget } from "@/app/components/FeedbackWidget";
import { WorkspaceChrome } from "@/app/components/WorkspaceChrome";
import { getSidebarUsage } from "@/app/components/sidebarUsage";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session) {
    redirect({ href: "/", locale });
  }
  const homePath = getPathname({ href: "/", locale });
  const sidebarUsage = await getSidebarUsage(session);

  return (
    <>
      <TrackSignInSuccess />
      <WorkspaceChrome
        signOutRedirect={homePath}
        usage={sidebarUsage}
        userImage={session?.user?.image ?? null}
        userLabel={session?.user?.name ?? session?.user?.email ?? null}
      >
        {children}
      </WorkspaceChrome>
      <FeedbackWidget />
    </>
  );
}
