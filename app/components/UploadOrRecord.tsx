"use client";

import { useState } from "react";
import { Upload, Mic, type LucideIcon } from "lucide-react";
import { Uploader } from "./Uploader";
import { Recorder } from "./Recorder";

type Tab = "upload" | "record";

export function UploadOrRecord({
  signedIn,
  postSignInPath,
}: {
  signedIn: boolean;
  postSignInPath: string;
}) {
  const [tab, setTab] = useState<Tab>("upload");
  return (
    <div>
      <div className="mb-6 inline-flex gap-1 rounded-full border border-line p-1">
        <TabBtn
          active={tab === "upload"}
          onClick={() => setTab("upload")}
          icon={Upload}
          label="Upload"
        />
        <TabBtn
          active={tab === "record"}
          onClick={() => setTab("record")}
          icon={Mic}
          label="Record"
        />
      </div>
      {tab === "upload" ? (
        <Uploader signedIn={signedIn} postSignInPath={postSignInPath} />
      ) : (
        <Recorder signedIn={signedIn} postSignInPath={postSignInPath} />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
        active ? "bg-ink text-paper" : "text-ink/70 hover:text-ink"
      }`}
    >
      <Icon size={14} strokeWidth={1.8} />
      {label}
    </button>
  );
}
