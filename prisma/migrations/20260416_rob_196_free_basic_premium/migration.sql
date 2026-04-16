CREATE TYPE "PlanTier_new" AS ENUM ('free', 'basic', 'premium');

ALTER TABLE "BillingAccount"
  ALTER COLUMN "currentPlanTier" TYPE "PlanTier_new"
  USING (
    CASE
      WHEN "currentPlanTier" IS NULL THEN NULL
      WHEN "currentPlanTier"::text = 'basic' THEN 'free'
      WHEN "currentPlanTier"::text = 'standard' THEN 'basic'
      ELSE "currentPlanTier"::text
    END
  )::"PlanTier_new";

ALTER TABLE "BillingAccount"
  ALTER COLUMN "currentTrialPlanTier" TYPE "PlanTier_new"
  USING (
    CASE
      WHEN "currentTrialPlanTier" IS NULL THEN NULL
      WHEN "currentTrialPlanTier"::text = 'basic' THEN 'free'
      WHEN "currentTrialPlanTier"::text = 'standard' THEN 'basic'
      ELSE "currentTrialPlanTier"::text
    END
  )::"PlanTier_new";

ALTER TABLE "BillingSubscription"
  ALTER COLUMN "planTier" TYPE "PlanTier_new"
  USING (
    CASE
      WHEN "planTier"::text = 'basic' THEN 'free'
      WHEN "planTier"::text = 'standard' THEN 'basic'
      ELSE "planTier"::text
    END
  )::"PlanTier_new";

ALTER TABLE "BillingTrialLedger"
  ALTER COLUMN "planTier" TYPE "PlanTier_new"
  USING (
    CASE
      WHEN "planTier"::text = 'basic' THEN 'free'
      WHEN "planTier"::text = 'standard' THEN 'basic'
      ELSE "planTier"::text
    END
  )::"PlanTier_new";

ALTER TYPE "PlanTier" RENAME TO "PlanTier_old";
ALTER TYPE "PlanTier_new" RENAME TO "PlanTier";
DROP TYPE "PlanTier_old";
