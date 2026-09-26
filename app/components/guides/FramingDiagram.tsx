import type { FramingDiagramCopy } from "@/lib/guides/copy";

// Shared scene geometry; the three viewports demonstrate actual SVG crop/fit behavior.
// These are explanatory shapes, not product output or a tracking simulation.
const FRAMING_EXAMPLES = ["xMidYMid slice", "xMinYMid slice", "xMidYMid meet"] as const;

function InterviewScene() {
  return <>
    <rect width="160" height="90" fill="#28213a" />
    <path d="M0 62H160V90H0Z" fill="#40354f" />
    <rect x="65" y="13" width="30" height="32" rx="3" fill="#524365" />
    <path d="M72 35L79 25L86 32" fill="none" stroke="#8a75a5" strokeWidth="2" />
    <circle cx="31" cy="31" r="11" fill="#e2b991" />
    <path d="M12 76V57Q12 44 31 44Q50 44 50 57V76Z" fill="#a994eb" />
    <circle cx="129" cy="31" r="11" fill="#b78975" />
    <path d="M110 76V57Q110 44 129 44Q148 44 148 57V76Z" fill="#96cdb9" />
    <rect x="50" y="64" width="60" height="6" rx="2" fill="#c0a885" />
    <path d="M55 70V90M105 70V90" stroke="#c0a885" strokeWidth="4" />
  </>;
}

export function FramingDiagram({ copy }: { copy: FramingDiagramCopy }) {
  return (
    <figure className="my-8 rounded-2xl border border-line bg-card p-5 sm:p-6">
      <p className="font-display text-lg font-semibold">{copy.title}</p>
      <div className="mx-auto mt-5 max-w-[320px] overflow-hidden rounded-xl border border-line" aria-hidden="true">
        <svg viewBox="0 0 160 90" className="block w-full"><InterviewScene /></svg>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {FRAMING_EXAMPLES.map((preserveAspectRatio, index) => (
          <div key={preserveAspectRatio} className="min-w-0">
            <svg viewBox="0 0 90 160" aria-hidden="true" className="mx-auto block w-[112px] rounded-xl bg-[#100c19] sm:w-full sm:max-w-[140px]">
              <svg width="90" height="160" viewBox="0 0 160 90" preserveAspectRatio={preserveAspectRatio} overflow="hidden"><InterviewScene /></svg>
            </svg>
            <p className="mt-4 text-sm font-semibold">{copy.items[index].title}</p>
            <p className="mt-2 text-sm text-muted">{copy.items[index].body}</p>
          </div>
        ))}
      </div>
      <figcaption className="mt-6 border-t border-line pt-4 text-xs text-muted">{copy.caption}</figcaption>
    </figure>
  );
}
