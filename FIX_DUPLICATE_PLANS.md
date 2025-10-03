# 🔧 修复重复套餐问题

## 问题描述

管理员后台和会员中心显示了重复的套餐：
- 📦 套餐管理版块：套餐名称和类型有重复
- 💰 充值套餐：显示重复的套餐选项

## 原因分析

1. **数据库表设计问题**：
   - `payment_plans` 表的 `type` 字段没有 UNIQUE 约束
   - 导致可以插入相同类型的多个套餐

2. **数据插入问题**：
   - `ON CONFLICT DO NOTHING` 无法检测冲突（因为没有唯一约束）
   - 多次运行 `init-db.js` 会重复插入套餐

3. **结果**：
   ```
   数据库中存在:
   - 多个 'per_use' 类型的套餐
   - 多个 'monthly' 类型的套餐
   - 多个 'yearly' 类型的套餐
   ```

## 解决方案

### 方案1: 使用自动修复脚本（推荐）⭐

**一键修复**：
```bash
npm run fix-duplicates
```

**脚本功能**：
1. ✅ 检测重复套餐
2. ✅ 删除重复项（保留最早的一条）
3. ✅ 添加 UNIQUE 约束防止再次出现
4. ✅ 显示修复结果

**预期输出**：
```
🔧 Starting to fix duplicate payment plans...
⚠️  Found duplicate plans:
   - per_use: 3 copies
   - monthly: 2 copies
   - yearly: 2 copies

🗑️  Deleted 4 duplicate plan(s):
   - ID 4: 按次付费 (per_use)
   - ID 5: 按次付费 (per_use)
   - ID 6: 月度套餐 (monthly)
   - ID 7: 年度套餐 (yearly)

✅ Added UNIQUE constraint to type column

📊 Final payment plans:
┌────┬──────────┬─────────┬────────┬────────────────────────────┐
│ ID │   名称   │  类型   │  价格  │          描述              │
├────┼──────────┼─────────┼────────┼────────────────────────────┤
│ 1  │ 按次付费 │ per_use │ ¥5.00  │ 单次视频处理，5元/次       │
│ 2  │ 月度套餐 │ monthly │ ¥50.00 │ 月度无限次使用，50元/月     │
│ 3  │ 年度套餐 │ yearly  │ ¥300.00│ 年度无限次使用，300元/年    │
└────┴──────────┴─────────┴────────┴────────────────────────────┘

✅ All done! Duplicate plans have been removed.
```

---

### 方案2: 使用SQL脚本（手动）

**如果方案1失败，可以直接使用SQL**：

```bash
psql $DATABASE_URL -f scripts/fix-duplicate-plans.sql
```

**或者手动执行SQL**：
```sql
-- 1. 删除重复套餐（保留最早的）
DELETE FROM payment_plans
WHERE id NOT IN (
  SELECT MIN(id)
  FROM payment_plans
  GROUP BY type
);

-- 2. 添加唯一约束
ALTER TABLE payment_plans 
ADD CONSTRAINT payment_plans_type_key UNIQUE (type);

-- 3. 验证
SELECT id, name, type, price FROM payment_plans ORDER BY price;
```

---

### 方案3: 重新初始化数据库（彻底清理）

**⚠️ 警告：此操作会删除所有数据！**

```bash
# 1. 删除并重建数据库
dropdb video_chapters
createdb video_chapters

# 2. 重新初始化
npm run init-db
```

---

## 预防措施

### 1. 数据库约束已添加 ✅

修复后的 `payment_plans` 表结构：
```sql
CREATE TABLE payment_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL UNIQUE,  -- ✅ 添加了 UNIQUE 约束
  price NUMERIC(10, 2) NOT NULL,
  credits INTEGER,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. 插入逻辑已改进 ✅

修复后的插入语句：
```sql
INSERT INTO payment_plans (name, type, price, credits, description) 
VALUES 
  ('按次付费', 'per_use', 5.00, 1, '单次视频处理，5元/次'),
  ('月度套餐', 'monthly', 50.00, NULL, '月度无限次使用，50元/月'),
  ('年度套餐', 'yearly', 300.00, NULL, '年度无限次使用，300元/年')
ON CONFLICT (type) DO UPDATE SET  -- ✅ 指定冲突列
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  description = EXCLUDED.description;
```

**特点**：
- 使用 `ON CONFLICT (type)` 指定冲突检测列
- 冲突时更新而不是忽略（可以修改价格）
- 不会产生重复数据

### 3. 不要多次运行 init-db ✅

**正确的做法**：
```bash
# 首次安装
npm run init-db

# 后续更新
# 不要再运行 init-db！
# 或者先删除数据库再运行
```

---

## 验证修复

### 1. 检查数据库

```sql
-- 应该只返回3行
SELECT id, name, type, price FROM payment_plans ORDER BY price;

-- 预期结果：
--  id |   name   |   type   | price  
-- ----+----------+----------+--------
--   1 | 按次付费 | per_use  |   5.00
--   2 | 月度套餐 | monthly  |  50.00
--   3 | 年度套餐 | yearly   | 300.00
```

### 2. 检查管理员后台

登录管理员后台 → 📦 套餐管理
- ✅ 只显示3个套餐
- ✅ 每种类型只有一个

### 3. 检查会员中心

登录会员中心 → 💰 充值套餐
- ✅ 只显示3个套餐卡片
- ✅ 没有重复选项

---

## 文件清单

修改的文件：
```
scripts/init-db.js              (修复)
scripts/fix-duplicate-plans.js  (新增)
scripts/fix-duplicate-plans.sql (新增)
package.json                    (新增脚本)
FIX_DUPLICATE_PLANS.md          (本文档)
```

---

## 快速操作指南

### 立即修复（3步）

```bash
# 1. 运行修复脚本
npm run fix-duplicates

# 2. 重启服务器（如果正在运行）
npm start

# 3. 刷新浏览器页面
```

### 验证成功

检查以下页面：
1. ✅ 管理员后台 → 📦 套餐管理（只显示3个）
2. ✅ 会员中心 → 💰 充值套餐（只显示3个）

---

## 技术细节

### 唯一约束的作用

```sql
ALTER TABLE payment_plans 
ADD CONSTRAINT payment_plans_type_key UNIQUE (type);
```

**效果**：
- ✅ 阻止插入相同 type 的套餐
- ✅ `ON CONFLICT (type)` 可以检测到冲突
- ✅ 数据库级别保证数据完整性

### 删除重复的SQL逻辑

```sql
DELETE FROM payment_plans
WHERE id NOT IN (
  SELECT MIN(id)
  FROM payment_plans
  GROUP BY type
);
```

**工作原理**：
1. `GROUP BY type`：按类型分组
2. `MIN(id)`：每组中选择最小的ID（最早插入的）
3. `NOT IN`：删除不在保留列表中的所有行
4. **结果**：每种类型只保留一个套餐（最早的那个）

---

## 常见问题

### Q: 修复后套餐ID不连续怎么办？

**A**: 这是正常的，不影响使用。如果需要重置ID序列：
```sql
-- 可选：重置ID序列（会影响现有数据）
SELECT setval('payment_plans_id_seq', (SELECT MAX(id) FROM payment_plans));
```

### Q: 修复脚本报错：constraint already exists

**A**: 这说明约束已经添加过了，可以忽略。脚本会自动处理这个情况。

### Q: 用户已充值的套餐会受影响吗？

**A**: 不会。`transactions` 表中的记录不受影响，只是清理了重复的套餐定义。

### Q: 价格会改变吗？

**A**: 不会。脚本只删除重复项，保留的套餐价格不变。

---

## 总结

✅ **问题已修复**：
1. 添加了 UNIQUE 约束防止重复
2. 改进了插入逻辑（ON CONFLICT 指定列）
3. 提供了自动修复脚本
4. 提供了手动SQL方案
5. 编写了详细文档

✅ **预防未来问题**：
- 数据库约束保证数据完整性
- 不会再出现重复套餐
- 多次运行 init-db 也不会重复插入

🎯 **立即执行**：
```bash
npm run fix-duplicates
```

---

**修复完成后，问题将彻底解决！** 🎉✨
