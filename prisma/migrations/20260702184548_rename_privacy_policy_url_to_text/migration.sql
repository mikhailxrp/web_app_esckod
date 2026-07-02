-- Rename privacyPolicyUrl to privacyPolicyText: the field now stores rich-text
-- HTML content (edited via the admin Tiptap editor) instead of an external URL.
-- Use RENAME COLUMN instead of DROP+ADD to preserve existing data.
ALTER TABLE "AppSettings" RENAME COLUMN "privacyPolicyUrl" TO "privacyPolicyText";
ALTER TABLE "AppSettings" ALTER COLUMN "privacyPolicyText" SET DEFAULT '';
