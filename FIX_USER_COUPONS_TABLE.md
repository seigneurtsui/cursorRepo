# 🔧 修复 user_coupons 表结构错误

**错误**: `column uc.coupon_id does not exist`  
**提交**: 4c9fab3  
**状态**: ✅ 修复脚本已创建并推送

---

## ❌ **错误信息**

```
❌ Database query error: error: column uc.coupon_id does not exist
获取优惠券错误: error: column uc.coupon_id does not exist
GET /api/membership/my-coupons 500 34.022 ms - 33
```

**影响功能**:
- 会员中心 → 🎫 我的优惠券（加载失败）
- 优惠券相关的所有功能

---

## 🔍 **问题原因**

### 表结构不匹配

**代码期望的结构** (services/membership.js Line 126):
```sql
SELECT ... 
FROM user_coupons uc
JOIN coupons c ON uc.coupon_id = c.id  ← 需要 coupon_id 列
WHERE uc.user_id = $1
```

**实际数据库的结构**:
```sql
user_coupons 表：
- id
- user_id
- code
- name
- ...
❌ 缺少 coupon_id 列！
```

### 为什么会缺失？

1. **旧表已存在**: 之前创建的 `user_coupons` 表结构不完整
2. **CREATE TABLE IF NOT EXISTS**: 不会更新现有表
3. **迁移脚本**: 有正确的结构，但对已存在的表无效

---

## ✅ **解决方案**

### 新建专用迁移脚本

**文件**: `scripts/migrate-fix-user-coupons.js`

**功能**:
1. 检查并添加 `coupon_id` 列
2. 检查并添加 `is_used` 列
3. 检查并添加 `transaction_id` 列
4. 添加 UNIQUE 约束
5. 显示最终表结构

---

## 🚀 **运行修复**

### 步骤1: 停止服务器
```bash
# 在服务器终端按 Ctrl+C
```

### 步骤2: 运行修复脚本
```bash
node scripts/migrate-fix-user-coupons.js
```

### 步骤3: 查看输出

**预期输出**:
```
🔄 开始修复 user_coupons 表...

📝 添加 coupon_id 列到 user_coupons 表...
  ✅ 已添加 coupon_id 列

📝 添加 is_used 列到 user_coupons 表...
  ✅ 已添加 is_used 列

📝 添加 transaction_id 列到 user_coupons 表...
  ✅ 已添加 transaction_id 列

📝 检查 UNIQUE 约束...
  ✅ 已添加 UNIQUE 约束

✅ user_coupons 表修复完成！

📊 当前表结构:
┌────────────────┬───────────┬─────────────┬────────────────┐
│ column_name    │ data_type │ is_nullable │ column_default │
├────────────────┼───────────┼─────────────┼────────────────┤
│ id             │ integer   │ NO          │ nextval(...)   │
│ user_id        │ integer   │ YES         │ NULL           │
│ coupon_id      │ integer   │ YES         │ NULL           │
│ code           │ ...       │ ...         │ ...            │
│ is_used        │ boolean   │ YES         │ false          │
│ used_at        │ timestamp │ YES         │ NULL           │
│ transaction_id │ integer   │ YES         │ NULL           │
│ created_at     │ timestamp │ YES         │ NOW()          │
└────────────────┴───────────┴─────────────┴────────────────┘
```

**或者（如果列已存在）**:
```
🔄 开始修复 user_coupons 表...

📝 添加 coupon_id 列到 user_coupons 表...
  ⏭️  coupon_id 列已存在，跳过

📝 添加 is_used 列到 user_coupons 表...
  ⏭️  is_used 列已存在，跳过

📝 添加 transaction_id 列到 user_coupons 表...
  ⏭️  transaction_id 列已存在，跳过

✅ user_coupons 表修复完成！
```

### 步骤4: 重启服务器
```bash
npm start
```

### 步骤5: 测试
```bash
访问: http://localhost:9015/public/profile.html
查看: 🎫 我的优惠券
确认: 不再报错
```

---

## 📊 **正确的表结构**

### user_coupons 表（修复后）

| 列名 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | SERIAL | 主键 | PRIMARY KEY |
| user_id | INTEGER | 用户ID | FK → users(id) |
| coupon_id | INTEGER | 优惠券ID | FK → coupons(id) ✨ |
| code | VARCHAR(50) | 优惠券代码 | NOT NULL |
| is_used | BOOLEAN | 是否已使用 | DEFAULT FALSE ✨ |
| used_at | TIMESTAMP | 使用时间 | NULL |
| transaction_id | INTEGER | 关联交易 | NULL ✨ |
| created_at | TIMESTAMP | 创建时间 | DEFAULT NOW() |

**UNIQUE 约束**: `(user_id, coupon_id)` - 同一用户不能重复领取同一优惠券

---

## 🔗 **表关系**

```
users (用户表)
  ↓ 一对多
user_coupons (用户-优惠券关联表)
  ↓ 多对一
coupons (优惠券主表)
```

**SQL JOIN**:
```sql
SELECT 
  uc.id,
  uc.user_id,
  uc.coupon_id,  ← 修复后新增
  uc.code,
  uc.is_used,    ← 修复后新增
  c.name,
  c.discount_type,
  c.discount_value
FROM user_coupons uc
JOIN coupons c ON uc.coupon_id = c.id  ← 需要 coupon_id
WHERE uc.user_id = 1
```

---

## 🧪 **验证修复**

### 测试1: 检查列是否存在
```bash
# 连接数据库
psql -U postgres -d youtube_member_db

# 查看表结构
\d user_coupons

# 应该看到:
# - coupon_id | integer | 
# - is_used | boolean | default false
# - transaction_id | integer |
```

### 测试2: 测试API
```bash
# 登录系统
http://localhost:9015/public/login.html

# 进入会员中心
http://localhost:9015/public/profile.html

# 查看 🎫 我的优惠券 部分
```

**预期结果** ✅:
- 不再报错
- 显示"暂无优惠券"或优惠券列表
- GET /api/membership/my-coupons 返回 200

---

## 📝 **脚本特性**

### 1. 安全性
```javascript
// 检查列是否存在
const checkColumn = await client.query(`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'user_coupons' AND column_name = 'coupon_id'
`);

if (checkColumn.rows.length === 0) {
  // 只在不存在时才添加
  await client.query(`ALTER TABLE user_coupons ADD COLUMN ...`);
}
```

**好处**: 可以重复运行，不会出错

### 2. 详细日志
```javascript
console.log('📝 添加 coupon_id 列...');
console.log('  ✅ 已添加');
// 或
console.log('  ⏭️  已存在，跳过');
```

**好处**: 清楚知道执行了什么操作

### 3. 显示表结构
```javascript
console.table(columns.rows);
```

**好处**: 一目了然地看到最终的表结构

---

## 🔄 **其他相关迁移**

### 如果需要运行完整迁移
```bash
# 运行主迁移脚本（创建所有表）
npm run migrate
```

### 如果只需要修复 user_coupons
```bash
# 运行专用脚本
node scripts/migrate-fix-user-coupons.js
```

---

## 📋 **所有需要的表**

确保这些表都存在：

- [x] users
- [x] payment_plans
- [x] transactions
- [x] membership_levels
- [x] coupons ← 主表
- [x] user_coupons ← 需要修复
- [x] referrals
- [x] notification_channel_settings
- [x] notification_logs
- [x] youtube_videos

---

## 🎯 **完成后的验证**

### 后台日志应该显示
```
GET /api/membership/my-coupons 200  ✅

（而不是）
GET /api/membership/my-coupons 500  ❌
```

### 前端页面应该显示
```
🎫 我的优惠券
暂无优惠券  ✅

（而不是）
加载失败  ❌
```

---

## ✅ **完成清单**

- [x] 创建修复脚本
- [x] 添加 coupon_id 列检查
- [x] 添加 is_used 列检查
- [x] 添加 transaction_id 列检查
- [x] 添加 UNIQUE 约束
- [x] 添加表结构显示
- [x] 添加安全检查（防止重复运行错误）
- [x] 提交到 Git
- [x] 推送到 GitHub
- [x] 编写详细文档

---

## 🚀 **立即修复**

### 在你的本地环境运行：

```bash
# 1. 进入项目目录
cd /Users/seigneur/lavoro/scopriYoutube

# 2. 运行修复脚本
node scripts/migrate-fix-user-coupons.js

# 3. 等待完成
# 应该看到 ✅ user_coupons 表修复完成！

# 4. 重启服务器
npm start

# 5. 测试
# 访问 http://localhost:9015/public/profile.html
# 🎫 我的优惠券 应该正常显示
```

---

**运行修复脚本即可解决此问题！** 🎉
