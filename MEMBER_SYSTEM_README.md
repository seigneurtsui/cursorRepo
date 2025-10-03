# 会员系统集成说明

## ✅ 已完成的功能（MVP版本）

### 1. 后端功能
- ✅ 数据库表结构（users, email_verifications, payment_plans, transactions, usage_logs）
- ✅ 用户注册/登录API（带邮箱验证码）
- ✅ JWT认证中间件
- ✅ 密码加密（bcrypt）
- ✅ 充值套餐管理
- ✅ 模拟支付功能（不对接真实支付）
- ✅ 余额检查和扣费
- ✅ 管理员API（用户管理、交易查询、导出Excel）
- ✅ 通知集成（注册、充值通知）

### 2. 安全措施
- ✅ 密码加密存储（bcrypt, salt rounds: 10）
- ✅ JWT Token认证（7天有效期）
- ✅ 邮箱验证码（10分钟有效，一次性使用）
- ✅ 管理员权限检查
- ✅ 余额检查（防止透支）
- ✅ 数据库事务（防止并发问题）

### 3. API端点

#### 认证相关
- `POST /api/auth/send-code` - 发送验证码
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 退出登录
- `GET /api/auth/me` - 获取当前用户信息
- `PUT /api/auth/profile` - 更新用户信息
- `POST /api/auth/change-password` - 修改密码
- `POST /api/auth/change-email` - 修改邮箱

#### 支付相关
- `GET /api/auth/payment-plans` - 获取套餐列表
- `POST /api/auth/recharge` - 充值（模拟支付）
- `GET /api/auth/transactions` - 获取交易记录

#### 管理员相关
- `GET /api/auth/admin/users` - 获取用户列表
- `GET /api/auth/admin/transactions` - 获取所有交易
- `PUT /api/auth/admin/payment-plans/:id` - 更新套餐
- `GET /api/auth/admin/export-users` - 导出用户Excel

#### 视频处理（已集成认证）
- `POST /api/upload` - 上传视频（需要登录）
- `POST /api/process` - 处理视频（需要登录+余额检查）

## 🔄 需要完成的前端页面

### 1. 登录页面（public/login.html）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>登录 - 视频章节生成器</title>
  <link rel="stylesheet" href="/public/styles.css">
</head>
<body>
  <div class="auth-container">
    <h1>🎬 视频章节生成器</h1>
    <h2>会员登录</h2>
    <form id="loginForm">
      <input type="email" id="email" placeholder="邮箱" required>
      <input type="password" id="password" placeholder="密码（至少8位）" required>
      <button type="submit">登录</button>
    </form>
    <p>还没有账号？<a href="/public/register.html">立即注册</a></p>
  </div>
  <script src="/public/auth.js"></script>
</body>
</html>
```

### 2. 注册页面（public/register.html）

包含字段：
- 邮箱（必填）
- 用户名（必填）
- 验证码（必填，带"发送验证码"按钮）
- 密码（必填，至少8位）
- 手机号（可选）
- 微信（可选）
- 其他联系方式（可选）
- 备注（可选）

### 3. 会员中心页面（public/profile.html）

功能模块：
- 用户信息显示
- 当前余额显示
- 充值套餐选择
- 支付方式选择（支付宝、微信、Stripe等，模拟）
- 交易记录查询
- 修改邮箱/密码

### 4. 管理员后台（public/admin.html）

功能模块：
- 用户列表（分页）
- 交易记录（分页）
- 导出用户Excel
- 修改套餐价格

### 5. 前端JavaScript（public/auth.js）

主要函数：
- `login()` - 登录
- `register()` - 注册
- `sendVerificationCode()` - 发送验证码
- `checkAuth()` - 检查登录状态
- `logout()` - 退出登录
- `getProfile()` - 获取用户信息
- `recharge()` - 充值

## 📦 默认账户

### 管理员账户（测试用）
- 邮箱：`admin@example.com`
- 密码：`admin123456`
- 权限：管理员（不扣费，可查看所有数据）

**注意**：首次使用需要运行 `npm run init-db` 初始化数据库

## 🔐 安全注意事项

### 生产环境必须修改：

1. **JWT_SECRET**
   ```
   JWT_SECRET=your-very-secure-random-string-at-least-32-characters
   ```

2. **管理员默认密码**
   - 在 `scripts/init-db.js` 中修改默认管理员的密码hash
   - 或者首次登录后立即修改密码

3. **HTTPS**
   - 生产环境必须使用 HTTPS
   - Cookie 设置为 `secure: true`

4. **CORS配置**
   - 限制允许的域名
   ```javascript
   app.use(cors({
     origin: 'https://yourdomain.com',
     credentials: true
   }));
   ```

## 💳 关于真实支付集成

当前是**模拟支付**，点击充值立即到账。

要集成真实支付，需要：

### 支付宝
1. 申请企业支付宝账号
2. 获取 APP_ID, 私钥, 公钥
3. 安装 `alipay-sdk`
4. 修改 `services/payment.js` 中的 `createTransaction` 方法
5. 添加支付宝回调处理

### 微信支付
1. 申请微信商户号
2. 获取 API密钥
3. 安装 `wechatpay-node-v3`
4. 实现支付回调

### Stripe / PayPal
1. 注册商户账号
2. 获取 API密钥
3. 前端集成 Stripe.js 或 PayPal SDK
4. 后端验证支付状态

### 安全建议
- 支付回调必须验证签名
- 使用 HTTPS
- 记录所有支付日志
- 定期对账
- 实现退款功能

## 🚀 启动步骤

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
复制 `.env.example` 到 `.env` 并修改：
```bash
cp .env.example .env
# 编辑 .env 文件，设置数据库和JWT密钥
```

### 3. 初始化数据库
```bash
npm run init-db
```

这将创建：
- 所有必需的表
- 默认支付套餐
- 管理员账户

### 4. 启动服务器
```bash
npm start
```

### 5. 访问系统
- 登录页面：`http://localhost:3000/public/login.html`
- 注册页面：`http://localhost:3000/public/register.html`
- 主页面：`http://localhost:3000/` （需要登录）

## 📝 数据库表说明

### users 表
存储用户信息
- `balance`: 账户余额（精确到分）
- `is_admin`: 是否管理员
- `email_verified`: 邮箱是否验证

### payment_plans 表
充值套餐
- 按次付费：5元/次
- 月套餐：50元
- 年套餐：300元

### transactions 表
所有交易记录
- `type`: 'recharge'（充值）或 'usage'（消费）
- `status`: 'pending', 'completed', 'failed'

### usage_logs 表
使用记录，用于审计

## 🔧 自定义配置

### 修改单次处理费用
在 `server.js` 中：
```javascript
const PROCESSING_COST = 5.00; // 改为你想要的价格
```

### 修改套餐价格
方式1：管理员后台修改
方式2：直接修改数据库
```sql
UPDATE payment_plans SET price = 10.00 WHERE name = '按次付费';
```

### 修改Token有效期
在 `.env` 中：
```
JWT_EXPIRES_IN=30d  # 30天
```

## ⚠️ 已知限制（MVP版本）

1. **没有真实支付集成** - 仅模拟支付
2. **没有忘记密码功能** - 可后续添加
3. **没有手机验证** - 仅邮箱验证
4. **没有第三方登录** - 无微信/QQ登录
5. **前端页面需要自己创建** - 仅提供后端API
6. **没有购买记录页面** - 仅API
7. **没有退款功能** - 需自行实现

## 📚 下一步开发建议

### 优先级高
1. 创建前端登录/注册页面
2. 创建会员中心页面
3. 测试注册、登录、充值流程
4. 创建管理员后台页面

### 优先级中
1. 添加忘记密码功能
2. 改善邮箱验证（使用真实邮件服务）
3. 添加用户头像上传
4. 添加优惠券系统

### 优先级低
1. 集成真实支付API
2. 添加第三方登录
3. 添加推荐奖励系统
4. 添加会员等级系统

## 🆘 常见问题

### Q: 如何创建新管理员？
A: 直接修改数据库
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'user@example.com';
```

### Q: 如何给用户充值？
A: 两种方式
1. 用户自己在前端充值（模拟支付）
2. 管理员直接修改数据库
```sql
UPDATE users SET balance = balance + 100 WHERE id = 用户ID;
```

### Q: 如何查看所有交易？
A: 访问管理员API或查询数据库
```sql
SELECT * FROM transactions ORDER BY created_at DESC;
```

### Q: Token过期怎么办？
A: 用户需要重新登录

### Q: 如何防止恶意注册？
A: 可以添加：
- 图形验证码
- IP限制
- 邀请码系统
- 实名认证

## 📞 技术支持

如有问题，请检查：
1. 数据库连接是否正常
2. `.env` 配置是否正确
3. 依赖包是否安装完整
4. 端口是否被占用

查看日志以获取详细错误信息。
