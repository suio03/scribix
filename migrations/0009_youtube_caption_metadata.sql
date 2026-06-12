-- Store caption-only YouTube import metadata. Each pasted URL remains its own
-- transcript row; these fields describe the source for that import event.

ALTER TABLE transcripts ADD COLUMN youtube_url TEXT;
ALTER TABLE transcripts ADD COLUMN youtube_video_id TEXT;
ALTER TABLE transcripts ADD COLUMN youtube_track_language TEXT;
ALTER TABLE transcripts ADD COLUMN youtube_track_kind TEXT;

CREATE INDEX idx_transcripts_youtube_video
  ON transcripts(youtube_video_id)
  WHERE youtube_video_id IS NOT NULL AND deleted_at IS NULL;
