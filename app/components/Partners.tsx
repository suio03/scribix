export function Partners() {
  return (
    <div className="bg-card px-4 pb-10 sm:px-8">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-center gap-3 border-t border-line pt-5 opacity-80">
        <a
          href="https://dang.ai/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Scribix on Dang.ai"
        >
          <img
            src="https://cdn.prod.website-files.com/63d8afd87da01fb58ea3fbcb/6487e2868c6c8f93b4828827_dang-badge.png"
            alt="Dang.ai"
            width="150"
            height="54"
            className="block h-9 w-auto"
          />
        </a>
        <a
          href="https://theresanaiforthat.com/ai/scribix/?ref=featured&v=3028022"
          target="_blank"
          rel="nofollow noopener noreferrer"
          aria-label="Scribix featured on There's An AI For That"
        >
          <img
            src="https://media.theresanaiforthat.com/featured-on-taaft.png?width=600"
            alt="Featured on There's An AI For That"
            width="259"
            height="54"
            className="block h-9 w-auto"
          />
        </a>
        <a
          href="https://startupfa.me/s/scribix?utm_source=scribix.io"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Scribix featured on Startup Fame"
        >
          <img
            src="https://startupfa.me/badges/featured-badge-small.webp"
            alt="Scribix - Featured on Startup Fame"
            width="224"
            height="36"
            className="block h-9 w-auto"
          />
        </a>
      </div>
    </div>
  );
}
