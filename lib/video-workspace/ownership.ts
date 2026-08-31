export type OwnedVideoProject = {
  id: string;
  user_id: string;
  transcript_id: string;
  source_asset_id: string | null;
  status: string;
  draft_edl_json: string | null;
  draft_render_spec_json: string | null;
  draft_candidate_id: string | null;
  draft_revision: number;
  active_project_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OwnedMediaAsset = {
  id: string;
  user_id: string;
  project_id: string | null;
  kind: string;
  r2_key: string | null;
  mime_type: string;
  bytes: number | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  status: string;
  expires_at: string | null;
  created_at: string;
};

export type OwnedRenderJob = {
  id: string;
  user_id: string;
  project_id: string;
  project_version_id: string | null;
  candidate_id: string | null;
  segment_index: number | null;
  segment_id: string | null;
  kind: string;
  preset_id: string;
  scope_key: string;
  status: string;
  output_asset_id: string | null;
  cover_asset_id: string | null;
  error_code: string | null;
};

export async function ownedVideoProject(
  db: D1Database,
  projectId: string,
  userId: string
): Promise<OwnedVideoProject | null> {
  return db.prepare(
    `SELECT id, user_id, transcript_id, source_asset_id, status,
            draft_edl_json, draft_render_spec_json, draft_candidate_id,
            draft_revision, active_project_version_id,
            created_at, updated_at
       FROM video_projects
      WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
  )
    .bind(projectId, userId)
    .first<OwnedVideoProject>();
}

export async function ownedMediaAsset(
  db: D1Database,
  assetId: string,
  userId: string
): Promise<OwnedMediaAsset | null> {
  return db.prepare(
    `SELECT id, user_id, project_id, kind, r2_key, mime_type, bytes,
            duration_ms, width, height, status, expires_at, created_at
       FROM media_assets
      WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
  )
    .bind(assetId, userId)
    .first<OwnedMediaAsset>();
}

export async function ownedProjectAsset(
  db: D1Database,
  assetId: string,
  projectId: string,
  userId: string
): Promise<OwnedMediaAsset | null> {
  return db.prepare(
    `SELECT a.id, a.user_id, a.project_id, a.kind, a.r2_key, a.mime_type,
            a.bytes, a.duration_ms, a.width, a.height, a.status, a.expires_at,
            a.created_at
       FROM media_assets a
       JOIN video_projects p
         ON p.id = a.project_id AND p.user_id = a.user_id
      WHERE a.id = ?1
        AND a.project_id = ?2
        AND a.user_id = ?3
        AND a.deleted_at IS NULL
        AND p.deleted_at IS NULL`
  )
    .bind(assetId, projectId, userId)
    .first<OwnedMediaAsset>();
}

export async function ownedRenderJob(
  db: D1Database,
  jobId: string,
  userId: string
): Promise<OwnedRenderJob | null> {
  return db.prepare(
    `SELECT j.id, j.user_id, j.project_id, j.project_version_id, j.candidate_id,
            j.segment_index, j.segment_id, j.kind,
            j.preset_id, j.scope_key, j.status, j.output_asset_id,
            j.cover_asset_id, j.error_code
       FROM render_jobs j
       JOIN video_projects p
         ON p.id = j.project_id AND p.user_id = j.user_id
      WHERE j.id = ?1
        AND j.user_id = ?2
        AND p.deleted_at IS NULL`
  )
    .bind(jobId, userId)
    .first<OwnedRenderJob>();
}
