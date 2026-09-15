export type PublicPost = {
  id: string;
  batchId?: string | null;
  submissionId?: string;
  errorCode?: string;
  mediaId: string;
  caption: string;
  status: string;
  workflowId: string | null;
  source: string;
  scheduledAt: number | null;
  scheduledTimezone: string | null;
  scheduleVersion: number;
  canceledAt: number | null;
  createdAt: number;
  updatedAt: number;
  media: {
    filename: string | null;
    durationMs: number | null;
    width: number | null;
    height: number | null;
    sourceDeletedAt: number | null;
  };
  targets: Array<{
    postId?: string;
    caption?: string;
    canRetry?: boolean;
    id: string;
    accountId: string;
    platform: string;
    status: string;
    stepLabel: string | null;
    progress: number | null;
    platformPostId: string | null;
    permalink: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    attempts: number;
    startedAt: number | null;
    finishedAt: number | null;
    accountName: string | null;
    accountUsername: string | null;
    accountDisconnected: boolean;
    settings: {
      title?: string;
      privacyStatus?: "private" | "unlisted" | "public";
      selfDeclaredMadeForKids?: boolean;
      communityGuidelinesCertified?: boolean;
      tiktokPrivacyLevel?:
        | "PUBLIC_TO_EVERYONE"
        | "MUTUAL_FOLLOW_FRIENDS"
        | "FOLLOWER_OF_CREATOR"
        | "SELF_ONLY";
      tiktokAllowComment?: boolean;
      tiktokAllowDuet?: boolean;
      tiktokAllowStitch?: boolean;
      tiktokIsAigc?: boolean;
      tiktokBrandOrganic?: boolean;
      tiktokBrandedContent?: boolean;
    };
  }>;
};
