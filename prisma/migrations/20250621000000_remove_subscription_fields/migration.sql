-- DropIndex
DROP INDEX IF EXISTS "User_stripeId_key";
DROP INDEX IF EXISTS "User_subscriptionId_key";
DROP INDEX IF EXISTS "Team_stripeId_key";
DROP INDEX IF EXISTS "Team_subscriptionId_key";

-- AlterTable
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "stripeId",
  DROP COLUMN IF EXISTS "subscriptionId",
  DROP COLUMN IF EXISTS "startsAt",
  DROP COLUMN IF EXISTS "endsAt";

-- AlterTable
ALTER TABLE "Team"
  DROP COLUMN IF EXISTS "stripeId",
  DROP COLUMN IF EXISTS "subscriptionId",
  DROP COLUMN IF EXISTS "startsAt",
  DROP COLUMN IF EXISTS "endsAt";
