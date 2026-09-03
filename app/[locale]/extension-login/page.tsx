import type { Metadata } from "next";
import { auth } from "@/auth";
import { ExtensionAuthorizeButton } from "@/app/components/ExtensionAuthorizeButton";
import { Logo } from "@/app/components/Logo";
import { ExtensionLoginButton } from "@/app/components/ExtensionLoginButton";
import {
  ExtensionAuthError,
  parseExtensionAuthorizationRequest,
  type ExtensionAuthorizationRequest,
} from "@/lib/extension-auth";
import { safeYouTubeReturnUrl } from "@/lib/youtube-return-url";

export const metadata: Metadata = {
  title: "Sign in for Scribix Extension",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ExtensionLoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    returnUrl?: string | string[];
    redirectUri?: string | string[];
    codeChallenge?: string | string[];
    state?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const oauthValues = {
    redirectUri: firstValue(params.redirectUri),
    codeChallenge: firstValue(params.codeChallenge),
    state: firstValue(params.state),
  };
  const hasOAuthParams = Object.values(oauthValues).some(Boolean);
  let oauthRequest: ExtensionAuthorizationRequest | null = null;
  let invalidOAuthRequest = false;
  if (hasOAuthParams) {
    try {
      oauthRequest = parseExtensionAuthorizationRequest(oauthValues);
    } catch (error) {
      if (error instanceof ExtensionAuthError) invalidOAuthRequest = true;
      else throw error;
    }
  }

  const returnUrl = safeYouTubeReturnUrl(params.returnUrl);
  const redirectTo = oauthRequest
    ? `/extension-login?${new URLSearchParams({
        redirectUri: oauthRequest.redirectUri,
        codeChallenge: oauthRequest.codeChallenge,
        state: oauthRequest.state,
      })}`
    : `/extension-login/complete${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`;
  const session = oauthRequest ? await auth() : null;

  return (
    <main className="extension-auth-page grid min-h-screen place-items-center bg-paper px-6 py-12 text-ink">
      <section className="extension-auth-card w-full max-w-sm rounded-xl border border-line bg-card p-6 shadow-sm">
        <div className="mb-8 flex items-center gap-2">
          <Logo size={34} />
          <div>
            <p className="text-lg font-[560] leading-tight tracking-[-0.035em]">Scribix</p>
            <p className="text-sm text-muted">YouTube Extension</p>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-3xl leading-tight">Sign in to continue</h1>
          <p className="text-sm leading-6 text-muted">
            Use your Scribix account to unlock Pro summaries in the browser extension.
          </p>
        </div>

        <div className="mt-7">
          {invalidOAuthRequest ? (
            <p className="text-sm text-red-700" role="alert">
              This extension sign-in request is invalid. Return to the extension and try again.
            </p>
          ) : oauthRequest && session ? (
            <ExtensionAuthorizeButton
              redirectUri={oauthRequest.redirectUri}
              codeChallenge={oauthRequest.codeChallenge}
              state={oauthRequest.state}
            />
          ) : (
            <ExtensionLoginButton redirectTo={redirectTo} />
          )}
        </div>
      </section>
    </main>
  );
}

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}
