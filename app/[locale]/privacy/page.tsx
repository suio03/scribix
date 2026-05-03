import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalShell } from "@/app/components/LegalShell";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Scribix collects, uses, and protects your data.",
};

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LegalShell title="Privacy Policy" updated="May 1, 2026">
      <p>
        This policy describes what data Scribix collects, how we use it, and the choices you
        have. Plain-English summary first; details below.
      </p>

      <H2>The Short Version</H2>
      <ul className="ml-5 list-disc space-y-2">
        <li>We collect your Google email and name to create your account.</li>
        <li>
          We store the audio/video you upload and the transcript we make from it. Audio is
          deleted after 7 days; transcripts stay until you delete them.
        </li>
        <li>
          We send your audio to our speech-recognition provider (AssemblyAI) so they can
          transcribe it. They process it on your behalf and don&apos;t use it to train
          models.
        </li>
        <li>We don&apos;t sell your data and we don&apos;t run advertising trackers.</li>
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
          <strong>Account:</strong> email, name, avatar, and Google subject ID, provided by
          Google when you sign in.
        </li>
        <li>
          <strong>Content:</strong> audio and video files you upload or record, and the
          transcripts produced from them.
        </li>
        <li>
          <strong>Subscription:</strong> Creem customer ID, billing cycle, and current plan.
          We never see your card number — Creem handles payment.
        </li>
        <li>
          <strong>Usage:</strong> minutes consumed in the current billing period, file size,
          and basic logs needed to operate the service (timestamps, request status).
        </li>
      </ul>

      <H2>How We Use It</H2>
      <ul className="ml-5 list-disc space-y-2">
        <li>To operate the service: store your files, run transcription, return results.</li>
        <li>To enforce usage limits and process billing.</li>
        <li>To debug, monitor for abuse, and improve reliability.</li>
        <li>To contact you about your account when needed (e.g. failed payment).</li>
      </ul>

      <H2>Subprocessors</H2>
      <ul className="ml-5 list-disc space-y-2">
        <li>
          <strong>Cloudflare</strong> — application hosting, file storage (R2), and database
          (D1).
        </li>
        <li>
          <strong>AssemblyAI</strong> — speech-recognition. We send the signed audio URL;
          they transcribe and return the text.
        </li>
        <li>
          <strong>Creem</strong> — subscription billing and payment processing.
        </li>
        <li>
          <strong>Google</strong> — sign-in via OAuth.
        </li>
      </ul>

      <H2>Retention</H2>
      <ul className="ml-5 list-disc space-y-2">
        <li>
          <strong>Audio &amp; video:</strong> deleted automatically 7 days after upload.
        </li>
        <li>
          <strong>Transcripts:</strong> kept until you delete them or your account.
        </li>
        <li>
          <strong>Account record:</strong> kept while your account is open. Soft-deleted
          immediately on account deletion; copies held by our speech-recognition provider
          are purged on a regular cadence as part of standard operations.
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
        Transport is encrypted (HTTPS). We don&apos;t see or store your Google password.
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
