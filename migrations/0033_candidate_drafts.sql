-- Preserve an independent autosaved edit for every generated clip.

ALTER TABLE clip_candidates ADD COLUMN draft_edl_json TEXT;
ALTER TABLE clip_candidates ADD COLUMN draft_render_spec_json TEXT;
ALTER TABLE clip_candidates ADD COLUMN draft_revision INTEGER NOT NULL DEFAULT 0
  CHECK (draft_revision >= 0);

ALTER TABLE project_versions ADD COLUMN candidate_id TEXT
  REFERENCES clip_candidates(id) ON DELETE SET NULL;

CREATE INDEX idx_project_versions_candidate
  ON project_versions(candidate_id, version DESC);

UPDATE project_versions
   SET candidate_id = (
         SELECT candidate_id FROM render_jobs
          WHERE render_jobs.project_version_id = project_versions.id
            AND render_jobs.candidate_id IS NOT NULL
          ORDER BY render_jobs.created_at ASC
          LIMIT 1
       )
 WHERE candidate_id IS NULL;

UPDATE clip_candidates
   SET draft_edl_json = (
         SELECT draft_edl_json FROM video_projects
          WHERE video_projects.id = clip_candidates.project_id
            AND video_projects.user_id = clip_candidates.user_id
            AND video_projects.draft_candidate_id = clip_candidates.id
       ),
       draft_render_spec_json = (
         SELECT draft_render_spec_json FROM video_projects
          WHERE video_projects.id = clip_candidates.project_id
            AND video_projects.user_id = clip_candidates.user_id
            AND video_projects.draft_candidate_id = clip_candidates.id
       ),
       draft_revision = COALESCE((
         SELECT draft_revision FROM video_projects
          WHERE video_projects.id = clip_candidates.project_id
            AND video_projects.user_id = clip_candidates.user_id
            AND video_projects.draft_candidate_id = clip_candidates.id
       ), 0)
 WHERE EXISTS (
         SELECT 1 FROM video_projects
          WHERE video_projects.id = clip_candidates.project_id
            AND video_projects.user_id = clip_candidates.user_id
            AND video_projects.draft_candidate_id = clip_candidates.id
            AND video_projects.draft_edl_json IS NOT NULL
            AND video_projects.draft_render_spec_json IS NOT NULL
       );
