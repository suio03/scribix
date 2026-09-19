"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Scissors, SlidersHorizontal, Captions } from "lucide-react";

const STEPS = [
  { title: "Find the thought", subtitle: "Review suggested moments", icon: Scissors },
  { title: "Make it your cut", subtitle: "Set boundaries and framing", icon: SlidersHorizontal },
  { title: "Finish the clip", subtitle: "Style captions, then export", icon: Captions },
] as const;

export function ComparisonDemo() {
  const [step, setStep] = useState(0);
  return (
    <figure className="comparison-demo">
      <div className="comparison-demo-toolbar">
        <span className="font-semibold">Scribix <span className="font-normal opacity-60">/ Inside the workflow</span></span>
        <span className="comparison-demo-tag">Product illustration</span>
      </div>
      <div className="comparison-demo-steps" role="group" aria-label="Explore the Scribix workflow">
        {STEPS.map(({ title, subtitle, icon: Icon }, index) => (
          <button key={title} type="button" aria-pressed={step === index}
            aria-controls="comparison-demo-scene" onClick={() => setStep(index)}>
            <span className="comparison-step-icon"><Icon size={19} strokeWidth={1.6} /></span>
            <span><strong>{title}</strong><small>{subtitle}</small></span>
            <span className="comparison-step-number">0{index + 1}</span>
          </button>
        ))}
      </div>
      <div className="comparison-demo-scene" id="comparison-demo-scene">
        <div className="comparison-demo-editor" key={step} aria-live="polite">
          {step === 0 ? <>
            <p className="comparison-demo-kicker">01 / Listen for the complete idea</p>
            <h3>Good clips begin<br />with a good selection.</h3>
            <div className="comparison-candidates">
              {[
                ["Zverev’s calm US Open performance", "00:01–00:59", "Selected moment"],
                ["Zverev’s high-percentage tactics against Shelton", "01:30–02:50", "Another angle"],
                ["Why Zverev is becoming more relatable", "03:53–04:59", "A different story"],
              ].map(([title, time, label], index) => (
                <div key={title} className={`comparison-candidate ${index === 0 ? "is-selected" : ""}`}>
                  <span className="comparison-candidate-marker">{index === 0 ? <Check size={15} /> : `0${index + 1}`}</span>
                  <div><strong>{title}</strong><small>{time} <span>· {label}</span></small></div>
                </div>
              ))}
            </div>
          </> : step === 1 ? <>
            <p className="comparison-demo-kicker">02 / Keep the context</p>
            <h3>The beginning.<br />The ending. The frame.</h3>
            <div className="comparison-range">
              <div><span>Start</span><strong>00:01.663</strong></div>
              <Scissors size={18} />
              <div><span>End</span><strong>00:59.087</strong></div>
            </div>
            <div className="comparison-waveform" aria-hidden="true">
              {Array.from({ length: 44 }, (_, i) => <i key={i} style={{height: `${18 + ((i * 17 + 11) % 45)}px`}} />)}
              <span />
            </div>
            <div className="comparison-setting"><span>Framing</span><strong>Automatic follow</strong></div>
            <div className="comparison-setting"><span>Output shape</span><strong>9:16 portrait</strong></div>
            <p className="comparison-demo-note">Check the source around both boundaries before you commit to the cut.</p>
          </> : <>
            <p className="comparison-demo-kicker">03 / Give the words room</p>
            <h3>A readable finish.<br />A file you can review.</h3>
            <div className="comparison-caption-sample" aria-label="Illustrative caption style: Make the words count">
              MAKE THE<br /><mark>WORDS</mark> COUNT.
            </div>
            <div className="comparison-setting"><span>Caption style</span><strong>Karaoke punch</strong></div>
            <div className="comparison-setting"><span>Text / highlight</span><span className="comparison-swatches"><i /><i /></span></div>
            <p className="comparison-demo-note">Preview the full clip, then download the MP4. Editing requires a paid plan.</p>
          </>}
        </div>
        <div className="comparison-demo-preview">
          <span className="comparison-preview-label">FROM THE GUIDE</span>
          <div className="comparison-phone">
            <Image src="/media/guides/podcast-tiktok/export-poster.jpg" alt="Existing Scribix podcast export with captions and its original letterboxing" width={1080} height={1920} sizes="(max-width: 640px) 200px, 240px" />
          </div>
          <span className="comparison-preview-footer"><span /> Actual export frame · 9:16</span>
        </div>
      </div>
      <figcaption>Illustrated controls with existing Guide media. Caption sample and waveform are illustrative; the export frame is unchanged. Source: Changeover Podcast.</figcaption>
    </figure>
  );
}
