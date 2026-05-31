import Script from "next/script";

// TODO: fill in your GA4 Measurement ID (e.g. "G-XXXXXXXXXX"). Leave empty to disable GA4.
const GA_MEASUREMENT_ID = "G-6XF4B75V4T";

// TODO: fill in the domain registered in Plausible (e.g. "scribix.io"). Leave empty to disable Plausible.
const PLAUSIBLE_DOMAIN = "scribix.io";
const PLAUSIBLE_SRC = "https://actone.app/js/script.js";
const CLARITY_PROJECT_ID = "wzi7rjoku7";

const Analytics = () => (
  <>
    {GA_MEASUREMENT_ID && (
      <>
        <Script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <Script
          id="google-analytics"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `,
          }}
        />
      </>
    )}
    {PLAUSIBLE_DOMAIN && (
      <Script
        defer
        data-domain={PLAUSIBLE_DOMAIN}
        src={PLAUSIBLE_SRC}
      />
    )}
    {CLARITY_PROJECT_ID && (
      <Script
        id="microsoft-clarity"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
          `,
        }}
      />
    )}
  </>
);

export default Analytics;
