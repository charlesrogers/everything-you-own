-- Expand email tracking: log all processed emails, not just imported ones
-- This enables reviewing past rejections and improving the classifier

ALTER TABLE imported_emails ADD COLUMN IF NOT EXISTS email_subject TEXT;
ALTER TABLE imported_emails ADD COLUMN IF NOT EXISTS email_from TEXT;
ALTER TABLE imported_emails ADD COLUMN IF NOT EXISTS email_date TEXT;
ALTER TABLE imported_emails ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'imported' CHECK (status IN ('imported', 'rejected', 'skipped'));
ALTER TABLE imported_emails ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE imported_emails ADD COLUMN IF NOT EXISTS products_extracted INTEGER DEFAULT 0;

-- Drop old unique constraint, re-add as index
ALTER TABLE imported_emails DROP CONSTRAINT IF EXISTS imported_emails_household_id_gmail_message_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ie_household_gmail ON imported_emails(household_id, gmail_message_id);

-- Index for finding rejected emails
CREATE INDEX IF NOT EXISTS idx_ie_status ON imported_emails(household_id, status);
