# 🗄️ 数据库迁移指南 - 添加 operator_id 列

## ⚠️ 重要提示

在使用管理员余额调整功能前，**必须先运行数据库迁移**！

---

## 📋 迁移说明

### 问题

代码尝试在 `transactions` 表中插入 `operator_id` 列，但该列不存在：

```
error: column "operator_id" of relation "transactions" does not exist
```

### 解决方案

添加 `operator_id` 列到 `transactions` 表，用于记录管理员调整余额的操作员信息。

---

## 🚀 运行迁移

### 方法1: 使用 Node.js 迁移脚本（推荐）

```bash
cd /workspace
node scripts/add-operator-id-migration.js
```

**输出示例**:
```
Starting migration: Add operator_id to transactions table...
Adding operator_id column...
Adding foreign key constraint...
Adding index...
Adding column comment...
✅ Migration completed successfully!
Migration finished.
```

---

### 方法2: 手动执行 SQL

如果Node.js脚本无法运行（数据库未启动），可以在数据库启动后手动执行：

```bash
# 方法 2a: 使用 psql
psql -U your_username -d your_database << 'EOF'
-- Add operator_id column
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS operator_id INTEGER;

-- Add foreign key constraint
ALTER TABLE transactions 
ADD CONSTRAINT fk_transactions_operator 
FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_transactions_operator_id ON transactions(operator_id);

-- Add comment
COMMENT ON COLUMN transactions.operator_id IS '操作员ID (用于管理员调整余额的审计追踪)';
EOF
```

**或者使用已创建的SQL文件**:
```bash
psql -U your_username -d your_database -f scripts/add-operator-id-to-transactions.sql
```

---

### 方法3: 集成到 init-db.js (新数据库)

如果是全新安装，修改 `scripts/init-db.js` 在创建 `transactions` 表时直接包含 `operator_id` 列。

---

## 📊 数据库变更详情

### 变更前 (transactions 表)

```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50),
    amount DECIMAL(10, 2),
    status VARCHAR(50),
    payment_method VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 变更后 (transactions 表)

```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50),
    amount DECIMAL(10, 2),
    status VARCHAR(50),
    payment_method VARCHAR(100),
    operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- 新增
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 新增索引
CREATE INDEX idx_transactions_operator_id ON transactions(operator_id);
```

---

## 🎯 operator_id 用途

### 1. 管理员余额调整审计

当管理员调整用户余额时，记录操作员ID：

```javascript
// 后端代码 (routes/auth-routes.js)
await db.query(transactionQuery, [
  userId,              // 目标用户
  'recharge',          // 交易类型
  20,                  // 金额
  '管理员调整',        // 支付方式
  req.user.id,         // 操作员ID ← 这里！
  description
]);
```

### 2. 审计查询

查询特定管理员的所有余额调整操作：

```sql
SELECT 
  t.id,
  t.created_at,
  u_target.username AS target_user,
  u_target.email AS target_email,
  t.type,
  t.amount,
  u_operator.username AS operator_name,
  u_operator.email AS operator_email
FROM transactions t
JOIN users u_target ON t.user_id = u_target.id
LEFT JOIN users u_operator ON t.operator_id = u_operator.id
WHERE t.operator_id = 1  -- 管理员ID
  AND t.payment_method = '管理员调整'
ORDER BY t.created_at DESC;
```

### 3. 统计报表

统计每个管理员的操作次数和金额：

```sql
SELECT 
  u.username AS operator,
  COUNT(*) AS adjustment_count,
  SUM(CASE WHEN t.type = 'recharge' THEN t.amount ELSE 0 END) AS total_added,
  SUM(CASE WHEN t.type = 'usage' THEN t.amount ELSE 0 END) AS total_deducted
FROM transactions t
JOIN users u ON t.operator_id = u.id
WHERE t.payment_method = '管理员调整'
GROUP BY u.id, u.username
ORDER BY adjustment_count DESC;
```

---

## ✅ 验证迁移

### 检查列是否存在

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'operator_id';
```

**预期输出**:
```
 column_name | data_type | is_nullable 
-------------+-----------+-------------
 operator_id | integer   | YES
```

### 检查外键约束

```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'transactions' 
  AND constraint_name = 'fk_transactions_operator';
```

**预期输出**:
```
      constraint_name       | constraint_type 
---------------------------+-----------------
 fk_transactions_operator  | FOREIGN KEY
```

### 检查索引

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'transactions' 
  AND indexname = 'idx_transactions_operator_id';
```

**预期输出**:
```
        indexname            |                    indexdef                     
-----------------------------+------------------------------------------------
 idx_transactions_operator_id| CREATE INDEX idx_transactions_operator_id ON ...
```

---

## 🔄 向后兼容性

### 现有数据

- ✅ 所有现有 transactions 记录的 `operator_id` 将为 `NULL`
- ✅ 现有功能完全不受影响
- ✅ 只有新的管理员余额调整操作会填充 `operator_id`

### 外键约束 ON DELETE SET NULL

- 如果删除了管理员用户，其 `operator_id` 会设为 `NULL`
- 交易记录仍然保留（用于审计）
- 只是无法追溯到具体操作员

---

## 🐛 常见问题

### Q1: 迁移脚本报错 "ECONNREFUSED"

**原因**: 数据库服务未启动

**解决**:
```bash
# 1. 启动数据库服务
sudo systemctl start postgresql
# 或
brew services start postgresql

# 2. 确认数据库运行
psql -U postgres -c "SELECT version();"

# 3. 重新运行迁移
node scripts/add-operator-id-migration.js
```

---

### Q2: 迁移脚本报错 "column already exists"

**原因**: 列已经存在

**解决**: 这是正常的！迁移脚本是幂等的，可以安全重复运行。看到以下消息说明已完成：
```
✅ Column operator_id already exists. Skipping migration.
```

---

### Q3: 如何回滚迁移？

如果需要删除 `operator_id` 列：

```sql
-- 警告：这会永久删除数据！
DROP INDEX IF EXISTS idx_transactions_operator_id;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_transactions_operator;
ALTER TABLE transactions DROP COLUMN IF EXISTS operator_id;
```

**注意**: 删除后，管理员余额调整功能会报错！

---

### Q4: 我已经有很多 transactions 记录，迁移会影响它们吗？

**不会！**
- 迁移只添加新列，不修改现有数据
- 现有记录的 `operator_id` 为 `NULL`（这是正常的）
- 只有新的管理员调整操作才会填充此字段

---

## 📝 迁移检查清单

运行迁移前/后，请检查：

- [ ] 数据库服务正在运行
- [ ] 有足够的数据库权限（ALTER TABLE, CREATE INDEX）
- [ ] 已备份数据库（推荐）
- [ ] 运行迁移脚本
- [ ] 验证列已创建
- [ ] 验证外键约束已创建
- [ ] 验证索引已创建
- [ ] 测试管理员余额调整功能
- [ ] 检查 💳 最近交易 显示正确

---

## 🎉 迁移完成后

### 功能验证

1. 登录管理员账户
2. 进入 👥 用户列表
3. 点击某个用户的 💰 按钮
4. 调整余额（例如：30 → 50）
5. 确认
6. 进入 💳 最近交易
7. 检查最新记录：
   - ✅ 类型: 💰 充值
   - ✅ 金额: +¥20.00 (绿色)
   - ✅ 支付方式: 管理员调整
   - ✅ 状态: ✅ 完成

### 数据库验证

```sql
-- 查看最新的管理员调整记录
SELECT 
  t.*,
  u_target.username AS target_user,
  u_operator.username AS operator
FROM transactions t
JOIN users u_target ON t.user_id = u_target.id
LEFT JOIN users u_operator ON t.operator_id = u_operator.id
WHERE t.payment_method = '管理员调整'
ORDER BY t.created_at DESC
LIMIT 5;
```

---

## 📚 相关文件

- **迁移脚本**: `scripts/add-operator-id-migration.js`
- **SQL文件**: `scripts/add-operator-id-to-transactions.sql` (如果需要手动执行)
- **后端代码**: `routes/auth-routes.js` (PUT /admin/users/:id/adjust-balance)
- **前端显示**: `public/admin-enhanced.js` (renderTransactionsTable)

---

## 🆘 需要帮助？

如果迁移遇到问题：

1. 检查数据库日志
2. 确认 PostgreSQL 版本 (>= 9.5)
3. 检查数据库连接配置 (`.env` 或环境变量)
4. 查看 `DATABASE_URL` 是否正确

---

## 📊 迁移影响总结

| 项目 | 影响 |
|------|------|
| 现有功能 | ✅ 无影响 |
| 现有数据 | ✅ 完全保留 |
| 性能 | ✅ 微不足道（增加一个索引） |
| 停机时间 | ✅ 零停机（ALTER TABLE很快） |
| 可回滚 | ✅ 可以（但会导致功能报错） |
| 必需性 | ⚠️ **必须**（否则管理员余额调整报错） |

---

**状态**: 📋 迁移脚本已创建，等待执行  
**优先级**: 🔴 高（必须在使用余额调整功能前执行）
