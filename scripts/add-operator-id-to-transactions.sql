-- Add operator_id column to transactions table for admin balance adjustments audit trail
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS operator_id INTEGER;
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_operator FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_operator_id ON transactions(operator_id);

-- Add comment
COMMENT ON COLUMN transactions.operator_id IS '操作员ID (用于管理员调整余额的审计追踪)';
