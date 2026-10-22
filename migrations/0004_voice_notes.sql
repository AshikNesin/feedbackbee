-- Voice notes: a second, independent attachment role. A report can carry
-- visual media, a voice note, both, or neither.
ALTER TABLE feedback ADD COLUMN audio_key TEXT;
ALTER TABLE feedback ADD COLUMN audio_seconds REAL;
