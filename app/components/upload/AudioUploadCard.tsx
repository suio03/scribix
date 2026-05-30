"use client";

import { useRef, useState } from "react";
import { CloudUpload, FileAudio } from "lucide-react";
import { ProgressView, useUpload } from "@/app/components/Uploader";

export type AudioUploadCardCopy = {
  uploadTab: string;
  uploadHint: string;
  instruction: string;
  specs: string;
  button: string;
  signedInButton: string;
};

const AUDIO_ACCEPT = "audio/*";

export function AudioUploadCard({
  signedIn,
  postSignInPath,
  copy,
}: {
  signedIn: boolean;
  postSignInPath: string;
  copy: AudioUploadCardCopy;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { phase, progress, errorMsg, filename, onPick } = useUpload({
    signedIn,
    postSignInPath,
    audioOnly: true,
  });

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-card shadow-[0_30px_80px_-40px_rgba(14,13,11,0.18)]">
      <div className="grain" />

      <div className="relative">
        <div className="flex items-stretch border-b border-line">
          <div className="relative flex flex-1 items-center justify-center gap-2.5 px-4 py-4 text-[14px] text-ink sm:px-6">
            <CloudUpload size={17} strokeWidth={1.6} />
            <span className="font-medium">{copy.uploadTab}</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.15em] text-muted/70 sm:inline">
              {copy.uploadHint}
            </span>
            <span className="absolute inset-x-4 bottom-0 h-0.5 bg-accent sm:inset-x-6" />
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onPick(file);
            }}
            className={`rounded-2xl border border-dashed bg-paper/40 px-6 py-12 text-center transition sm:py-16 ${
              dragOver ? "border-accent bg-accent/5" : "border-line"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={AUDIO_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPick(file);
              }}
            />

            {phase === "idle" || phase === "error" ? (
              <>
                <div className="mx-auto flex w-fit items-center gap-3">
                  <span className="inline-grid size-14 place-items-center rounded-xl bg-sage/15 text-sage">
                    <FileAudio size={26} strokeWidth={1.5} />
                  </span>
                </div>
                <p className="mt-6 text-[15px] text-ink">{copy.instruction}</p>
                <p className="mt-1.5 font-mono text-[12px] uppercase tracking-[0.15em] text-muted">
                  {copy.specs}
                </p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="group mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-medium text-paper transition hover:bg-accent"
                >
                  <CloudUpload
                    size={16}
                    strokeWidth={1.8}
                    className="transition group-hover:-translate-y-0.5"
                  />
                  {signedIn ? copy.signedInButton : copy.button}
                </button>
                {errorMsg ? (
                  <p className="mt-4 text-[13px] text-red-600">{errorMsg}</p>
                ) : null}
              </>
            ) : (
              <ProgressView phase={phase} progress={progress} filename={filename} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
