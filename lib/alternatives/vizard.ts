import { PRICING_V2 } from "@/lib/pricing-v2";
import { VIZARD_ALTERNATIVE_PATH } from "./routes";

export const VIZARD_COMPARISON = {
  path: VIZARD_ALTERNATIVE_PATH,
  title: "Vizard Alternative for Podcast Clips: Scribix Compared",
  description: "Considering a Vizard alternative? Compare Scribix for podcast clips: free editing limits, monthly and annual plans, transcript controls and what you give up by switching.",
  published: "2026-09-26",
  modified: "2026-09-26",
  displayDate: "September 26, 2026",
} as const;

// Dated vendor snapshot; full sources are recorded in docs/content/vizard-alternative.md.
export const VIZARD_COMPARISON_ROWS = [
  { label: "Free allowance", scribix: `${PRICING_V2.free.processingMinutes} source-processing minutes, once per account.`, vizard: "60 credits each month; one credit is one minute of uploaded video." },
  { label: "Editing on Free", scribix: "Review and export an original AI candidate. Editing and brand controls require a paid plan.", vizard: "Full access to the video editor; 720p exports and 3-day storage." },
  { label: "Entry plan · monthly billing", scribix: `Starter: $${PRICING_V2.starter.monthlyUsd}/month for ${PRICING_V2.starter.processingMinutes} processing minutes/month.`, vizard: "Creator: $29/month at the 600 credits/month setting." },
  { label: "Entry plan · annual billing", scribix: `$${PRICING_V2.starter.yearlyUsd}/year. ${PRICING_V2.starter.processingMinutes} minutes reset monthly; unused minutes do not roll over.`, vizard: "$174/year at the 7,200 credits/year setting. Check the annual credit terms before subscribing." },
  { label: "Working with the transcript", scribix: "Locate a passage and refine its start and end. No in-clip sentence deletion or rearranging.", vizard: "Delete transcript text to remove the corresponding video content." },
  { label: "Output and collaboration", scribix: "Portrait 9:16 clips with framing and caption controls on paid plans. Not a shared team editing workspace.", vizard: "Creator lists 4K export and scheduling. Business adds shared workspace and brand tools." },
] as const;

export const VIZARD_FAQS = [
  { question: "Is Scribix a free Vizard alternative?", answer: `You can try it with ${PRICING_V2.free.processingMinutes} source-processing minutes once per account and export an original AI candidate. Editing and brand controls require a paid plan. Vizard offers recurring monthly free credits and access to its editor, so it may be a better fit if free editing is your priority.` },
  { question: "Can I delete a sentence from the middle of a clip?", answer: "Not in Scribix’s current editor. You can adjust where a clip starts and ends, but deleting or rearranging sentences inside it is not an available editing workflow. Vizard documents text-based deletion; choose around the kind of edit you need." },
  { question: "Can I paste a YouTube link to make a clip?", answer: "The Scribix video clipping workflow starts with a video file you upload. Its YouTube transcript import is a separate feature and does not import the original video for clipping." },
  { question: "Is Scribix cheaper than Vizard?", answer: `Scribix Starter is $${PRICING_V2.starter.monthlyUsd}/month for ${PRICING_V2.starter.processingMinutes} source-processing minutes. Vizard Creator is $29/month at its 600 credits/month setting. Their free access, annual credit terms and included features also differ, so compare the plan you would actually use. This is not a claim that Scribix is cheaper.` },
  { question: "Can I move an existing Vizard project into Scribix?", answer: "There is no Vizard project importer. Start from an original video file you have permission to use and make a new Scribix project. Saved edits, templates and team settings do not transfer." },
  { question: "Will switching give me better clips?", answer: "This article does not establish that. It compares published features with Scribix’s workflow and shows an existing Scribix export. Try a recording you know, check the context at both ends and watch the final file before deciding." },
] as const;
