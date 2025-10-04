# YouTube 视频搜索与导出 - 会员系统集成

## 项目概述

本项目已成功集成了完整的会员认证和管理系统，包括：

- ✅ 用户注册和登录
- ✅ 会员中心（余额管理、密码修改）
- ✅ 按次付费系统（每次获取数据5元人民币）
- ✅ 数据隔离（会员只能看到自己的数据）
- ✅ 管理员功能（查看所有会员数据、会员筛选、余额管理）

## 安装步骤

### 1. 安装依赖

```bash
cd /workspace/upload-video-2-youtube
npm install
```

### 2. 配置环境变量

创建 `.env` 文件（可从 `env.example` 复制）：

```env
# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key_here

# Database
DB_USER=postgres
DB_HOST=localhost
DB_DATABASE=youtube_videos
DB_PASSWORD=your_password_here
DB_PORT=5432

# Authentication
JWT_SECRET=your_secret_key_change_in_production
JWT_EXPIRES_IN=7d

# Server
PORT=3000
```

### 3. 初始化数据库

确保PostgreSQL已安装并运行，然后执行初始化脚本：

```bash
psql -U postgres -d youtube_videos -f init-db.sql
```

这将创建以下表：
- `users` - 用户表
- `email_verifications` - 邮箱验证码表
- `transactions` - 交易记录表
- `videos` - 视频数据表（已添加user_id字段）

### 4. 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动

## 默认管理员账号

- **邮箱**: admin@example.com
- **密码**: admin123456
- **初始余额**: ¥999,999.00

⚠️ **重要**: 首次使用后请立即修改管理员密码！

## 功能说明

### 1. 用户功能

#### 注册
- 访问 `register.html`
- 填写邮箱、用户名、密码（至少8位）
- 点击"发送验证码"获取邮箱验证码
- 注册成功后跳转到登录页面

#### 登录
- 访问 `login.html`
- 输入邮箱和密码
- 登录成功后跳转到主页

#### 会员中心
- 查看账户余额
- 查看账户信息
- 修改密码
- 查看计费标准

### 2. 数据获取（按次付费）

每次点击"获取数据并入库"按钮将：
- 扣费 **5元人民币**
- 从YouTube获取视频数据并存入数据库
- 更新显示的余额

**计费方式**：
- 关键词搜索：5元/次
- 频道搜索：5元/次
- 管理员账号：免费使用

### 3. 数据隔离

- 普通会员只能查看自己获取的视频数据
- 筛选、排序、导出功能仅对自己的数据生效
- 完全的数据隔离保证隐私安全

### 4. 管理员功能

管理员登录后可以：

#### 会员筛选
- 在筛选区域显示"👥 会员筛选"下拉菜单
- 选择特定会员查看其数据
- 选择"所有会员"查看全部数据

#### 会员管理
- 查看所有会员列表
- 调整会员余额
- 查看会员交易记录

### 5. 导出功能

- 支持导出为Excel格式
- 导出内容包括：视频ID、标题、频道、观看数、点赞数等
- 管理员可以导出特定会员的数据

## API端点

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 退出登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/send-code` - 发送验证码
- `POST /api/auth/change-password` - 修改密码
- `PUT /api/auth/profile` - 更新用户信息

### 管理员相关
- `GET /api/auth/admin/users` - 获取所有用户（管理员）
- `PUT /api/auth/admin/users/:id/balance` - 调整用户余额（管理员）

### 数据相关
- `POST /api/search` - 搜索YouTube视频（需认证，扣费5元）
- `POST /api/fetch-by-channels` - 按频道获取视频（需认证，扣费5元）
- `GET /api/videos-paginated` - 获取视频列表（需认证，支持会员筛选）
- `GET /api/stats` - 获取统计数据（需认证）
- `GET /api/channels` - 获取频道列表（需认证）
- `GET /api/export` - 导出Excel（需认证）

## 数据库表结构

### users 表
- `id` - 用户ID
- `email` - 邮箱（唯一）
- `username` - 用户名
- `password_hash` - 密码哈希
- `phone` - 手机号
- `balance` - 账户余额
- `is_admin` - 是否管理员
- `is_active` - 是否激活
- `email_verified` - 邮箱是否验证
- `created_at` - 创建时间
- `updated_at` - 更新时间
- `last_login_at` - 最后登录时间

### videos 表（已修改）
- 新增 `user_id` 字段，关联用户
- 其他字段保持不变

### transactions 表
- `id` - 交易ID
- `user_id` - 用户ID
- `type` - 交易类型（recharge充值/usage消费）
- `amount` - 金额
- `status` - 状态
- `payment_method` - 支付方式
- `description` - 描述
- `created_at` - 创建时间

## 充值说明

目前充值功能需要管理员手动操作：

1. 管理员登录系统
2. 获取所有用户列表
3. 调用API调整指定用户的余额

未来可以集成第三方支付平台实现自动充值。

## 安全建议

1. **修改默认管理员密码**
2. **设置强JWT密钥**：在.env文件中设置复杂的JWT_SECRET
3. **使用HTTPS**：生产环境必须使用HTTPS
4. **定期备份数据库**
5. **限制管理员IP**：可以在nginx等反向代理层面限制管理员访问IP

## 故障排除

### 无法登录
- 检查数据库连接
- 确认JWT_SECRET已设置
- 查看浏览器控制台错误信息

### 余额扣除异常
- 检查数据库事务是否正常
- 查看服务器日志
- 确认用户余额是否充足

### 数据隔离失效
- 确认用户已正确登录
- 检查API请求中是否包含Authorization header
- 查看服务器端的用户认证逻辑

## 技术栈

- **后端**: Node.js + Express
- **数据库**: PostgreSQL
- **认证**: JWT (JSON Web Tokens)
- **加密**: bcryptjs
- **前端**: Vanilla JavaScript + Tailwind CSS

## 更新日志

### 2025-10-04
- ✅ 集成完整的会员认证系统
- ✅ 实现按次付费机制（5元/次）
- ✅ 添加数据隔离功能
- ✅ 实现管理员会员筛选功能
- ✅ 添加会员中心页面
- ✅ 更新所有API端点以支持认证

## 联系方式

如有问题，请联系系统管理员。

## 许可证

ISC
