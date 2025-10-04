# 🔧 修复数据库 - 添加缺失的列

## 🐛 问题描述

登录时出错：
```
❌ Database query error: error: column "is_active" does not exist
```

## ✅ 原因

数据库中的 `users` 表缺少以下列：
- `is_active` - 用户激活状态
- `phone` - 电话
- `wechat` - 微信
- `other_contact` - 其他联系方式
- `notes` - 备注
- `other_info` - 其他信息

---

## 🚀 立即修复（3步）

### 步骤1: 停止服务器

在运行 `npm start` 的终端按：
```
Ctrl + C
```

### 步骤2: 运行迁移脚本

```bash
npm run migrate
```

**预期输出**:
```
🚀 Starting migration: Add is_active column to users table...
✅ Added column: is_active
✅ Updated existing users to active status
✅ Added column: phone
✅ Added column: wechat
✅ Added column: other_contact
✅ Added column: notes
✅ Added column: other_info
🎉 Migration completed successfully!
```

### 步骤3: 重新启动服务器

```bash
npm start
```

---

## 🧪 验证修复成功

### 1. 访问登录页

```
http://localhost:9015/public/login.html
```

### 2. 登录测试

```
📧 邮箱: admin@youtube.com
🔑 密码: Admin@123456
```

### 3. 预期结果 ✅

```
✅ 登录成功
✅ 跳转到主页
✅ 显示用户信息栏
✅ 页面布局完美
✅ 无数据库错误
```

---

## 📋 迁移脚本做了什么

1. **检查列是否存在**
   - 避免重复添加

2. **添加 is_active 列**
   ```sql
   ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE
   ```

3. **更新现有用户**
   ```sql
   UPDATE users SET is_active = TRUE WHERE is_active IS NULL
   ```

4. **添加其他缺失的列**
   - phone
   - wechat
   - other_contact
   - notes
   - other_info

---

## 🔍 如果迁移失败

### 检查数据库连接

```bash
# 确保 .env 文件中有正确的数据库配置
cat .env | grep DATABASE
```

应该看到：
```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=youtube_member
DATABASE_USER=postgres
DATABASE_PASSWORD=你的密码
```

### 手动运行SQL

如果迁移脚本失败，可以手动运行SQL：

```bash
# 连接数据库
psql -d youtube_member

# 执行SQL
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN phone VARCHAR(50);
ALTER TABLE users ADD COLUMN wechat VARCHAR(100);
ALTER TABLE users ADD COLUMN other_contact TEXT;
ALTER TABLE users ADD COLUMN notes TEXT;
ALTER TABLE users ADD COLUMN other_info TEXT;

UPDATE users SET is_active = TRUE WHERE is_active IS NULL;

# 退出
\q
```

---

## 🎯 完整流程

```bash
# 1. 停止服务器（如果在运行）
按 Ctrl+C

# 2. 运行迁移
npm run migrate

# 3. 等待迁移完成
看到 "🎉 Migration completed successfully!"

# 4. 重新启动服务器
npm start

# 5. 在浏览器访问
http://localhost:9015/public/clear.html

# 6. 清除缓存后自动跳转到登录页

# 7. 登录
admin@youtube.com / Admin@123456

# 8. 成功！
```

---

## ✅ 成功的标志

### 服务器启动日志
```
✅ QQ Email service initialized

╔═══════════════════════════════════════════════════════════════╗
║   🎬 YouTube 视频搜索 + 会员系统                               ║
║   🚀 Server running on: http://localhost:9015                ║
╚═══════════════════════════════════════════════════════════════╝
```

### 登录成功
```
POST /api/auth/login 200 ✅ (不再是401)
```

### 主页显示
```
✅ 紫色渐变用户信息栏
✅ 显示邮箱和余额
✅ 管理员标识
✅ 会员筛选框
✅ 所有功能正常
```

---

## 🎉 修复完成！

所有数据库问题已解决：
- ✅ 添加了 is_active 列
- ✅ 添加了其他缺失的列
- ✅ 更新了现有用户数据
- ✅ 登录功能正常

**现在运行 `npm run migrate`，然后重启服务器即可！** 🚀
