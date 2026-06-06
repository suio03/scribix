import type { Metadata } from "next";
import NextLink from "next/link";
import { setRequestLocale } from "next-intl/server";
import { LegalShell } from "@/app/components/LegalShell";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for using Scribix transcription.",
  alternates: {
    canonical: "https://scribix.io/terms",
  },
};

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== routing.defaultLocale) {
    redirect({ href: "/terms", locale: routing.defaultLocale });
  }
  setRequestLocale(locale);

  return (
    <LegalShell title="Terms of Service" updated="May 1, 2026">
      <p>
        These terms govern your use of Scribix, a transcription product operated by
        CENDRO LABS PTY LTD (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), and
        the transcription service available at{" "}
        <a className="underline underline-offset-4 hover:text-accent" href="https://scribix.io">
          scribix.io
        </a>
        . By creating an account or using the service you agree to these terms.
      </p>

      <H2>The Service</H2>
      <p>
        Scribix converts audio and video files you upload (or record in-browser) into
        text transcripts. Output quality depends on input quality and is not guaranteed.
      </p>

      <H2>Your Account</H2>
      <p>
        You are responsible for activity on your account and for keeping your sign-in
        credentials safe.
      </p>

      <H2>Your Content</H2>
      <p>
        You retain ownership of the audio, video, and transcripts associated with your
        account. You grant Scribix a limited license to process, transmit, and store this
        content solely to operate the service for you, including upload, transcription,
        storage, and serving the resulting transcript back to you.
      </p>
      <p>
        You are responsible for the rights to upload any content you submit. Don&apos;t upload
        material you don&apos;t have permission to transcribe.
      </p>

      <H2>Acceptable Use</H2>
      <p>
        Don&apos;t use Scribix to transcribe or distribute content that is illegal, infringes
        third-party rights, harasses or threatens others, or attempts to circumvent
        usage limits or extract more service than your plan provides.
      </p>

      <H2>Subscriptions &amp; Billing</H2>
      <p>
        Paid plans renew automatically until cancelled. Your monthly or annual minute
        allowance resets at each renewal. Yearly plans receive their full annual allowance
        upfront. Cancellation is self-service from the account page and takes effect at the
        end of the current period.
      </p>
      <p>
        Subscription payments are processed by Paddle. Paddle may appear on your checkout,
        receipt, billing statement, or subscription management page.
      </p>
      <p>
        Refunds are governed by our{" "}
        <NextLink className="underline underline-offset-4 hover:text-accent" href="/refunds">
          Refund Policy
        </NextLink>
        .
      </p>

      <H2>Storage &amp; Deletion</H2>
      <p>
        Audio and video files are deleted automatically 7 days after upload. Transcripts are
        retained until you delete them or close your account. Deleting a transcript or your
        account removes our copies; operational processing records are purged on a regular
        cadence as part of standard operations.
      </p>

      <H2>Disclaimers</H2>
      <p>
        The service is provided &quot;as is&quot;. We make no warranty about transcript
        accuracy or fitness for any particular purpose. To the maximum extent permitted by
        law, our liability for any claim arising out of these terms or the service is
        limited to what you paid us in the 12 months preceding the claim.
      </p>

      <H2>Termination</H2>
      <p>
        You can stop using Scribix or delete your account at any time. We may suspend or
        terminate accounts that violate these terms.
      </p>

      <H2>Changes</H2>
      <p>
        We may update these terms. Material changes will be reflected on this page with a new
        &quot;Last updated&quot; date. Continued use after a change means you accept the
        updated terms.
      </p>

      <H2>Contact</H2>
      <p>
        Questions? Email{" "}
        <a className="underline underline-offset-4 hover:text-accent" href="mailto:hello@scribix.io">
          hello@scribix.io
        </a>
        .
      </p>
    </LegalShell>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="!mt-12 font-display text-[22px] font-medium tracking-tight">{children}</h2>
  );
}
