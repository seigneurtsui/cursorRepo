# 🎬 YouTube视频搜索 + 会员系统

## 📋 项目简介

这是一个将 **YouTube视频搜索与导出工具** 与 **完整会员管理系统** 深度整合的项目。实现了会员注册登录、按次计费、数据隔离、在线充值等完整功能。

### ✨ 核心特性

- 🔐 **完整会员系统** - 注册/登录/找回密码/邮箱验证
- 💰 **按次计费模式** - 每次获取YouTube数据收费5元
- 🔒 **数据完全隔离** - 用户只能看到自己的数据
- 👤 **管理员功能** - 可查看所有用户数据并筛选
- 💳 **在线充值** - 6种充值套餐，支持多种支付方式
- 📊 **交易记录** - 完整的充值和消费记录
- 🔔 **多渠道通知** - 邮件/微信/Telegram等

---

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd workspace
```

### 2. 安装依赖

```bash
npm install
```

需要安装以下核心依赖：
- express
- pg (PostgreSQL)
- googleapis (YouTube API)
- bcryptjs (密码加密)
- jsonwebtoken (JWT认证)
- exceljs (Excel导出)
- nodemailer (邮件发送)

### 3. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置（必填）
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=youtube_member
DB_USER=postgres
DB_PASSWORD=your_password

# YouTube API（必填）
YOUTUBE_API_KEY=your_youtube_api_key

# JWT Secret（必填，至少32个字符）
JWT_SECRET=your_jwt_secret_key_at_least_32_characters_long

# 邮件配置（可选，用于找回密码）
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@email.com
EMAIL_PASS=your_password
EMAIL_FROM=YouTube系统 <your@email.com>

# 通知系统（可选）
WXPUSHER_TOKEN=your_token
WXPUSHER_UID=your_uid
PUSHPLUS_TOKEN=your_token
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id

# 服务器端口
PORT=3000
```

### 4. 初始化数据库

```bash
npm run init-db
```

这将创建所有必要的数据库表和默认数据：
- ✅ 用户表（users）
- ✅ YouTube视频表（youtube_videos）
- ✅ 充值套餐表（recharge_plans，含6个预置套餐）
- ✅ 交易记录表（transactions）
- ✅ 验证码表（captcha_records）
- ✅ 默认管理员账号

**默认管理员账号：**
```
📧 邮箱: admin@youtube.com
🔑 密码: Admin@123456
⚠️ 请立即登录并修改密码！
```

### 5. 启动服务

```bash
npm start
```

或使用开发模式（自动重启）：

```bash
npm run dev
```

### 6. 访问应用

打开浏览器访问：`http://localhost:3000`

首次访问会自动跳转到登录页面。

---

## 📊 系统架构

### 技术栈

**后端：**
- Node.js + Express
- PostgreSQL 数据库
- YouTube Data API v3
- JWT 认证
- bcrypt 密码加密

**前端：**
- 纯HTML/CSS/JavaScript
- Tailwind CSS
- 无框架依赖

### 数据库设计

```
users (用户表)
  ├── id, email, password_hash
  ├── username, is_admin
  ├── balance, total_recharged
  └── status, created_at

youtube_videos (视频表)
  ├── id, user_id (关键！)
  ├── video_id, title, description
  ├── channel_title, channel_id
  ├── view_count, like_count
  └── published_at, created_at

transactions (交易表)
  ├── id, user_id
  ├── type, amount
  ├── balance_before, balance_after
  └── description, created_at

recharge_plans (充值套餐)
  ├── id, name, amount
  ├── bonus, total_amount
  └── description, is_active
```

---

## 💰 计费说明

### 按次收费标准

| 操作 | 费用 | API路由 |
|------|------|---------|
| 关键词搜索 | 5元/次 | POST /api/search |
| 按频道获取 | 5元/次 | POST /api/fetch-by-channels |

### 充值套餐

| 套餐 | 金额 | 赠送 | 实得 | 可用次数 |
|------|------|------|------|----------|
| 体验套餐 | ¥10 | ¥0 | ¥10 | 2次 |
| 基础套餐 | ¥50 | ¥5 | ¥55 | 11次 |
| 标准套餐 | ¥100 | ¥15 | ¥115 | 23次 |
| 进阶套餐 | ¥200 | ¥40 | ¥240 | 48次 |
| 专业套餐 | ¥500 | ¥120 | ¥620 | 124次 |
| 企业套餐 | ¥1000 | ¥300 | ¥1300 | 260次 |

---

## 🔐 用户权限

### 普通用户
- ✅ 注册和登录
- ✅ 充值余额
- ✅ 搜索YouTube视频（每次5元）
- ✅ 查看/筛选/导出**自己的**视频数据
- ✅ 查看交易记录
- ✅ 修改个人资料

### 管理员
- ✅ 所有普通用户权限
- ✅ 查看**所有用户**的视频数据
- ✅ 使用"会员筛选"功能
- ✅ 查看用户列表和余额
- ✅ 查看所有交易记录
- ✅ 手动为用户充值
- ✅ 管理用户状态

---

## 📱 页面导航

| 页面 | 路径 | 说明 |
|------|------|------|
| 主页 | `/` | YouTube视频搜索和展示 |
| 登录 | `/public/login.html` | 会员登录 |
| 注册 | `/public/register.html` | 会员注册 |
| 个人中心 | `/public/profile.html` | 余额、充值、资料 |
| 管理后台 | `/public/admin.html` | 管理员专用 |
| 忘记密码 | `/public/forgot-password.html` | 密码找回 |

---

## 🔑 核心API接口

### 认证相关

```bash
# 注册
POST /api/auth/register
Body: { email, password, username }

# 登录
POST /api/auth/login
Body: { email, password }

# 获取当前用户信息
GET /api/auth/me
Headers: Authorization: Bearer <token>

# 退出登录
POST /api/auth/logout
```

### YouTube搜索（需要认证+计费）

```bash
# 关键词搜索（5元）
POST /api/search
Headers: Authorization: Bearer <token>
Body: { keyword: "搜索关键词" }
Response: {
  message: "搜索完成！共处理 50 条视频...",
  updatedOrInsertedCount: 50,
  cost: 5.00,
  balance: 45.00
}

# 按频道获取（5元）
POST /api/fetch-by-channels
Headers: Authorization: Bearer <token>
Body: { identifiers: ["@channelname", "UCxxxxx"] }

# 获取视频列表（分页+筛选+数据隔离）
GET /api/videos-paginated?page=1&limit=9&filterUserId=123
Headers: Authorization: Bearer <token>

# 导出Excel
GET /api/export?sortBy=view_count&sortOrder=DESC
Headers: Authorization: Bearer <token>
```

### 管理员API

```bash
# 获取用户列表（含视频数量）
GET /api/admin/users
Headers: Authorization: Bearer <token>
Response: [
  {
    id: 1,
    email: "user@example.com",
    username: "张三",
    balance: 50.00,
    video_count: 120
  }
]
```

---

## 🔒 数据隔离实现

### 数据库层面

```sql
-- youtube_videos表包含user_id外键
CREATE TABLE youtube_videos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),  -- 关键字段
    video_id VARCHAR(50),
    ...
    UNIQUE(user_id, video_id)  -- 复合唯一索引
);
```

### API层面

```javascript
// 普通用户只能查询自己的数据
if (!isAdmin) {
    query += ' WHERE user_id = $1';
    params.push(userId);
}

// 管理员可以筛选特定用户
if (isAdmin && filterUserId) {
    query += ' WHERE user_id = $1';
    params.push(filterUserId);
}
```

### 前端层面

```javascript
// 管理员专用筛选控件
<select id="userFilter" style="display: none;">
    <option value="">全部会员</option>
    <option value="123">user@example.com (50个视频)</option>
</select>

// 根据isAdmin显示/隐藏
if (currentUser.isAdmin) {
    document.getElementById('userFilter').style.display = 'block';
}
```

---

## 👤 管理员会员筛选功能

### 使用步骤

1. **使用管理员账号登录**
   ```
   邮箱: admin@youtube.com
   密码: Admin@123456（首次登录后请修改）
   ```

2. **查看会员筛选控件**
   - 登录后，主页顶部会显示黄色的"会员筛选"区域
   - 仅管理员可见

3. **选择要查看的会员**
   - 下拉框列出所有会员
   - 显示格式：`user@example.com (50个视频, 余额¥100.00)`

4. **查看该会员的数据**
   - 选择后，视频列表自动刷新
   - 显示该会员的所有视频数据
   - 可以进行筛选、排序、导出

5. **切换回所有数据**
   - 选择"全部会员"选项
   - 显示所有用户的数据汇总

---

## 📝 使用场景示例

### 场景1：普通用户使用

```
1. 访问 http://localhost:3000
2. 点击"立即注册"
3. 填写邮箱、密码、用户名
4. 登录系统
5. 点击"个人中心"
6. 选择充值套餐（如¥100标准套餐）
7. 完成支付，获得¥115余额
8. 返回主页
9. 输入关键词"Python教程"
10. 点击"获取数据并入库"
11. 确认扣费5元
12. 查看搜索结果（23次可用）
13. 筛选、排序、导出数据
```

### 场景2：管理员管理

```
1. 使用admin@youtube.com登录
2. 看到"管理员"标识
3. 看到"会员筛选"下拉框
4. 选择"user@example.com"
5. 查看该用户的所有视频
6. 导出该用户的数据
7. 点击"管理后台"
8. 查看所有用户列表
9. 查看交易记录
10. 手动为用户充值
```

---

## 🛡️ 安全特性

- ✅ 密码bcrypt加密（盐值轮次10）
- ✅ JWT Token认证（有效期7天）
- ✅ SQL注入防护（参数化查询）
- ✅ XSS防护（输入验证）
- ✅ 频率限制（验证码60秒/次）
- ✅ 数据库级别的外键约束
- ✅ API级别的权限检查
- ✅ 前端级别的显示控制

---

## 🔧 故障排查

### 问题1：无法连接数据库

```bash
# 检查PostgreSQL状态
sudo systemctl status postgresql

# 检查.env配置
cat .env | grep DB_

# 测试连接
psql -h localhost -U postgres -d youtube_member
```

### 问题2：登录后立即跳转回登录页

```bash
# 检查JWT_SECRET是否配置
echo $JWT_SECRET | wc -c  # 应该 > 32

# 检查token是否保存
# 浏览器控制台：localStorage.getItem('token')

# 检查/api/auth/me接口
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
```

### 问题3：余额扣除但未保存数据

```bash
# 检查数据库事务
# 如果YouTube API失败，应该回滚事务

# 查看错误日志
tail -f server.log
```

### 问题4：管理员看不到筛选控件

```bash
# 检查用户is_admin字段
psql -d youtube_member -c "SELECT id, email, is_admin FROM users WHERE email = 'admin@youtube.com';"

# 应该返回 is_admin = t (true)
```

---

## 📚 相关文档

- `INTEGRATION_GUIDE.md` - 详细的整合说明
- `FRONTEND_INTEGRATION_GUIDE.md` - 前端修改指南
- `API.md` - 完整API文档
- `DATABASE.md` - 数据库设计文档

---

## ⚙️ 高级配置

### 修改计费金额

编辑 `server-youtube-member.js`：

```javascript
// 搜索以下代码并修改金额
const cost = 5.00;  // 改为你想要的金额，如 10.00
```

### 添加新的充值套餐

```sql
INSERT INTO recharge_plans (name, amount, bonus, total_amount, description, sort_order)
VALUES ('超级套餐', 2000.00, 800.00, 2800.00, '超大额度', 7);
```

### 自定义通知内容

编辑 `services/notification.js`，修改消息模板。

---

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发流程

1. Fork本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

---

## 📄 许可证

MIT License

---

## 🎉 致谢

- [YouTube Data API](https://developers.google.com/youtube/v3)
- [Express.js](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## 📞 联系支持

如有问题，请：
1. 查看文档
2. 检查Issue列表
3. 提交新Issue
4. 联系开发团队

---

**项目完成！祝使用愉快！** 🎬✨
