-- 補 commit d0d9499 遺漏的 migrate
-- feat(sales): 日報支援整包附檔 + AI 自動草擬今日重點
ALTER TABLE "SalesDailyReport" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
