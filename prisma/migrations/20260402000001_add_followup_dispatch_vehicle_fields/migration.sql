-- Add duration and competitorInfo to FollowUpLog
ALTER TABLE "FollowUpLog" ADD COLUMN IF NOT EXISTS "duration" INTEGER;
ALTER TABLE "FollowUpLog" ADD COLUMN IF NOT EXISTS "competitorInfo" TEXT;

-- Add vehicle/driver fields to DispatchOrder
ALTER TABLE "DispatchOrder" ADD COLUMN IF NOT EXISTS "vehicleNo" TEXT;
ALTER TABLE "DispatchOrder" ADD COLUMN IF NOT EXISTS "driverName" TEXT;
ALTER TABLE "DispatchOrder" ADD COLUMN IF NOT EXISTS "driverPhone" TEXT;
