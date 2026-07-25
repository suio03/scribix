import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalShell } from "@/app/components/LegalShell";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Scribix collects, uses, and protects your data.",
  alternates: {
    canonical: "https://scribix.io/privacy",
  },
};

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== routing.defaultLocale) {
    redirect({ href: "/privacy", locale: routing.defaultLocale });
  }
  setRequestLocale(locale);

  return (
    <LegalShell title="Privacy Policy" updated="July 25, 2026">
      <p>
        This policy describes what data CENDRO LABS PTY LTD collects when operating
        Scribix, how we use it, and the choices you have. Plain-English summary first;
        details below.
      </p>

      <H2>The Short Version</H2>
      <ul className="ml-5 list-disc space-y-2">
        <li>We collect your email and name to create your account.</li>
        <li>
          We store the audio/video you upload and the transcript we make from it. Audio is
          deleted after 14 days; transcripts stay until you delete them.
        </li>
        <li>
          We process your audio only to generate and deliver transcripts for your account.
        </li>
        <li>
          Our browser extension sends the YouTube page URL you choose to process to Scribix
          so we can retrieve available captions. Paid AI summaries also send the caption text
          to Scribix for summary generation.
        </li>
        <li>We don&apos;t sell your data.</li>
        <li>
          You can delete any transcript at any time. You can delete your whole account from
          the{" "}
          <Link className="underline underline-offset-4 hover:text-accent" href="/dashboard/account">
            account page
          </Link>
          .
        </li>
      </ul>

      <H2>What We Collect</H2>
      <ul className="ml-5 list-disc space-y-2">
        <li>
          <strong>Account:</strong> email, name, avatar, and account identifier used for sign-in.
        </li>
        <li>
          <strong>Content:</strong> audio and video files you upload or record, YouTube URLs
          you ask Scribix to process, available YouTube caption text, and the transcripts and
          summaries produced from them.
        </li>
        <li>
          <strong>Subscription:</strong> billing status, billing cycle, and current plan.
          Payments are handled by Paddle, and we never see or store your full card number.
        </li>
        <li>
          <strong>Usage:</strong> minutes consumed in the current billing period, file size,
          browser-extension quota identifiers, IP-based abuse-prevention data, and basic logs
          needed to operate the service (timestamps and request status).
        </li>
      </ul>

      <H2>How We Use It</H2>
      <ul className="ml-5 list-disc space-y-2">
        <li>To operate the service: store your files, run transcription, return results.</li>
        <li>
          To retrieve available YouTube captions and generate a summary when you request one.
        </li>
        <li>To enforce usage limits and process billing.</li>
        <li>To debug, monitor for abuse, and improve reliability.</li>
        <li>To contact you about your account when needed (e.g. failed payment).</li>
      </ul>

      <H2>Processors</H2>
      <p>
        We use service providers to run Scribix: Cloudflare for hosting, D1 database, and
        R2 file storage; AssemblyAI for transcription processing; Google and NextAuth for
        sign-in; Paddle for subscription checkout, billing, tax, invoices, and payment
        management; OpenAI for paid AI summary generation; Google Analytics, Microsoft
        Clarity, and Plausible-compatible analytics served from actone.app for product
        analytics and reliability monitoring.
      </p>

      <H2>Browser Extension</H2>
      <p>
        The Scribix browser extension runs on desktop YouTube watch pages in supported
        browsers. It reads the current YouTube watch URL and your browser language preferences
        so Scribix can retrieve a suitable available caption track. When you explicitly
        request a paid AI summary, the extension sends the caption snippets to Scribix and
        OpenAI processes them to generate the summary. After you authorize the extension,
        it uses a short-lived access token and a rotating, revocable refresh token for account
        requests. It does not receive or store your password or Scribix website session cookie.
      </p>
      <p>
        The extension stores a random quota identifier and up to 20 recently retrieved
        transcripts in browser-local extension storage. Cached transcripts expire after seven
        days. The refresh token expires after 30 days at the latest; signing out asks Scribix
        to revoke it and removes the local tokens. Access tokens expire after 15 minutes. This
        local extension data is also removed when you clear the extension&apos;s storage or
        uninstall the extension. The extension does not contain advertising trackers or
        execute remotely hosted code.
      </p>

      <H2>Retention</H2>
      <ul className="ml-5 list-disc space-y-2">
        <li>
          <strong>Audio &amp; video:</strong> deleted automatically 14 days after upload.
        </li>
        <li>
          <strong>Transcripts:</strong> kept until you delete them or your account.
        </li>
        <li>
          <strong>Browser-extension cache:</strong> up to 20 transcripts are cached locally
          for up to seven days. Generated summaries may be cached securely by Scribix to
          return repeat requests without processing the same caption text again.
        </li>
        <li>
          <strong>Account record:</strong> kept while your account is open. Soft-deleted
          immediately on account deletion; operational copies are purged on a regular cadence
          as part of standard operations.
        </li>
      </ul>

      <H2>Your Rights</H2>
      <p>
        You can access your data via the dashboard, export transcripts as TXT/SRT/VTT, and
        delete any transcript or your entire account. If you live somewhere with stronger
        rights (GDPR, CCPA, etc.), email us at{" "}
        <a className="underline underline-offset-4 hover:text-accent" href="mailto:hello@scribix.io">
          hello@scribix.io
        </a>{" "}
        and we&apos;ll honor them.
      </p>

      <H2>Security</H2>
      <p>
        Files are private by default and only accessible via short-lived signed URLs.
        Transport is encrypted (HTTPS). We don&apos;t see or store your sign-in password.
      </p>

      <H2>Children</H2>
      <p>Scribix is not directed to children under 13 and we don&apos;t knowingly collect their data.</p>

      <H2>Changes</H2>
      <p>
        We may update this policy. Material changes will be reflected on this page with a new
        &quot;Last updated&quot; date.
      </p>

      <H2>Contact</H2>
      <p>
        Privacy questions or requests:{" "}
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
