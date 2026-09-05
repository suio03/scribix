export type VideoWorkspaceDeletion = {
  projectIds: string[];
  r2Keys: string[];
};

type ProjectSourceRow = {
  source_asset_id: string;
  transcript_id: string;
  r2_key: string;
};

export type RemoveProjectSourceResult =
  | { ok: true }
  | { ok: false; error: "project_not_found" | "source_video_missing" | "project_job_active" };

export type DeleteManualCandidateResult =
  | { ok: true }
  | {
      ok: false;
      error: "candidate_not_found" | "manual_candidate_required" | "candidate_job_active";
    };

export async function videoWorkspaceDeletionForTranscript(
  db: D1Database,
  userId: string,
  transcriptId: string
): Promise<VideoWorkspaceDeletion> {
  const projects = await db.prepare(
    `SELECT id
       FROM video_projects
      WHERE transcript_id = ?1 AND user_id = ?2`
  )
    .bind(transcriptId, userId)
    .all<{ id: string }>();
  return deletionForProjectIds(db, userId, projects.results.map((row) => row.id), true);
}

export async function videoWorkspaceDeletionForProject(
  db: D1Database,
  userId: string,
  projectId: string
): Promise<VideoWorkspaceDeletion | null> {
  const project = await db.prepare(
    `SELECT id FROM video_projects WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
  )
    .bind(projectId, userId)
    .first<{ id: string }>();
  return project ? deletionForProjectIds(db, userId, [project.id], true) : null;
}

export async function removeVideoProjectSource(
  db: D1Database,
  bucket: R2Bucket,
  userId: string,
  projectId: string
): Promise<RemoveProjectSourceResult> {
  const source = await db.prepare(
    `SELECT p.source_asset_id, p.transcript_id, source.r2_key
       FROM video_projects p
       JOIN media_assets source
         ON source.id = p.source_asset_id AND source.user_id = p.user_id
      WHERE p.id = ?1
        AND p.user_id = ?2
        AND p.deleted_at IS NULL
        AND source.kind = 'source'
        AND source.status = 'ready'
        AND source.deleted_at IS NULL
        AND source.r2_key IS NOT NULL`
  )
    .bind(projectId, userId)
    .first<ProjectSourceRow>();
  if (!source) {
    const project = await db.prepare(
      `SELECT id FROM video_projects WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
    ).bind(projectId, userId).first<{ id: string }>();
    return project
      ? { ok: false, error: "source_video_missing" }
      : { ok: false, error: "project_not_found" };
  }
  const activeJob = await db.prepare(
    `SELECT id FROM render_jobs
      WHERE project_id = ?1 AND user_id = ?2
        AND status IN ('queued', 'preparing', 'running', 'uploading')
      LIMIT 1`
  ).bind(projectId, userId).first<{ id: string }>();
  if (activeJob) return { ok: false, error: "project_job_active" };

  const previews = await db.prepare(
    `SELECT id, r2_key
       FROM media_assets
      WHERE project_id = ?1 AND user_id = ?2
        AND kind = 'preview_proxy'
        AND deleted_at IS NULL`
  ).bind(projectId, userId).all<{ id: string; r2_key: string | null }>();
  const keys = [
    source.r2_key,
    ...previews.results.flatMap((asset) => asset.r2_key ? [asset.r2_key] : []),
  ];
  await deleteVideoWorkspaceObjects(bucket, keys);
  await db.batch([
    db.prepare(
      `UPDATE transcripts
          SET audio_r2_key = NULL
        WHERE id = ?1 AND user_id = ?2 AND audio_r2_key = ?3`
    ).bind(source.transcript_id, userId, source.r2_key),
    db.prepare(
      `UPDATE video_projects
          SET source_asset_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND user_id = ?2 AND source_asset_id = ?3`
    ).bind(projectId, userId, source.source_asset_id),
    db.prepare(
      `UPDATE media_assets
          SET status = 'deleted', r2_key = NULL, deleted_at = CURRENT_TIMESTAMP
        WHERE project_id = ?1 AND user_id = ?2
          AND kind IN ('source', 'preview_proxy')
          AND deleted_at IS NULL`
    ).bind(projectId, userId),
  ]);
  return { ok: true };
}

export async function deleteManualClipCandidate(
  db: D1Database,
  bucket: R2Bucket,
  userId: string,
  projectId: string,
  candidateId: string
): Promise<DeleteManualCandidateResult> {
  const candidate = await db.prepare(
    `SELECT origin FROM clip_candidates
      WHERE id = ?1 AND project_id = ?2 AND user_id = ?3 AND status <> 'deleted'`
  ).bind(candidateId, projectId, userId).first<{ origin: string }>();
  if (!candidate) return { ok: false, error: "candidate_not_found" };
  if (candidate.origin !== "manual") {
    return { ok: false, error: "manual_candidate_required" };
  }
  const activeJob = await db.prepare(
    `SELECT id FROM render_jobs
      WHERE project_id = ?1 AND user_id = ?2
        AND status IN ('queued', 'preparing', 'running', 'uploading')
        AND (
          candidate_id = ?3 OR project_version_id IN (
            SELECT id FROM project_versions
             WHERE project_id = ?1 AND user_id = ?2 AND candidate_id = ?3
          )
        )
      LIMIT 1`
  ).bind(projectId, userId, candidateId).first<{ id: string }>();
  if (activeJob) return { ok: false, error: "candidate_job_active" };

  const assets = await db.prepare(
    `SELECT DISTINCT asset.id, asset.r2_key
       FROM render_jobs job
       JOIN media_assets asset
         ON asset.id IN (job.output_asset_id, job.cover_asset_id)
        AND asset.user_id = job.user_id
      WHERE job.project_id = ?1 AND job.user_id = ?2
        AND (
          job.candidate_id = ?3 OR job.project_version_id IN (
            SELECT id FROM project_versions
             WHERE project_id = ?1 AND user_id = ?2 AND candidate_id = ?3
          )
        )`
  ).bind(projectId, userId, candidateId).all<{ id: string; r2_key: string | null }>();
  await deleteVideoWorkspaceObjects(
    bucket,
    assets.results.flatMap((asset) => asset.r2_key ? [asset.r2_key] : [])
  );
  const assetIds = assets.results.map((asset) => asset.id);
  const assetPlaceholders = assetIds.map((_, index) => `?${index + 2}`).join(",");
  const statements = [
    db.prepare(
      `UPDATE video_projects
          SET draft_candidate_id = CASE WHEN draft_candidate_id = ?1 THEN NULL ELSE draft_candidate_id END,
              draft_edl_json = CASE WHEN draft_candidate_id = ?1 THEN NULL ELSE draft_edl_json END,
              draft_render_spec_json = CASE WHEN draft_candidate_id = ?1 THEN NULL ELSE draft_render_spec_json END,
              active_project_version_id = CASE
                WHEN active_project_version_id IN (
                  SELECT id FROM project_versions WHERE candidate_id = ?1
                ) THEN NULL ELSE active_project_version_id END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?2 AND user_id = ?3 AND deleted_at IS NULL`
    ).bind(candidateId, projectId, userId),
    db.prepare(
      `DELETE FROM video_workspace_events
        WHERE user_id = ?1 AND project_id = ?2
          AND (
            candidate_id = ?3 OR render_job_id IN (
              SELECT id FROM render_jobs
               WHERE project_id = ?2 AND user_id = ?1
                 AND (
                   candidate_id = ?3 OR project_version_id IN (
                     SELECT id FROM project_versions
                      WHERE project_id = ?2 AND user_id = ?1 AND candidate_id = ?3
                   )
                 )
            )
          )`
    ).bind(userId, projectId, candidateId),
    db.prepare(
      `DELETE FROM render_jobs
        WHERE project_id = ?1 AND user_id = ?2
          AND (
            candidate_id = ?3 OR project_version_id IN (
              SELECT id FROM project_versions
               WHERE project_id = ?1 AND user_id = ?2 AND candidate_id = ?3
            )
          )`
    ).bind(projectId, userId, candidateId),
    db.prepare(
      `DELETE FROM clip_candidate_feedback_events
        WHERE project_id = ?1 AND user_id = ?2 AND candidate_id = ?3`
    ).bind(projectId, userId, candidateId),
    db.prepare(
      `DELETE FROM project_versions
        WHERE project_id = ?1 AND user_id = ?2 AND candidate_id = ?3`
    ).bind(projectId, userId, candidateId),
    ...(assetIds.length > 0 ? [db.prepare(
      `DELETE FROM media_assets WHERE user_id = ?1 AND id IN (${assetPlaceholders})`
    ).bind(userId, ...assetIds)] : []),
    db.prepare(
      `DELETE FROM clip_candidates
        WHERE id = ?1 AND project_id = ?2 AND user_id = ?3 AND origin = 'manual'`
    ).bind(candidateId, projectId, userId),
    db.prepare(
      `UPDATE video_projects
          SET status = CASE
                WHEN EXISTS (
                  SELECT 1 FROM render_jobs
                   WHERE project_id = ?1 AND user_id = ?2
                     AND kind = 'final' AND status = 'completed'
                     AND superseded_at IS NULL
                ) THEN 'completed'
                ELSE 'candidates_ready'
              END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
    ).bind(projectId, userId),
  ];
  await db.batch(statements);
  return { ok: true };
}

async function deletionForProjectIds(
  db: D1Database,
  userId: string,
  projectIds: string[],
  includeSource: boolean
): Promise<VideoWorkspaceDeletion> {
  if (projectIds.length === 0) return { projectIds: [], r2Keys: [] };
  const placeholders = projectIds.map((_, index) => `?${index + 2}`).join(",");
  const assets = await db.prepare(
    `SELECT r2_key
       FROM media_assets
      WHERE user_id = ?1
        AND project_id IN (${placeholders})
        ${includeSource ? "" : "AND kind <> 'source'"}
        AND r2_key IS NOT NULL`
  )
    .bind(userId, ...projectIds)
    .all<{ r2_key: string }>();
  return {
    projectIds,
    r2Keys: [...new Set(assets.results.map((row) => row.r2_key))],
  };
}

export async function deleteVideoWorkspaceObjects(
  bucket: R2Bucket,
  r2Keys: string[]
): Promise<void> {
  const uniqueKeys = [...new Set(r2Keys)];
  for (let index = 0; index < uniqueKeys.length; index += 1000) {
    await bucket.delete(uniqueKeys.slice(index, index + 1000));
  }
}

export async function hardDeleteVideoProjects(
  db: D1Database,
  userId: string,
  projectIds: string[]
): Promise<void> {
  if (projectIds.length === 0) return;
  const placeholders = projectIds.map((_, index) => `?${index + 2}`).join(",");
  const bind = (statement: string) => db.prepare(statement).bind(userId, ...projectIds);
  await db.batch([
    bind(
      `UPDATE transcripts
          SET audio_r2_key = NULL
        WHERE user_id = ?1
          AND EXISTS (
            SELECT 1
              FROM video_projects project
              JOIN media_assets source
                ON source.id = project.source_asset_id AND source.user_id = project.user_id
             WHERE project.user_id = ?1
               AND project.id IN (${placeholders})
               AND project.transcript_id = transcripts.id
               AND source.r2_key = transcripts.audio_r2_key
          )`
    ),
    bind(
      `UPDATE video_projects
          SET source_asset_id = NULL, active_project_version_id = NULL
        WHERE user_id = ?1 AND id IN (${placeholders})`
    ),
    bind(`DELETE FROM video_workspace_events WHERE user_id = ?1 AND project_id IN (${placeholders})`),
    bind(`DELETE FROM render_jobs WHERE user_id = ?1 AND project_id IN (${placeholders})`),
    bind(`DELETE FROM clip_candidate_feedback_events WHERE user_id = ?1 AND project_id IN (${placeholders})`),
    bind(`DELETE FROM clip_candidates WHERE user_id = ?1 AND project_id IN (${placeholders})`),
    bind(`DELETE FROM project_versions WHERE user_id = ?1 AND project_id IN (${placeholders})`),
    bind(`DELETE FROM media_assets WHERE user_id = ?1 AND project_id IN (${placeholders})`),
    bind(`DELETE FROM video_projects WHERE user_id = ?1 AND id IN (${placeholders})`),
  ]);
}

export function accountVideoWorkspaceDeleteStatements(
  db: D1Database,
  userId: string
): D1PreparedStatement[] {
  return [
    db.prepare(
      `UPDATE video_projects
          SET source_asset_id = NULL, active_project_version_id = NULL
        WHERE user_id = ?1`
    ).bind(userId),
    db.prepare(`DELETE FROM video_workspace_events WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM render_jobs WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM clip_candidate_feedback_events WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM clip_candidates WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM project_versions WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM media_assets WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM brand_templates WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM video_projects WHERE user_id = ?1`).bind(userId),
  ];
}
