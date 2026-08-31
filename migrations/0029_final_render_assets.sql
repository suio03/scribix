-- Final jobs produce both an MP4 and a cover image. Preview jobs keep this NULL.

ALTER TABLE render_jobs ADD COLUMN cover_asset_id TEXT REFERENCES media_assets(id);

CREATE INDEX idx_render_jobs_cover_asset
  ON render_jobs(cover_asset_id)
  WHERE cover_asset_id IS NOT NULL;
