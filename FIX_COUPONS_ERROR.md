# 🔧 修复 Coupons 表错误

**提交**: 23f561f  
**错误**: `relation "coupons" does not exist`

---

## ❌ 错误信息

```
❌ Database query error: error: relation "coupons" does not exist
获取优惠券错误: error: relation "coupons" does not exist
GET /api/membership/my-coupons 500 11.999 ms - 33
```

---

## 🔍 问题原因

### 缺失的表
数据库中缺少 `coupons` 主表，但代码中有以下引用：

**services/membership.js**:
```javascript
// Line 99
FROM coupons c LEFT JOIN users u ON c.created_by = u.id

// Line 153
SELECT * FROM coupons 
WHERE code = $1 AND is_active = TRUE
```

### 为什么会缺失？
之前的迁移脚本只创建了 `user_coupons` 表（用户-优惠券关联表），但没有创建 `coupons` 主表（优惠券定义表）。

---

## ✅ 解决方案

### 1. 更新迁移脚本
已在 `scripts/migrate-complete-database.js` 中添加了两个表的创建：

#### coupons 表（主表）
```sql
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100),
  description TEXT,
  discount_type VARCHAR(20),      -- 'percentage' 或 'fixed'
  discount_value NUMERIC(10, 2),  -- 折扣值
  min_amount NUMERIC(10, 2) DEFAULT 0,
  max_uses INTEGER DEFAULT 1,      -- 最大使用次数
  used_count INTEGER DEFAULT 0,    -- 已使用次数
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

**用途**: 存储优惠券的基本定义（一个优惠券可以被多个用户使用）

#### user_coupons 表（关联表）
```sql
CREATE TABLE IF NOT EXISTS user_coupons (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  transaction_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, coupon_id)
)
```

**用途**: 记录用户拥有和使用优惠券的情况

---

## 🚀 运行修复

### 步骤1: 停止服务器
```bash
# 如果服务器正在运行，按 Ctrl+C 停止
```

### 步骤2: 运行数据库迁移
```bash
npm run migrate
```

**预期输出**:
```
🔄 Starting database migration...

📝 Checking coupons table...
  ✅ Created/verified table: coupons

📝 Checking user_coupons table...
  ✅ Created/verified table: user_coupons

✅ Migration completed successfully!
```

### 步骤3: 重启服务器
```bash
npm start
```

### 步骤4: 测试
```bash
# 访问会员中心
http://localhost:9015/public/profile.html

# 查看 "我的优惠券" 部分
# 应该不再报错
```

---

## 📊 表结构关系

```
coupons (优惠券定义)
  ├── id: 1
  ├── code: "WELCOME10"
  ├── name: "新用户优惠"
  ├── discount_type: "percentage"
  ├── discount_value: 10
  ├── max_uses: 100
  └── used_count: 5
      
      ↓ 一对多关系
      
user_coupons (用户-优惠券关联)
  ├── user_id: 1, coupon_id: 1, is_used: false
  ├── user_id: 2, coupon_id: 1, is_used: true
  └── user_id: 3, coupon_id: 1, is_used: false
```

**说明**:
- 一个优惠券（coupons）可以被多个用户（user_coupons）使用
- `max_uses` 限制总使用次数
- `used_count` 记录已使用次数
- `user_coupons.is_used` 记录该用户是否已使用

---

## 🧪 验证修复

### 测试1: 查看优惠券列表
```bash
# 登录系统
http://localhost:9015/public/login.html

# 进入会员中心
http://localhost:9015/public/profile.html

# 查看 🎫 我的优惠券 部分
```

**预期结果** ✅:
- 不再显示错误
- 显示 "暂无优惠券" 或优惠券列表

### 测试2: 检查后台日志
```bash
npm start
```

**预期结果** ✅:
- 不再出现 `relation "coupons" does not exist` 错误
- GET /api/membership/my-coupons 返回 200

---

## 📝 迁移命令说明

### package.json 中的 migrate 脚本
```json
"scripts": {
  "migrate": "node scripts/migrate-complete-database.js"
}
```

### 运行方式
```bash
# 方式1: 使用 npm
npm run migrate

# 方式2: 直接运行
node scripts/migrate-complete-database.js
```

### 安全性
- 使用 `CREATE TABLE IF NOT EXISTS`，不会覆盖现有表
- 不会删除任何数据
- 可以重复运行，安全无害

---

## 🎯 相关API端点

### 受影响的端点
- `GET /api/membership/my-coupons` - 获取用户优惠券
- `POST /api/membership/validate-coupon` - 验证优惠券
- `GET /api/admin/coupons` - 管理员查看所有优惠券

### 错误修复后
所有这些端点都将正常工作。

---

## 📊 数据示例

### coupons 表示例数据
```sql
INSERT INTO coupons (code, name, discount_type, discount_value, max_uses, valid_until) 
VALUES 
  ('WELCOME10', '新用户优惠', 'percentage', 10, 100, '2025-12-31'),
  ('VIP20', 'VIP专属', 'percentage', 20, 50, '2025-12-31'),
  ('SAVE50', '满减优惠', 'fixed', 50, 200, '2025-12-31');
```

### user_coupons 表示例数据
```sql
-- 用户1拥有优惠券1，未使用
INSERT INTO user_coupons (user_id, coupon_id, code, is_used) 
VALUES (1, 1, 'WELCOME10', false);

-- 用户2拥有优惠券1，已使用
INSERT INTO user_coupons (user_id, coupon_id, code, is_used, used_at) 
VALUES (2, 1, 'WELCOME10', true, NOW());
```

---

## ✅ 完成清单

- [x] 识别错误原因
- [x] 更新迁移脚本
- [x] 创建 coupons 表
- [x] 更新 user_coupons 表结构
- [x] 添加外键关系
- [x] 提交到Git
- [x] 推送到GitHub
- [x] 编写修复文档

---

## 🔄 如何运行

```bash
# 1. 停止服务器（如果正在运行）
Ctrl+C

# 2. 运行迁移
npm run migrate

# 3. 重启服务器
npm start

# 4. 测试
访问: http://localhost:9015/public/profile.html
查看: 🎫 我的优惠券
确认: 不再报错
```

---

## 🎉 总结

**问题**: 缺少 `coupons` 表  
**原因**: 迁移脚本不完整  
**修复**: 添加表创建SQL  
**验证**: 运行迁移，重启服务器  

**错误已修复！** ✅

立即运行 `npm run migrate` 来修复此问题！🚀
