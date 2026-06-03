-- Store user-renamed speaker labels per transcript.

ALTER TABLE transcripts
  ADD COLUMN speaker_names_json TEXT NOT NULL DEFAULT '{}';
