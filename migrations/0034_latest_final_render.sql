-- Keep only the latest completed export available for each generated clip.
-- Historical render rows remain for operational debugging, while their media
-- assets are removed from R2 by the result handler and cleanup worker.

ALTER TABLE render_jobs ADD COLUMN superseded_at DATETIME;

CREATE INDEX idx_render_jobs_superseded_assets
  ON render_jobs(superseded_at, updated_at)
  WHERE kind = 'final' AND superseded_at IS NOT NULL;

-- Mark any existing older completed exports. Project-version numbers are
-- monotonic within a project, so a higher version represents a newer edit.
UPDATE render_jobs AS current_job
   SET superseded_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
 WHERE current_job.kind = 'final'
   AND current_job.status = 'completed'
   AND current_job.superseded_at IS NULL
   AND EXISTS (
     SELECT 1
       FROM project_versions current_version
       JOIN render_jobs newer_job
         ON newer_job.project_id = current_job.project_id
        AND newer_job.user_id = current_job.user_id
        AND newer_job.kind = 'final'
        AND newer_job.status = 'completed'
        AND newer_job.id <> current_job.id
       JOIN project_versions newer_version
         ON newer_version.id = newer_job.project_version_id
        AND newer_version.user_id = newer_job.user_id
      WHERE current_version.id = current_job.project_version_id
        AND current_version.user_id = current_job.user_id
        AND current_version.candidate_id IS NOT NULL
        AND newer_version.candidate_id = current_version.candidate_id
        AND (
          newer_version.version > current_version.version
          OR (
            newer_version.version = current_version.version
            AND (
              newer_job.created_at > current_job.created_at
              OR (
                newer_job.created_at = current_job.created_at
                AND newer_job.id > current_job.id
              )
            )
          )
        )
   );
