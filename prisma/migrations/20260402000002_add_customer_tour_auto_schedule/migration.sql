-- Add tour auto-schedule fields to Customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tourAutoSchedule" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tourAutoAssigneeId" TEXT;

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tourAutoAssigneeId_fkey"
  FOREIGN KEY ("tourAutoAssigneeId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
