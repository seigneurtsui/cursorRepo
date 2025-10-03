-- Fix duplicate payment plans
-- This script removes duplicate plans and keeps only one of each type

-- Step 1: Add UNIQUE constraint to type column (if not exists)
ALTER TABLE payment_plans 
  DROP CONSTRAINT IF EXISTS payment_plans_type_key;

ALTER TABLE payment_plans 
  ADD CONSTRAINT payment_plans_type_key UNIQUE (type);

-- Step 2: Delete duplicates, keeping the one with the lowest ID for each type
DELETE FROM payment_plans
WHERE id NOT IN (
  SELECT MIN(id)
  FROM payment_plans
  GROUP BY type
);

-- Step 3: Verify - should show only 3 rows
SELECT id, name, type, price, description 
FROM payment_plans 
ORDER BY price;

-- Expected result:
-- id | name      | type     | price  | description
-- ---+-----------+----------+--------+---------------------------
--  1 | 按次付费  | per_use  |   5.00 | 单次视频处理，5元/次
--  2 | 月度套餐  | monthly  |  50.00 | 月度无限次使用，50元/月
--  3 | 年度套餐  | yearly   | 300.00 | 年度无限次使用，300元/年
