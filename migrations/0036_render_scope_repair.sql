-- Older installations of the preview-job schema retained a project-wide
-- active scope, which incorrectly blocks exports of different clips.
DROP INDEX IF EXISTS idx_render_jobs_active_scope;
DROP INDEX IF EXISTS idx_render_jobs_active_preview_scope;
DROP INDEX IF EXISTS idx_render_jobs_active_final_scope;

CREATE UNIQUE INDEX idx_render_jobs_active_preview_scope
  ON render_jobs(project_id, kind, preset_id, scope_key)
  WHERE kind = 'preview'
    AND status IN ('queued', 'preparing', 'running', 'uploading');
CREATE UNIQUE INDEX idx_render_jobs_active_final_scope
  ON render_jobs(project_version_id, kind, preset_id, scope_key)
  WHERE kind = 'final'
    AND status IN ('queued', 'preparing', 'running', 'uploading');
