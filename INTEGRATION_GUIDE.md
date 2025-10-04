# 🎬 YouTube视频搜索 + 会员系统 整合指南

## 📋 项目概述

本项目将 **YouTube 视频搜索与导出工具** 与 **完整的会员管理系统** 进行了深度整合，实现了：

1. ✅ 会员注册/登录系统
2. ✅ 按次计费（每次获取数据5元）
3. ✅ 会员间数据完全隔离
4. ✅ 管理员可查看所有会员数据并筛选
5. ✅ 在线充值系统（支持6种套餐）
6. ✅ 多渠道通知系统

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并配置：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=youtube_member
DB_USER=postgres
DB_PASSWORD=your_password

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key

# JWT Secret
JWT_SECRET=your_jwt_secret_key_min_32_chars

# 邮件配置（可选）
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@email.com
EMAIL_PASS=your_password
EMAIL_FROM=YouTube系统 <your@email.com>

# 通知系统（可选）
WXPUSHER_TOKEN=your_token
PUSHPLUS_TOKEN=your_token
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id

# 服务器
PORT=3000
```

### 3. 初始化数据库

```bash
npm run init-db
```

这将创建：
- ✅ 会员表（users）
- ✅ 充值套餐表（recharge_plans）
- ✅ 交易记录表（transactions）
- ✅ YouTube视频表（youtube_videos，带user_id）
- ✅ 验证码表（captcha_records）
- ✅ 默认管理员账号

**默认管理员账号：**
- 📧 邮箱: `admin@youtube.com`
- 🔑 密码: `Admin@123456`
- ⚠️ **请立即登录修改密码！**

### 4. 启动服务

```bash
npm start
```

访问：`http://localhost:3000`

---

## 📊 核心功能变更

### 1. 数据隔离机制

**数据库层面：**
```sql
CREATE TABLE youtube_videos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),  -- 新增字段
    video_id VARCHAR(50),
    title TEXT,
    ...
    UNIQUE(user_id, video_id)  -- 复合唯一索引
);
```

**API层面：**
- 普通用户：只能查询/导出自己的数据
- 管理员：可以查看所有用户的数据

### 2. 计费系统

**每次获取数据收费5元：**

| 操作 | 费用 | 说明 |
|------|------|------|
| 关键词搜索 | 5元 | `/api/search` |
| 按频道获取 | 5元 | `/api/fetch-by-channels` |

**计费流程：**
1. 检查用户余额
2. 扣费并记录交易
3. 执行YouTube API调用
4. 保存数据到数据库
5. 返回结果和余额

**示例响应：**
```json
{
  "message": "搜索完成！共处理 50 条视频，已扣费 5 元。",
  "updatedOrInsertedCount": 50,
  "cost": 5.00,
  "balance": 45.00
}
```

### 3. 管理员功能

#### 会员筛选功能

**新增API：** `GET /api/admin/users`

返回所有会员列表，包括：
- 用户ID
- 邮箱
- 用户名
- 余额
- 视频数量
- 注册时间

**前端实现：**
```javascript
// 管理员专用：用户筛选下拉框
<select id="userFilter">
    <option value="">全部会员</option>
    <option value="123">user@example.com (50个视频)</option>
    ...
</select>
```

**筛选查询：**
```javascript
// 添加 filterUserId 参数
fetch(`/api/videos-paginated?filterUserId=123&...`)
```

---

## 🎨 前端页面结构

### 页面列表

| 页面 | 路径 | 说明 |
|------|------|------|
| 主页 | `/` | YouTube视频搜索和展示（需要登录） |
| 登录 | `/public/login.html` | 会员登录 |
| 注册 | `/public/register.html` | 会员注册 |
| 个人中心 | `/public/profile.html` | 账户信息、余额、充值 |
| 管理后台 | `/public/admin.html` | 管理员专用（用户/交易管理） |
| 忘记密码 | `/public/forgot-password.html` | 密码找回 |

### 主页修改要点

需要修改原 `index.html`，添加：

1. **登录状态检测**
```javascript
// 检查登录状态
async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/public/login.html';
        return null;
    }
    
    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            window.location.href = '/public/login.html';
            return null;
        }
        return await response.json();
    } catch (error) {
        window.location.href = '/public/login.html';
        return null;
    }
}
```

2. **用户信息显示**
```html
<!-- 头部添加用户信息 -->
<div class="user-info">
    <span id="userEmail"></span>
    <span class="balance">余额: ¥<span id="userBalance">0.00</span></span>
    <button onclick="location.href='/public/profile.html'">个人中心</button>
    <button onclick="logout()">退出登录</button>
</div>
```

3. **管理员筛选（仅管理员可见）**
```html
<!-- 管理员专用：会员筛选 -->
<div id="adminControls" style="display:none;">
    <label>👤 筛选会员：</label>
    <select id="userFilter" onchange="filterByUser()">
        <option value="">全部会员</option>
    </select>
</div>
```

4. **计费提示**
```javascript
// 搜索前提示
async function searchVideos() {
    if (!confirm('本次搜索将扣费 5 元，是否继续？')) {
        return;
    }
    
    // 执行搜索...
}
```

5. **余额不足处理**
```javascript
// 处理余额不足
if (response.status === 402) {
    const data = await response.json();
    alert(`余额不足！当前余额: ¥${data.balance}，需要: ¥${data.required}`);
    if (confirm('是否前往充值？')) {
        window.location.href = '/public/profile.html';
    }
}
```

---

## 🔐 API 接口变更

### 认证中间件

所有YouTube相关API都需要认证：

```javascript
// 请求时需要携带token
fetch('/api/search', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ keyword: 'xxx' })
})
```

### API列表

#### 会员系统 API

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| POST | `/api/auth/logout` | 退出登录 |
| POST | `/api/auth/forgot-password` | 忘记密码 |
| POST | `/api/auth/reset-password` | 重置密码 |
| POST | `/api/auth/send-captcha` | 发送验证码 |

#### 会员中心 API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/membership/profile` | 获取个人资料 |
| PUT | `/api/membership/profile` | 更新个人资料 |
| PUT | `/api/membership/password` | 修改密码 |
| GET | `/api/membership/balance` | 获取余额 |
| GET | `/api/membership/transactions` | 获取交易记录 |

#### 充值系统 API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/payment/plans` | 获取充值套餐 |
| POST | `/api/payment/create-order` | 创建充值订单 |
| POST | `/api/payment/ijpay/create` | IJPay创建订单 |
| POST | `/api/payment/ijpay/callback` | IJPay回调 |

#### YouTube搜索 API（需要认证+计费）

| Method | Path | 说明 | 费用 |
|--------|------|------|------|
| POST | `/api/search` | 关键词搜索 | 5元 |
| POST | `/api/fetch-by-channels` | 按频道获取 | 5元 |
| GET | `/api/stats` | 获取统计（带权限） | 免费 |
| GET | `/api/channels` | 获取频道列表（带权限） | 免费 |
| GET | `/api/videos-paginated` | 分页查询（带权限） | 免费 |
| GET | `/api/export` | 导出Excel（带权限） | 免费 |

#### 管理员 API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/admin/users` | 获取用户列表 |
| GET | `/api/admin/stats` | 获取系统统计 |
| POST | `/api/admin/recharge` | 手动充值 |
| PUT | `/api/admin/user/:id/status` | 修改用户状态 |

---

## 💰 充值套餐

系统预置6个充值套餐：

| 套餐名 | 金额 | 赠送 | 实得 | 说明 |
|--------|------|------|------|------|
| 体验套餐 | ¥10 | ¥0 | ¥10 | 可搜索2次 |
| 基础套餐 | ¥50 | ¥5 | ¥55 | 可搜索11次 |
| 标准套餐 | ¥100 | ¥15 | ¥115 | 可搜索23次 |
| 进阶套餐 | ¥200 | ¥40 | ¥240 | 可搜索48次 |
| 专业套餐 | ¥500 | ¥120 | ¥620 | 可搜索124次 |
| 企业套餐 | ¥1000 | ¥300 | ¥1300 | 可搜索260次 |

---

## 🛡️ 安全特性

### 1. 密码加密
- 使用 `bcryptjs` 进行密码哈希
- 盐值轮次：10

### 2. JWT 认证
- Token有效期：7天
- 自动续期机制
- HttpOnly Cookie支持

### 3. 数据隔离
- 数据库层面：user_id外键约束
- API层面：middleware验证
- 前端层面：权限控制

### 4. 输入验证
- 邮箱格式验证
- 密码强度要求（8位以上，含大小写字母+数字）
- SQL注入防护（参数化查询）
- XSS防护

### 5. 频率限制
- 验证码：60秒/次
- 登录尝试：5次/15分钟
- API调用：基于余额限制

---

## 📝 数据库Schema

### users (用户表)
```sql
id SERIAL PRIMARY KEY
email VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
username VARCHAR(100)
is_admin BOOLEAN DEFAULT FALSE
balance NUMERIC(10, 2) DEFAULT 0.00
total_recharged NUMERIC(10, 2) DEFAULT 0.00
status VARCHAR(20) DEFAULT 'active'
email_verified BOOLEAN DEFAULT FALSE
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
last_login_at TIMESTAMP
```

### youtube_videos (视频表)
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id)  -- 关键：用户ID
video_id VARCHAR(50) NOT NULL
playlist_id VARCHAR(50)
title TEXT
description TEXT
thumbnail_url TEXT
published_at TIMESTAMP
channel_title VARCHAR(255)
channel_id VARCHAR(50)
view_count BIGINT DEFAULT 0
like_count INTEGER DEFAULT 0
comment_count INTEGER DEFAULT 0
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
UNIQUE(user_id, video_id)  -- 复合唯一索引
```

### transactions (交易表)
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id)
type VARCHAR(50) NOT NULL  -- 'search_deduct', 'channel_fetch_deduct', 'recharge'
amount NUMERIC(10, 2) NOT NULL
balance_before NUMERIC(10, 2)
balance_after NUMERIC(10, 2)
description TEXT
order_id VARCHAR(100)
payment_method VARCHAR(50)
payment_status VARCHAR(50)
operator_id INTEGER REFERENCES users(id)
created_at TIMESTAMP DEFAULT NOW()
```

---

## 🎯 使用流程

### 普通用户流程

```
1. 注册账号 → 2. 登录系统 → 3. 充值余额 → 4. 搜索视频（扣费5元）
   ↓
5. 查看/筛选/导出自己的视频数据
```

### 管理员流程

```
1. 使用管理员账号登录
   ↓
2. 查看所有用户和数据
   ↓
3. 使用"会员筛选"功能查看特定用户数据
   ↓
4. 管理用户余额、查看交易记录
```

---

## 🔧 故障排查

### 问题1：数据库连接失败
```bash
# 检查PostgreSQL是否运行
sudo systemctl status postgresql

# 检查.env配置
cat .env | grep DB_
```

### 问题2：JWT验证失败
```bash
# 确保JWT_SECRET至少32个字符
echo $JWT_SECRET | wc -c  # 应该 > 32
```

### 问题3：管理员无法登录
```bash
# 重置管理员密码
psql -d youtube_member -c "UPDATE users SET password_hash = '$2a$10$...' WHERE email = 'admin@youtube.com';"
```

### 问题4：用户看到其他用户数据
```bash
# 检查数据隔离是否正确
psql -d youtube_member -c "SELECT user_id, COUNT(*) FROM youtube_videos GROUP BY user_id;"
```

---

## 📚 相关文档

- `README.md` - 项目总体说明
- `INSTALL.md` - 详细安装指南
- `API.md` - 完整API文档
- `DATABASE.md` - 数据库设计文档

---

## ✅ 功能检查清单

- [x] 会员注册/登录系统
- [x] 按次计费（5元/次）
- [x] 数据完全隔离（user_id）
- [x] 管理员会员筛选功能
- [x] 充值套餐系统（6种）
- [x] 交易记录追踪
- [x] 个人中心（余额/资料）
- [x] 管理后台（用户/交易管理）
- [x] 邮件通知（可选）
- [x] 多渠道通知（可选）

---

**项目整合完成！欢迎使用 YouTube视频搜索 + 会员系统！** 🎉
