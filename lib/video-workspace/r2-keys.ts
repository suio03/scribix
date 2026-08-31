const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const FILE_EXTENSION = /^[a-z0-9]{1,10}$/;

function keySegment(value: string, label: string): string {
  if (!KEY_SEGMENT.test(value)) throw new Error(`invalid_${label}`);
  return value;
}

function fileExtension(value: string): string {
  const extension = value.replace(/^\./, "").toLowerCase();
  if (!FILE_EXTENSION.test(extension)) throw new Error("invalid_file_extension");
  return extension;
}

function projectPrefix(userId: string, projectId: string): string {
  return `users/${keySegment(userId, "user_id")}/video-projects/${keySegment(projectId, "project_id")}/`;
}

export const VideoWorkspaceR2 = {
  projectPrefix,

  previewProxyKey(
    userId: string,
    projectId: string,
    candidateId: string,
    segmentId: string,
    proxyVersion: number
  ): string {
    if (!Number.isInteger(proxyVersion) || proxyVersion < 1) {
      throw new Error("invalid_proxy_version");
    }
    return `${projectPrefix(userId, projectId)}proxies/${keySegment(
      candidateId,
      "candidate_id"
    )}/${keySegment(segmentId, "segment_id")}-${proxyVersion}.mp4`;
  },

  finalVideoKey(userId: string, projectId: string, renderId: string): string {
    return `${projectPrefix(userId, projectId)}renders/${keySegment(
      renderId,
      "render_id"
    )}/final-9x16.mp4`;
  },

  coverKey(userId: string, projectId: string, renderId: string): string {
    return `${projectPrefix(userId, projectId)}renders/${keySegment(
      renderId,
      "render_id"
    )}/cover.jpg`;
  },

  brandAssetKey(userId: string, assetId: string, extension: string): string {
    return `users/${keySegment(userId, "user_id")}/brand-assets/${keySegment(
      assetId,
      "asset_id"
    )}/asset.${fileExtension(extension)}`;
  },
};
