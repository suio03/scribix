import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalShell } from "@/app/components/LegalShell";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Scribix refund policy — 14-day refund request window and how to request a refund for a subscription.",
  alternates: {
    canonical: "https://scribix.io/refunds",
  },
};

export default async function RefundsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== routing.defaultLocale) {
    redirect({ href: "/refunds", locale: routing.defaultLocale });
  }
  setRequestLocale(locale);

  return (
    <LegalShell title="Refund Policy" updated="June 7, 2026">
      <p>
        Scribix is a product operated by CENDRO LABS PTY LTD. We want you to feel confident
        about your purchase. We understand that circumstances change, and you may
        occasionally need to request a refund. Please read this policy carefully before
        subscribing.
      </p>

      <H2>Refund Eligibility</H2>
      <p>
        Refund requests apply only to <strong>subscription purchases</strong> (Starter or Pro Unlimited,
        monthly or yearly) and must be submitted within <strong>14 days of the purchase date</strong>.
      </p>
      <p>
        Renewals are treated like new purchases: a yearly or monthly renewal is eligible for a
        refund request within 14 days of the renewal date.
      </p>

      <H2>How to Request a Refund</H2>
      <p>
        Subscription payments are processed by Paddle. You may request a refund from us at{" "}
        <a className="underline underline-offset-4 hover:text-accent" href="mailto:hello@scribix.io">
          hello@scribix.io
        </a>{" "}
        or through the support and subscription links provided by Paddle on your receipt or
        customer portal.
      </p>
      <ol className="ml-5 list-decimal space-y-2">
        <li>
          <strong>Contact us</strong> at{" "}
          <a className="underline underline-offset-4 hover:text-accent" href="mailto:hello@scribix.io">
            hello@scribix.io
          </a>
          .
        </li>
        <li>
          <strong>Include</strong> your account email, the email used at checkout, the order
          or invoice ID, the date of purchase, and a brief reason for the request.
        </li>
        <li>
          <strong>Submit within 14 days</strong> of the original purchase or renewal.
        </li>
      </ol>

      <H2>Processing</H2>
      <p>
        Refund requests are processed under Paddle&apos;s refund policy and applicable law.
        Approved refunds are returned to the original payment method.
      </p>

      <H2>Cancel Anytime</H2>
      <p>
        Even outside the refund window you can cancel at any time from your{" "}
        <Link className="underline underline-offset-4 hover:text-accent" href="/dashboard/account">
          account page
        </Link>
        . Cancellation stops the next renewal — your current paid plan and remaining
        minutes stay active until the end of the period you already paid for.
      </p>

      <H2>Changes to This Policy</H2>
      <p>
        We may update this policy from time to time. Material changes will be reflected on
        this page with a new &quot;Last updated&quot; date.
      </p>

      <H2>Questions</H2>
      <p>
        If anything here is unclear, or you&apos;d like help understanding whether your
        situation qualifies, write to{" "}
        <a className="underline underline-offset-4 hover:text-accent" href="mailto:hello@scribix.io">
          hello@scribix.io
        </a>{" "}
        before purchasing — we&apos;re happy to talk through it.
      </p>
    </LegalShell>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="!mt-12 font-display text-[22px] font-medium tracking-tight">{children}</h2>
  );
}
