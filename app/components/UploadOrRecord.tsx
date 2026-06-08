"use client";

import { useState } from "react";
import { Upload, Mic, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Uploader } from "./Uploader";
import { Recorder } from "./Recorder";
import type { Tier } from "@/lib/plans";

type Tab = "upload" | "record";

export function UploadOrRecord({
  signedIn,
  postSignInPath,
  tier = "free",
}: {
  signedIn: boolean;
  postSignInPath: string;
  tier?: Tier;
}) {
  const t = useTranslations("Dashboard.uploadOrRecord");
  const [tab, setTab] = useState<Tab>("upload");
  return (
    <div>
      <div className="mb-6 inline-flex gap-1 rounded-full border border-line p-1">
        <TabBtn
          active={tab === "upload"}
          onClick={() => setTab("upload")}
          icon={Upload}
          label={t("upload")}
        />
        <TabBtn
          active={tab === "record"}
          onClick={() => setTab("record")}
          icon={Mic}
          label={t("record")}
        />
      </div>
      {tab === "upload" ? (
        <Uploader signedIn={signedIn} postSignInPath={postSignInPath} tier={tier} />
      ) : (
        <Recorder signedIn={signedIn} postSignInPath={postSignInPath} tier={tier} />
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
