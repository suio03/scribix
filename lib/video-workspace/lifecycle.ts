export type VideoWorkspaceDeletion = {
  projectIds: string[];
  r2Keys: string[];
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
  // A project's source object is shared with its transcript. Deleting only the
  // project removes derived assets but leaves that source for transcript playback.
  return project ? deletionForProjectIds(db, userId, [project.id], false) : null;
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
      `UPDATE video_projects
          SET source_asset_id = NULL, active_project_version_id = NULL
        WHERE user_id = ?1 AND id IN (${placeholders})`
    ),
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
    db.prepare(`DELETE FROM render_jobs WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM clip_candidate_feedback_events WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM clip_candidates WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM project_versions WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM media_assets WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM brand_templates WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM video_projects WHERE user_id = ?1`).bind(userId),
  ];
}
