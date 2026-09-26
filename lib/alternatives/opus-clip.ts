import { PLANS } from "@/lib/plans";
import { PRICING_V2 } from "@/lib/pricing-v2";
import { OPUS_ALTERNATIVE_PATH, VIZARD_ALTERNATIVE_PATH } from "./routes";

export const OPUS_COMPARISON = {
  path: OPUS_ALTERNATIVE_PATH,
  title: "OpusClip Alternatives for Podcast Clips",
  description: "Compare Scribix, Vizard and quso.ai with OpusClip for podcast clips. See editing workflows, free-plan limits, monthly pricing and a Scribix product demonstration.",
  published: "2026-09-20",
  modified: "2026-09-26",
  modifiedDisplayDate: "September 26, 2026",
  displayDate: "September 20, 2026",
} as const;

// Editorial snapshot. Source URLs are retained in docs/content/opus-clip-alternatives.md.
// Scribix pricing and allowances come from the product's canonical config.
export const COMPARISON_TOOLS = [
  {
    id: "scribix", name: "Scribix", role: "Review the conversation",
    summary: "For a workflow centered on choosing a complete thought, refining its boundaries and preparing a captioned portrait clip.",
    free: `${PLANS.free.minutesPerCycle} source-processing minutes, once per account`,
    freeLimit: "Clip editing and brand controls require a paid plan.",
    paid: `Starter: $${PRICING_V2.starter.monthlyUsd}/month · Pro: $${PRICING_V2.pro.monthlyUsd}/month`,
    editing: "Candidate review, transcript-based selection, framing and caption controls on paid plans.",
    output: "Portrait MP4; review the actual export before sharing.",
    detail: "Start with a video file. Review suggested moments against the transcript, or select a passage yourself. Paid editing brings the cut, framing and captions into the same workflow. The demonstration below shows how those decisions fit together.",
    caveat: "Choose another tool if Premiere Pro / DaVinci Resolve handoff or several export aspect ratios are essential. Scribix’s current clip output is 9:16. YouTube transcript import is a separate feature from video-file clipping.",
    sourceLabel: "Scribix plans",
  },
  {
    id: "vizard", name: "Vizard", role: "Try editing before upgrading",
    summary: "Worth considering when access to the editor on a recurring free plan is your first priority.",
    free: "60 credits/month", freeLimit: "720p export and 3-day storage; free plan includes the editor.",
    paid: "Creator: $29/month", editing: "Editor available on Free; shared workspace and brand kit on Business.",
    output: "Creator adds watermark removal, 4K export and social scheduling.",
    detail: "Vizard gives you a way to explore editing on its Free plan. Creator adds higher-resolution exports and scheduling; Business adds a shared workspace and brand kit. That tier distinction matters when you are choosing for a team rather than one creator.",
    caveat: "The free tier’s storage window is short. Download what you need, and check the credit amount and team-seat cost before subscribing.",
    sourceLabel: "Vizard pricing",
    comparisonPath: VIZARD_ALTERNATIVE_PATH,
  },
  {
    id: "quso", name: "quso.ai", role: "Connect clips with social planning",
    summary: "A shortlist option when editing and distributing content belong in the same subscription.",
    free: "75 credits/month", freeLimit: "720p rendering, TikTok publishing and 7-day retention.",
    paid: "Lite: $29/month", editing: "Lite includes a desktop editor and three aspect ratios.",
    output: "Lite includes TikTok publishing; Essential adds scheduling to seven platforms.",
    detail: "quso.ai combines clipping with publishing features. Lite covers the editor and TikTok publishing; Essential adds multi-platform scheduling and its Content Planner, while Growth adds brand tools and social analytics. Match the tier to the part of your workflow you want to consolidate.",
    caveat: "Do not assume every social-management feature is included in Lite. Monthly and annual plans also have different credit allowances.",
    sourceLabel: "quso.ai pricing",
  },
  {
    id: "opus", name: "OpusClip", role: "Keep a broader editing handoff",
    summary: "Still a relevant choice if AI B-roll, multiple formats or a desktop-editor handoff are central to your work.",
    free: "60 credits/month", freeLimit: "Watermarked clips, no editing and a 3-day export window.",
    paid: "Starter: $15/month · Pro: $29/month", editing: "Starter adds editing; Pro adds AI B-roll and multiple aspect ratios.",
    output: "Pro includes Premiere Pro / DaVinci Resolve export and a scheduler.",
    detail: "You may not need to switch if OpusClip already fits your production workflow. Its paid plans extend beyond generating clips, and Pro is particularly relevant when work continues in a desktop editor.",
    caveat: "Evaluate the tier you would actually pay for. The free experience does not include the editor, and exports stop being available after three days.",
    sourceLabel: "OpusClip pricing",
  },
] as const;

export const COMPARISON_FAQS = [
  {
    question: "Which OpusClip alternative should I try first?",
    answer: "Try Scribix for a transcript-led review and editing workflow, Vizard to explore an editor on a free plan, or quso.ai when social planning is part of the same task. Keep OpusClip on your shortlist if desktop-editor exports or AI B-roll are important. These are workflow recommendations, not measured quality rankings.",
  },
  {
    question: "Is there a free OpusClip alternative?",
    answer: `All three alternatives offer a free starting point, with different limits. Scribix includes ${PLANS.free.minutesPerCycle} source-processing minutes once per account, with clip editing on paid plans. Vizard and quso.ai list recurring monthly credits. Check editing access, export conditions and storage as well as the credit number.`,
  },
  {
    question: "Can I use a YouTube link instead of uploading a file?",
    answer: "Check the video-import options of the tool and plan you choose. The Scribix clip workflow shown here starts with an uploaded video file. Its YouTube transcript import should not be confused with importing and clipping the source video.",
  },
  {
    question: "Will switching tools give me better-performing clips?",
    answer: "This comparison does not establish that. A useful trial is to check whether you can select a complete thought, correct the cut, keep the picture readable and finish the export. Audience response depends on the material, your editorial choices and where you publish.",
  },
] as const;
