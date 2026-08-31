-- M4 drafts are singular per project. Candidate identity prevents a draft for
-- one shortlist item from being restored into another, while revision guards
-- autosave against silent cross-tab overwrites.

ALTER TABLE video_projects ADD COLUMN draft_candidate_id TEXT;
ALTER TABLE video_projects ADD COLUMN draft_revision INTEGER NOT NULL DEFAULT 0
  CHECK (draft_revision >= 0);

CREATE INDEX idx_video_projects_draft_candidate
  ON video_projects(draft_candidate_id)
  WHERE draft_candidate_id IS NOT NULL AND deleted_at IS NULL;
