import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { Shell } from "../components/Shell";
import { Sidebar } from "../components/Sidebar";
import { Header } from "../components/Header";
import { Generator } from "../components/Generator";
import { TrustStrip } from "../components/TrustStrip";
import { Features } from "../components/Features";
import { HowItWorks } from "../components/HowItWorks";
import { UseCases } from "../components/UseCases";
import { Comparison } from "../components/Comparison";
import { Testimonials } from "../components/Testimonials";
import { Pricing } from "../components/Pricing";
import { FAQ } from "../components/FAQ";
import { FinalCTA } from "../components/FinalCTA";
import { Footer } from "../components/Footer";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const postSignInPath = getPathname({ href: "/dashboard/new", locale });

  return (
    <Shell /* sidebar={<Sidebar />} */>
      <Header />
      <main>
        <Generator signedIn={!!session} postSignInPath={postSignInPath} />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <UseCases />
        <Comparison />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </Shell>
  );
}
