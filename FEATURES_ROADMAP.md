# 🗺️ 新功能实现路线图

## ✅ 已完成的紧急修复

### 修复1: PROCESSING_COST 未定义错误 ✅
**问题**: `ReferenceError: PROCESSING_COST is not defined`
**修复**: 
- 在 `server.js` 中定义常量
- 添加环境变量支持
- 默认值: 5.00 RMB

### 修复2: 注册验证码错误提示 ✅
**问题**: 验证码错误时无反馈
**修复**:
- 在 `register.html` 中添加详细错误提示
- 验证码错误时提示重新获取
- 使用不同颜色的 toast 消息

### 修复3: 会员中心修改密码 ✅
**问题**: 无法在会员中心修改密码
**修复**:
- 在 `profile.html` 添加密码修改表单
- 实现前端验证（长度、一致性）
- 调用后端 API `/api/auth/change-password`

---

## 🚀 待实现的新功能

由于功能数量较多且复杂度高，我将按优先级和实现难度提供实现方案。

### 优先级1：安全功能（推荐优先实现）

#### 1. 图形验证码防恶意注册 📊
**优先级**: 🔴 高
**实现难度**: ⭐⭐ (中等)
**预计时间**: 2-3小时

**方案A: svg-captcha (推荐)**
```bash
npm install svg-captcha
```

**实现步骤**:
1. 创建 `services/captcha.js` - 验证码生成服务
2. 添加 API: `GET /api/auth/captcha` - 生成验证码
3. 修改 `public/register.html` - 添加验证码显示
4. 修改注册API验证逻辑

**代码示例**:
```javascript
// services/captcha.js
const svgCaptcha = require('svg-captcha');
const sessions = new Map(); // 简单实现，生产用 Redis

class CaptchaService {
  generate(sessionId) {
    const captcha = svgCaptcha.create({
      size: 4,
      noise: 2,
      color: true
    });
    sessions.set(sessionId, {
      text: captcha.text.toLowerCase(),
      expires: Date.now() + 5 * 60 * 1000 // 5分钟
    });
    return captcha.data; // SVG
  }
  
  verify(sessionId, userInput) {
    const session = sessions.get(sessionId);
    if (!session) return false;
    if (Date.now() > session.expires) {
      sessions.delete(sessionId);
      return false;
    }
    return session.text === userInput.toLowerCase();
  }
}
```

**方案B: canvas验证码 (更简单)**
- 前端使用 Canvas API 生成
- 后端只需验证逻辑
- 安全性略低但实现快速

#### 2. 忘记密码功能 🔑
**优先级**: 🟡 中高
**实现难度**: ⭐⭐⭐ (中等)
**预计时间**: 3-4小时

**实现步骤**:
1. 创建 `public/forgot-password.html` - 忘记密码页面
2. 添加 API: `POST /api/auth/forgot-password` - 发送重置链接
3. 添加 API: `POST /api/auth/reset-password` - 重置密码
4. 修改 `public/login.html` - 添加"忘记密码"链接

**流程**:
```
用户输入邮箱
  ↓
发送验证码到邮箱
  ↓
用户输入验证码+新密码
  ↓
验证码正确，重置密码
  ↓
跳转到登录页
```

**安全考虑**:
- 重置链接包含随机token
- token 10分钟有效
- 使用后立即失效
- 防止暴力破解

---

### 优先级2：用户体验功能

#### 3. 用户头像上传 📸
**优先级**: 🟡 中
**实现难度**: ⭐⭐⭐ (中等)
**预计时间**: 2-3小时

**方案A: 本地存储**
```bash
# 使用已有的 multer
mkdir public/avatars
```

**实现步骤**:
1. 数据库添加字段: `users.avatar_url`
2. 添加 API: `POST /api/auth/upload-avatar`
3. 在 `profile.html` 添加头像上传组件
4. 图片压缩和格式转换

**方案B: 对象存储 (推荐生产)**
- 使用 AWS S3 / 阿里云 OSS
- 成本低、速度快、CDN加速
- 需要额外配置

**功能**:
- 支持 JPG、PNG、GIF
- 最大 2MB
- 自动压缩到 200x200
- 显示在会员中心和管理后台

#### 4. 优惠券系统 🎫
**优先级**: 🟢 中低
**实现难度**: ⭐⭐⭐⭐ (较高)
**预计时间**: 6-8小时

**数据库设计**:
```sql
CREATE TABLE coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE,
  type VARCHAR(20), -- 'percentage' | 'fixed'
  value NUMERIC(10,2),
  min_amount NUMERIC(10,2),
  max_discount NUMERIC(10,2),
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  max_uses INT,
  used_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE user_coupons (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  coupon_id INT REFERENCES coupons(id),
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**功能**:
- 生成优惠券（管理员）
- 领取优惠券
- 使用优惠券（充值时）
- 优惠券历史记录
- 自动过期检查

---

### 优先级3：高级功能（建议后期实现）

#### 5. 第三方登录 🌐
**优先级**: 🟢 低
**实现难度**: ⭐⭐⭐⭐⭐ (高)
**预计时间**: 10-20小时

**挑战**:
- 每个平台需要单独申请开发者账号
- 需要企业资质（微信、QQ）
- 需要域名和HTTPS
- 需要通过审核

**平台对比**:

| 平台 | 难度 | 企业要求 | SDK | 备注 |
|------|------|----------|-----|------|
| 微信 | ⭐⭐⭐⭐⭐ | 是 | 官方 | 需要公众号/开放平台 |
| QQ | ⭐⭐⭐⭐ | 否 | 官方 | 相对简单 |
| Telegram | ⭐⭐⭐ | 否 | Bot API | 最简单 |
| WhatsApp | ⭐⭐⭐⭐⭐ | 是 | 官方 | 非常困难 |
| Line | ⭐⭐⭐⭐ | 否 | 官方 | 需要日本市场 |

**推荐方案：仅实现 Telegram**
- 无需企业资质
- 实现最简单
- 适合国际用户

**Telegram 实现步骤**:
```bash
npm install node-telegram-bot-api
```

1. 创建 Telegram Bot
2. 实现 OAuth 流程
3. 绑定到现有账户或创建新账户

#### 6. 推荐奖励系统 💰
**优先级**: 🟢 低
**实现难度**: ⭐⭐⭐⭐ (较高)
**预计时间**: 8-10小时

**数据库设计**:
```sql
CREATE TABLE referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INT REFERENCES users(id),
  referred_id INT REFERENCES users(id),
  reward_amount NUMERIC(10,2),
  status VARCHAR(20), -- 'pending' | 'completed'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE referral_config (
  id SERIAL PRIMARY KEY,
  referrer_reward NUMERIC(10,2), -- 推荐人奖励
  referred_reward NUMERIC(10,2), -- 被推荐人奖励
  min_recharge NUMERIC(10,2), -- 最低充值触发
  updated_at TIMESTAMP
);
```

**功能**:
- 生成专属推荐码
- 推荐链接分享
- 新用户通过链接注册
- 满足条件后发放奖励
- 推荐统计和排行榜

#### 7. 会员等级系统 ⭐
**优先级**: 🟢 低
**实现难度**: ⭐⭐⭐⭐ (较高)
**预计时间**: 6-8小时

**等级设计**:
```javascript
const levels = [
  { level: 1, name: '青铜会员', minSpend: 0, discount: 0, color: '#CD7F32' },
  { level: 2, name: '白银会员', minSpend: 100, discount: 0.05, color: '#C0C0C0' },
  { level: 3, name: '黄金会员', minSpend: 500, discount: 0.10, color: '#FFD700' },
  { level: 4, name: '铂金会员', minSpend: 1000, discount: 0.15, color: '#E5E4E2' },
  { level: 5, name: '钻石会员', minSpend: 5000, discount: 0.20, color: '#B9F2FF' }
];
```

**功能**:
- 根据累计消费自动升级
- 不同等级享受折扣
- 等级徽章显示
- 等级权益说明
- 升级通知

---

## 📊 实现优先级总结

### 🔴 立即实现（1-2天）
1. ✅ 图形验证码 (2-3小时)
2. ✅ 忘记密码 (3-4小时)

### 🟡 短期实现（1周内）
3. 用户头像上传 (2-3小时)
4. 修改密码优化 ✅ (已完成)

### 🟢 中期实现（2-4周）
5. 优惠券系统 (6-8小时)
6. 推荐奖励系统 (8-10小时)
7. 会员等级系统 (6-8小时)

### 🔵 长期实现（1-3月）
8. 第三方登录 (10-20小时)
   - 优先 Telegram
   - 其次 QQ
   - 最后 微信/WhatsApp

---

## 💡 实施建议

### 阶段1: MVP增强（本周）
```
✅ 图形验证码
✅ 忘记密码
✅ 头像上传
```
**目标**: 提升安全性和用户体验

### 阶段2: 运营功能（下周）
```
- 优惠券系统
- 推荐奖励
```
**目标**: 提升用户活跃度和拉新

### 阶段3: 高级功能（下月）
```
- 会员等级
- 第三方登录 (Telegram)
```
**目标**: 提升用户留存和品牌形象

---

## 🔧 技术栈建议

### 新增依赖包
```json
{
  "svg-captcha": "^1.4.0",      // 图形验证码
  "sharp": "^0.33.0",           // 图片处理
  "qrcode": "^1.5.3",           // 二维码生成
  "node-telegram-bot-api": "^0.64.0"  // Telegram Bot
}
```

### 前端库
```html
<!-- 头像裁剪 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js"></script>

<!-- 二维码显示 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script>
```

---

## ⚠️ 重要提示

### 关于第三方登录
**不建议现在实现**，原因：
1. 需要企业资质（微信、WhatsApp）
2. 需要域名和 HTTPS（所有平台）
3. 需要通过审核（1-2周）
4. 开发成本高，维护复杂
5. 当前MVP阶段价值有限

**建议**:
- 先完善核心功能
- 等用户量上来再考虑
- 优先实现 Telegram（最简单）

### 关于优惠券和推荐
这两个功能虽然不复杂，但需要：
1. 完善的运营策略
2. 防刷机制
3. 财务对账
4. 客服支持

建议在有专门运营人员后再实现。

---

## 📝 快速实现清单

如果只有 **1天时间**，实现：
- [x] 修改密码
- [ ] 图形验证码
- [ ] 忘记密码

如果有 **3天时间**，额外实现：
- [ ] 头像上传
- [ ] 简单的优惠码（固定面额）

如果有 **1周时间**，额外实现：
- [ ] 完整优惠券系统
- [ ] 推荐奖励（基础版）

---

## 🚀 下一步行动

**建议顺序**:

1. **先测试当前修复** (10分钟)
   - 测试 PROCESSING_COST 修复
   - 测试注册错误提示
   - 测试密码修改功能

2. **实现图形验证码** (2小时)
   - 最能防止恶意注册
   - 实现简单
   - 立即见效

3. **实现忘记密码** (3小时)
   - 用户刚需
   - 减少客服压力
   - 提升体验

4. **其他功能根据需要逐步实现**

需要我现在开始实现图形验证码和忘记密码功能吗？
