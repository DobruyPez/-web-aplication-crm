-- Удаление колонок, которые использовались только для кодов по почте (после удаления SMTP из приложения).
ALTER TABLE "users" DROP COLUMN IF EXISTS "login_verification_code_hash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "login_verification_expires";
ALTER TABLE "users" DROP COLUMN IF EXISTS "registration_verification_code_hash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "registration_verification_expires";
ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified";
