import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname, redirect } from "@/i18n/navigation";
import { TrackSignInSuccess } from "@/app/components/Track";
import { FeedbackWidget } from "@/app/components/FeedbackWidget";
import { Header } from "@/app/components/Header";
import { Shell } from "@/app/components/Shell";
import { Sidebar } from "@/app/components/Sidebar";
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
  const dashboardPath = getPathname({ href: "/dashboard", locale });
  const sidebarUsage = await getSidebarUsage(session);

  return (
    <>
      <TrackSignInSuccess />
      <Shell
        sidebar={
          <Sidebar
            variant="dashboard"
            usage={sidebarUsage}
            signedIn={true}
            signInRedirect={dashboardPath}
            signOutRedirect={homePath}
            userImage={session?.user?.image ?? null}
            userLabel={session?.user?.name ?? session?.user?.email ?? null}
          />
        }
      >
        <Header showSidebarToggle />
        {children}
        <FeedbackWidget />
      </Shell>
    </>
  );
}
