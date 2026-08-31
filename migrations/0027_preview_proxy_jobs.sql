-- Preview jobs are created before M4 snapshots an immutable project version.
-- Store their candidate/segment source ranges directly on the job so workers
-- never need to trust mutable browser input.

PRAGMA foreign_keys = OFF;

DROP INDEX idx_render_jobs_active_scope;
DROP INDEX idx_render_jobs_user_created;
DROP INDEX idx_render_jobs_project_status;

CREATE TABLE render_jobs_new (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES users(id),
  project_id             TEXT NOT NULL REFERENCES video_projects(id),
  project_version_id     TEXT REFERENCES project_versions(id),
  candidate_id           TEXT,
  segment_index          INTEGER CHECK (segment_index IS NULL OR segment_index >= 0),
  segment_id             TEXT,
  source_start_ms        INTEGER CHECK (source_start_ms IS NULL OR source_start_ms >= 0),
  source_end_ms          INTEGER CHECK (source_end_ms IS NULL OR source_end_ms > 0),
  proxy_source_start_ms  INTEGER CHECK (
                           proxy_source_start_ms IS NULL OR proxy_source_start_ms >= 0
                         ),
  proxy_source_end_ms    INTEGER CHECK (
                           proxy_source_end_ms IS NULL OR proxy_source_end_ms > 0
                         ),
  proxy_version          INTEGER CHECK (proxy_version IS NULL OR proxy_version > 0),
  kind                   TEXT NOT NULL CHECK (kind IN ('preview', 'final')),
  preset_id              TEXT NOT NULL,
  scope_key              TEXT NOT NULL DEFAULT 'default',
  provider               TEXT,
  provider_job_id        TEXT,
  status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN (
                             'draft', 'queued', 'preparing', 'running', 'uploading',
                             'completed', 'failed', 'canceled'
                           )),
  attempt                INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  idempotency_key        TEXT NOT NULL,
  output_asset_id        TEXT REFERENCES media_assets(id),
  error_code             TEXT
                           CHECK (error_code IS NULL OR error_code IN (
                             'invalid_source', 'unsupported_codec', 'invalid_edl',
                             'invalid_render_spec', 'asset_missing', 'download_failed',
                             'render_failed', 'upload_failed', 'provider_unavailable',
                             'job_timed_out'
                           )),
  queued_at              DATETIME,
  started_at             DATETIME,
  completed_at           DATETIME,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, idempotency_key),
  UNIQUE (id, user_id),
  CHECK (
    (
      kind = 'preview'
      AND project_version_id IS NULL
      AND candidate_id IS NOT NULL
      AND segment_index IS NOT NULL
      AND segment_id IS NOT NULL
      AND source_start_ms IS NOT NULL
      AND source_end_ms IS NOT NULL
      AND proxy_source_start_ms IS NOT NULL
      AND proxy_source_end_ms IS NOT NULL
      AND proxy_version IS NOT NULL
      AND source_start_ms < source_end_ms
      AND proxy_source_start_ms <= source_start_ms
      AND proxy_source_end_ms >= source_end_ms
      AND proxy_source_start_ms < proxy_source_end_ms
    )
    OR
    (
      kind = 'final'
      AND project_version_id IS NOT NULL
      AND candidate_id IS NULL
      AND segment_index IS NULL
      AND segment_id IS NULL
      AND source_start_ms IS NULL
      AND source_end_ms IS NULL
      AND proxy_source_start_ms IS NULL
      AND proxy_source_end_ms IS NULL
      AND proxy_version IS NULL
    )
  )
);

INSERT INTO render_jobs_new (
  id, user_id, project_id, project_version_id, kind, preset_id, scope_key,
  provider, provider_job_id, status, attempt, idempotency_key, output_asset_id,
  error_code, queued_at, started_at, completed_at, created_at, updated_at
)
SELECT
  id, user_id, project_id, project_version_id, kind, preset_id, scope_key,
  provider, provider_job_id, status, attempt, idempotency_key, output_asset_id,
  error_code, queued_at, started_at, completed_at, created_at, created_at
FROM render_jobs;

DROP TABLE render_jobs;
ALTER TABLE render_jobs_new RENAME TO render_jobs;

CREATE UNIQUE INDEX idx_render_jobs_active_preview_scope
  ON render_jobs(project_id, kind, preset_id, scope_key)
  WHERE kind = 'preview'
    AND status IN ('queued', 'preparing', 'running', 'uploading');
CREATE UNIQUE INDEX idx_render_jobs_active_final_scope
  ON render_jobs(project_version_id, kind, preset_id, scope_key)
  WHERE kind = 'final'
    AND status IN ('queued', 'preparing', 'running', 'uploading');
CREATE INDEX idx_render_jobs_user_created
  ON render_jobs(user_id, created_at DESC);
CREATE INDEX idx_render_jobs_project_status
  ON render_jobs(project_id, status, created_at DESC);
CREATE INDEX idx_render_jobs_provider_status
  ON render_jobs(provider, status, updated_at)
  WHERE provider_job_id IS NOT NULL;
CREATE INDEX idx_render_jobs_candidate
  ON render_jobs(candidate_id, segment_index, proxy_version)
  WHERE kind = 'preview';

PRAGMA foreign_keys = ON;
