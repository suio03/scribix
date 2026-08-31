-- AI short-video workspace domain model.
-- Asset rows intentionally survive project soft deletion until R2 cleanup succeeds.

CREATE TABLE video_projects (
  id                         TEXT PRIMARY KEY,
  user_id                    TEXT NOT NULL REFERENCES users(id),
  transcript_id              TEXT NOT NULL REFERENCES transcripts(id),
  source_asset_id            TEXT REFERENCES media_assets(id),
  status                     TEXT NOT NULL DEFAULT 'draft'
                               CHECK (status IN (
                                 'draft', 'analyzing', 'candidates_ready', 'editing',
                                 'rendering', 'completed', 'failed'
                               )),
  draft_edl_json             TEXT,
  draft_render_spec_json     TEXT,
  active_project_version_id  TEXT REFERENCES project_versions(id),
  created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                 DATETIME,
  UNIQUE (id, user_id)
);

CREATE INDEX idx_video_projects_user_updated
  ON video_projects(user_id, updated_at)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_video_projects_transcript
  ON video_projects(transcript_id)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_video_projects_active_transcript
  ON video_projects(transcript_id)
  WHERE deleted_at IS NULL;

CREATE TABLE media_assets (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  project_id   TEXT REFERENCES video_projects(id),
  kind         TEXT NOT NULL
                 CHECK (kind IN (
                   'source', 'preview_proxy', 'final_video', 'cover', 'logo', 'font'
                 )),
  r2_key       TEXT,
  mime_type    TEXT NOT NULL,
  bytes        INTEGER CHECK (bytes IS NULL OR bytes >= 0),
  duration_ms  INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  width        INTEGER CHECK (width IS NULL OR width > 0),
  height       INTEGER CHECK (height IS NULL OR height > 0),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'uploading', 'ready', 'failed', 'deleted')),
  expires_at   DATETIME,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at   DATETIME,
  UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX idx_media_assets_r2_key
  ON media_assets(r2_key)
  WHERE r2_key IS NOT NULL;
CREATE INDEX idx_media_assets_project_kind
  ON media_assets(project_id, kind, created_at)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_media_assets_user_status
  ON media_assets(user_id, status, created_at)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_media_assets_expiry
  ON media_assets(expires_at)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

CREATE TABLE clip_candidates (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id),
  project_id     TEXT NOT NULL REFERENCES video_projects(id),
  rank           INTEGER NOT NULL CHECK (rank >= 0),
  theme          TEXT NOT NULL,
  hook           TEXT NOT NULL,
  reason         TEXT NOT NULL,
  score          REAL NOT NULL CHECK (score >= 0 AND score <= 1),
  segments_json  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'suggested'
                   CHECK (status IN ('suggested', 'accepted', 'rejected', 'deleted')),
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, rank),
  UNIQUE (id, user_id)
);

CREATE INDEX idx_clip_candidates_project_rank
  ON clip_candidates(project_id, rank);
CREATE INDEX idx_clip_candidates_user_created
  ON clip_candidates(user_id, created_at);

CREATE TABLE project_versions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  project_id        TEXT NOT NULL REFERENCES video_projects(id),
  version           INTEGER NOT NULL CHECK (version > 0),
  edl_json          TEXT NOT NULL,
  render_spec_json  TEXT NOT NULL,
  created_by        TEXT NOT NULL REFERENCES users(id),
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, version),
  UNIQUE (id, user_id)
);

CREATE INDEX idx_project_versions_user_project
  ON project_versions(user_id, project_id, version DESC);

CREATE TABLE brand_templates (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at  DATETIME,
  UNIQUE (id, user_id)
);

CREATE INDEX idx_brand_templates_user_updated
  ON brand_templates(user_id, updated_at)
  WHERE deleted_at IS NULL;

CREATE TABLE render_jobs (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id),
  project_id          TEXT NOT NULL REFERENCES video_projects(id),
  project_version_id  TEXT NOT NULL REFERENCES project_versions(id),
  kind                TEXT NOT NULL CHECK (kind IN ('preview', 'final')),
  preset_id           TEXT NOT NULL,
  scope_key           TEXT NOT NULL DEFAULT 'default',
  provider            TEXT,
  provider_job_id     TEXT,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                          'draft', 'queued', 'preparing', 'running', 'uploading',
                          'completed', 'failed', 'canceled'
                        )),
  attempt             INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  idempotency_key     TEXT NOT NULL,
  output_asset_id     TEXT REFERENCES media_assets(id),
  error_code          TEXT
                        CHECK (error_code IS NULL OR error_code IN (
                          'invalid_source', 'unsupported_codec', 'invalid_edl',
                          'invalid_render_spec', 'asset_missing', 'download_failed',
                          'render_failed', 'upload_failed', 'provider_unavailable',
                          'job_timed_out'
                        )),
  queued_at           DATETIME,
  started_at          DATETIME,
  completed_at        DATETIME,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, idempotency_key),
  UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX idx_render_jobs_active_scope
  ON render_jobs(project_version_id, kind, preset_id, scope_key)
  WHERE status IN ('queued', 'preparing', 'running', 'uploading');
CREATE INDEX idx_render_jobs_user_created
  ON render_jobs(user_id, created_at DESC);
CREATE INDEX idx_render_jobs_project_status
  ON render_jobs(project_id, status, created_at DESC);

-- Cross-table references are added in the CREATE statements above even though
-- SQLite resolves some referenced tables later in this migration. Source assets
-- are attached in three steps: create project with NULL source_asset_id, create
-- the media_assets row, then update the project to reference that owned asset.
