# 💳 IJPay 支付集成文档

## 📦 功能概述

已将会员中心的支付方式从模拟支付升级为 **IJPay** 集成，支持真实的在线支付。

**GitHub**: https://github.com/Javen205/IJPay

---

## ✅ 已实现的支付方式

### 1. 💚 微信支付 (WeChat Pay)
- ✅ 扫码支付 (NATIVE)
- ✅ H5支付 (JSAPI)
- ✅ 订单查询
- ✅ 支付回调

### 2. 💙 支付宝 (Alipay)
- ✅ 页面支付 (Page Pay)
- ✅ 扫码支付
- ✅ 支付回调
- ✅ RSA2签名验证

### 3. 🏦 云闪付 (UnionPay)
- ✅ 通过YunGouOS集成
- ✅ 扫码支付
- ✅ 支付回调

### 4. 🎭 演示模式 (Mock Mode)
- ✅ 未配置真实支付时自动启用
- ✅ 显示测试二维码
- ✅ 一键模拟支付成功

---

## 🏗️ 架构设计

### 文件结构

```
/workspace
├── services/
│   └── ijpay.js                # IJPay核心服务
├── routes/
│   └── payment-routes.js       # 支付API路由
├── public/
│   ├── profile.html            # 会员中心页面（含支付UI）
│   └── payment-ijpay.js        # 前端支付逻辑
├── scripts/
│   └── init-db.js              # 数据库初始化（添加支付字段）
└── .env.example                # 配置示例
```

---

## 🔌 后端实现

### 1. IJPay服务 (`services/ijpay.js`)

**功能模块**:

```javascript
class IJPayService {
  // WeChat Pay
  - createWechatOrder()      // 创建微信订单
  - queryWechatOrder()       // 查询订单状态
  - verifyWechatNotify()     // 验证回调签名
  
  // Alipay
  - createAlipayOrder()      // 创建支付宝订单
  - verifyAlipayNotify()     // 验证回调签名
  
  // YunGouOS (Personal Account Support)
  - createYunGouOSOrder()    // 创建聚合支付订单
  - verifyYunGouOSNotify()   // 验证回调签名
  
  // Helper Functions
  - generateNonceStr()       // 生成随机字符串
  - generateWechatSign()     // 微信签名
  - generateAlipaySign()     // 支付宝签名
  - buildXML()               // 构建XML请求
  - parseXML()               // 解析XML响应
}
```

---

### 2. 支付路由 (`routes/payment-routes.js`)

**API端点**:

```javascript
POST   /api/payment/create-order          // 创建支付订单
GET    /api/payment/query-order/:orderId  // 查询订单状态
POST   /api/payment/wechat/notify         // 微信支付回调
POST   /api/payment/alipay/notify         // 支付宝回调
POST   /api/payment/yungouos/notify       // YunGouOS回调
POST   /api/payment/mock-confirm/:orderId // 模拟支付确认(测试用)
```

---

### 3. 数据库扩展

**transactions表新增字段**:

```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS order_id VARCHAR(100);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_no VARCHAR(100);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
CREATE UNIQUE INDEX idx_transactions_order_id ON transactions(order_id);
```

**用途**:
- `order_id`: 内部订单号（唯一）
- `transaction_no`: 第三方支付平台交易号
- `completed_at`: 支付完成时间

---

## 🎨 前端实现

### 1. 支付UI更新 (`profile.html`)

**支付方式选择**（简化版）:

```html
<div class="payment-methods">
  <div class="payment-btn" onclick="selectPayment('wechat')">
    💚 微信支付
    扫码支付
  </div>
  <div class="payment-btn" onclick="selectPayment('alipay')">
    💙 支付宝
    扫码支付
  </div>
  <div class="payment-btn" onclick="selectPayment('unionpay')">
    🏦 云闪付
    银联支付
  </div>
</div>
```

**移除的支付方式**:
- ❌ Stripe
- ❌ PayPal
- ❌ Visa
- ❌ MasterCard

**保留的支付方式**（基于IJPay）:
- ✅ 微信支付
- ✅ 支付宝
- ✅ 云闪付

---

### 2. 支付二维码模态框

**新增Modal**:

```html
<div id="paymentModal">
  <h2>扫码支付</h2>
  
  <!-- QR Code Display -->
  <div id="qrCodeContainer">
    <img src="qr-code-url" />
  </div>
  
  <!-- Payment Info -->
  <div>
    金额: ¥50.00
    订单号: ORDER_1234567890_5
    请使用 微信 扫描二维码
  </div>
  
  <!-- Actions -->
  <button onclick="closePaymentModal()">取消支付</button>
  <button onclick="checkPaymentStatus()">刷新状态</button>
</div>
```

---

### 3. 支付流程脚本 (`payment-ijpay.js`)

**功能函数**:

```javascript
// 创建支付订单并显示二维码
createPaymentOrder()

// 显示支付模态框
showPaymentModal(paymentData)

// 关闭支付模态框
closePaymentModal()

// 开始轮询支付状态
startPaymentStatusCheck()

// 检查支付状态
checkPaymentStatus()

// 模拟支付成功（仅测试模式）
mockConfirmPayment()
```

---

## 💰 支付流程

### 完整流程图

```
用户选择套餐
  ↓
选择支付方式（微信/支付宝/云闪付）
  ↓
点击"立即充值"
  ↓
调用 POST /api/payment/create-order
  ↓
后端判断配置:
  ├─ 有真实配置 → 调用IJPay API
  │   ├─ 微信支付 → createWechatOrder()
  │   ├─ 支付宝 → createAlipayOrder()
  │   └─ 云闪付 → createYunGouOSOrder()
  │
  └─ 无配置 → 演示模式
      └─ createMockOrder()
  ↓
返回支付数据:
  {
    qrCode: "二维码URL",
    orderId: "ORDER_xxx",
    mockMode: true/false
  }
  ↓
前端显示二维码模态框
  ↓
用户扫码支付
  ↓
每3秒轮询: GET /api/payment/query-order/:orderId
  ↓
支付平台回调: POST /api/payment/{wechat|alipay}/notify
  ├─ 验证签名
  ├─ 更新订单状态 (pending → completed)
  ├─ 增加用户余额
  └─ 返回success
  ↓
轮询检测到 paid=true
  ↓
显示支付成功 ✅
  ↓
2秒后关闭模态框并刷新余额
```

---

### 微信支付流程

```
1. 前端调用 createPaymentOrder()
   POST /api/payment/create-order
   { planId: 1, paymentMethod: 'wechat' }

2. 后端调用微信统一下单API
   POST https://api.mch.weixin.qq.com/pay/unifiedorder
   {
     appid: "wx1234...",
     mch_id: "1234567890",
     out_trade_no: "ORDER_xxx",
     total_fee: 5000,  // 50.00元 = 5000分
     trade_type: "NATIVE"
   }

3. 微信返回二维码
   {
     code_url: "weixin://wxpay/bizpayurl?pr=xxx"
   }

4. 前端显示二维码
   <img src="https://api.qrserver.com/v1/create-qr-code/?data=weixin://..." />

5. 用户扫码支付

6. 微信回调通知
   POST http://your-domain.com/api/payment/wechat/notify
   <xml>
     <result_code>SUCCESS</result_code>
     <out_trade_no>ORDER_xxx</out_trade_no>
   </xml>

7. 后端处理回调
   - 验证签名 ✓
   - 更新订单状态 ✓
   - 增加用户余额 ✓

8. 前端轮询检测到支付成功
   显示 ✅ 支付成功！
```

---

### 支付宝流程

```
1. 创建订单
   POST /api/payment/create-order
   { paymentMethod: 'alipay' }

2. 后端生成支付URL
   https://openapi.alipay.com/gateway.do?
     app_id=xxx&
     method=alipay.trade.page.pay&
     biz_content={...}&
     sign=xxx

3. 前端跳转到支付宝页面
   window.open(paymentUrl)

4. 用户在支付宝页面完成支付

5. 支付宝回调
   POST /api/payment/alipay/notify
   { trade_status: "TRADE_SUCCESS" }

6. 后端更新订单和余额

7. 前端轮询检测成功
```

---

## 🔐 配置说明

### 微信支付配置

**获取方式**:
1. 注册微信商户平台：https://pay.weixin.qq.com
2. 需要营业执照（企业账户）
3. 获取以下信息：

```env
WECHAT_APP_ID=wx1234567890abcdef     # 公众号AppID
WECHAT_MCH_ID=1234567890             # 商户号
WECHAT_API_KEY=32位密钥               # API密钥（在商户后台设置）
WECHAT_API_V3_KEY=32位V3密钥          # API V3密钥
WECHAT_CERT_PATH=./certs/cert.p12    # 商户证书路径
```

**申请要求**:
- 企业/个体工商户
- 营业执照
- 对公账户（企业）或法人银行卡（个体）

---

### 支付宝配置

**获取方式**:
1. 注册支付宝开放平台：https://open.alipay.com
2. 创建应用
3. 配置RSA2密钥

```env
ALIPAY_APP_ID=2021001234567890
ALIPAY_PRIVATE_KEY=MIIEvQIBADANBgkqhkiG...（您的私钥）
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0B...（支付宝公钥）
```

**密钥生成**:
```bash
# 使用支付宝密钥生成工具
# 下载地址: https://opendocs.alipay.com/common/02kipl

# 或使用OpenSSL
openssl genrsa -out app_private_key.pem 2048
openssl rsa -in app_private_key.pem -pubout -out app_public_key.pem
```

---

### YunGouOS配置（个人账户推荐）⭐

**特点**:
- ✅ 支持个人账户
- ✅ 无需营业执照
- ✅ 集成微信/支付宝/银联
- ✅ 费率较低

**获取方式**:
1. 注册YunGouOS：https://www.yungouos.com
2. 完成实名认证
3. 获取商户号和API密钥

```env
YUNGOUOS_ENABLED=true
YUNGOUOS_MCH_ID=your_merchant_id
YUNGOUOS_API_KEY=your_api_key
```

**优势**:
```
个人开发者 → 无法申请微信/支付宝企业账户
  ↓
使用 YunGouOS
  ↓
提供个人收款码
  ↓
用户扫码支付 → YunGouOS回调 → 系统确认
```

---

## 🎯 配置模式

### 模式1: 演示模式（默认）

**条件**: 未配置任何真实支付

```env
# 所有支付配置为空
WECHAT_APP_ID=
ALIPAY_APP_ID=
YUNGOUOS_ENABLED=false
```

**行为**:
- ✅ 显示模拟二维码
- ✅ "模拟支付成功"按钮
- ✅ 点击即可完成充值
- ⚠️ 仅用于测试，不实际扣款

---

### 模式2: YunGouOS模式（个人推荐）

**条件**: 启用YunGouOS

```env
YUNGOUOS_ENABLED=true
YUNGOUOS_MCH_ID=1234567890
YUNGOUOS_API_KEY=your_api_key
BASE_URL=https://your-domain.com
```

**行为**:
- ✅ 真实扫码支付
- ✅ 支持微信/支付宝/云闪付
- ✅ 自动回调确认
- ✅ 适合个人开发者

---

### 模式3: 直连模式（企业推荐）

**条件**: 配置官方支付

```env
# 微信支付
WECHAT_APP_ID=wx1234567890abcdef
WECHAT_MCH_ID=1234567890
WECHAT_API_KEY=your_32_char_api_key
WECHAT_NOTIFY_URL=https://your-domain.com/api/payment/wechat/notify

# 支付宝
ALIPAY_APP_ID=2021001234567890
ALIPAY_PRIVATE_KEY=MIIEvQ...
ALIPAY_PUBLIC_KEY=MIIBIj...
ALIPAY_NOTIFY_URL=https://your-domain.com/api/payment/alipay/notify
```

**行为**:
- ✅ 直接对接官方API
- ✅ 费率最低（0.6%）
- ✅ 资金直达
- ⚠️ 需要企业资质

---

## 🔄 支付流程详解

### 创建订单

**请求**:
```javascript
POST /api/payment/create-order
Authorization: Bearer {token}

{
  "planId": 2,              // 套餐ID
  "paymentMethod": "wechat" // 支付方式
}
```

**响应（真实支付）**:
```json
{
  "success": true,
  "paymentType": "wechat",
  "qrCode": "weixin://wxpay/bizpayurl?pr=xxx",
  "orderId": "ORDER_1704067200000_5",
  "mockMode": false
}
```

**响应（演示模式）**:
```json
{
  "success": true,
  "paymentType": "wechat",
  "qrCode": "https://api.qrserver.com/v1/create-qr-code/?data=MOCK_xxx",
  "orderId": "ORDER_1704067200000_5",
  "mockMode": true
}
```

---

### 查询订单状态

**请求**:
```javascript
GET /api/payment/query-order/ORDER_1704067200000_5
Authorization: Bearer {token}
```

**响应（未支付）**:
```json
{
  "success": true,
  "paid": false,
  "status": "pending"
}
```

**响应（已支付）**:
```json
{
  "success": true,
  "paid": true,
  "status": "completed"
}
```

---

### 支付回调

**微信回调**:
```xml
POST /api/payment/wechat/notify

<xml>
  <return_code>SUCCESS</return_code>
  <result_code>SUCCESS</result_code>
  <out_trade_no>ORDER_xxx</out_trade_no>
  <transaction_id>4200001234567890</transaction_id>
  <total_fee>5000</total_fee>
  <sign>xxx</sign>
</xml>
```

**处理逻辑**:
```javascript
1. 验证签名 (verifyWechatNotify)
2. 查找订单 (SELECT * FROM transactions WHERE order_id = ?)
3. 更新订单状态 (UPDATE transactions SET status = 'completed')
4. 增加用户余额 (UPDATE users SET balance = balance + amount)
5. 更新累计消费 (UPDATE users SET total_spending = total_spending + amount)
6. 返回SUCCESS响应
```

---

## 🎨 UI/UX更新

### 支付方式卡片

**修改前（6个）**:
```
[支付宝] [微信支付] [Stripe]
[PayPal] [Visa] [MasterCard]
```

**修改后（3个）**:
```
[💚 微信支付]  [💙 支付宝]  [🏦 云闪付]
  扫码支付       扫码支付      银联支付
```

**改进**:
- ✅ 更大的图标（32px）
- ✅ 更清晰的标签
- ✅ 显示支付方式说明
- ✅ 只保留实际支持的方式

---

### 支付二维码界面

```
┌─────────────────────────────────┐
│           扫码支付               │
├─────────────────────────────────┤
│                                 │
│       ┌───────────────┐         │
│       │               │         │
│       │   QR CODE     │         │
│       │               │         │
│       └───────────────┘         │
│                                 │
│          ¥50.00                 │
│          月度套餐                │
│                                 │
│   订单号：ORDER_1234567890_5    │
│   请使用 微信 扫描二维码         │
│                                 │
│  [❌ 取消支付] [🔄 刷新状态]    │
└─────────────────────────────────┘
```

**演示模式附加显示**:
```
┌─────────────────────┐
│ 🎭 演示模式          │
│ 未配置真实支付       │
│ [✅ 模拟支付成功]   │
└─────────────────────┘
```

---

## 🧪 测试指南

### 测试1: 演示模式（无配置）

```bash
1. 不配置任何支付参数
2. 启动服务器
3. 登录会员中心
4. 选择套餐 + 选择支付方式
5. 点击"立即充值"

✅ 预期:
   - 显示模拟二维码
   - 显示"🎭 演示模式"提示
   - 点击"✅ 模拟支付成功"
   - 余额立即增加
   - 无需真实支付
```

---

### 测试2: YunGouOS模式

```bash
1. 配置.env:
   YUNGOUOS_ENABLED=true
   YUNGOUOS_MCH_ID=你的商户号
   YUNGOUOS_API_KEY=你的密钥
   BASE_URL=https://your-domain.com

2. 重启服务器
3. 选择套餐 + 微信支付
4. 点击"立即充值"

✅ 预期:
   - 显示真实支付二维码
   - 用微信扫码支付
   - 支付成功后自动回调
   - 3秒内检测到支付成功
   - 余额自动增加
```

---

### 测试3: 微信直连模式

```bash
1. 配置微信商户参数
2. 选择套餐 + 微信支付
3. 显示微信支付二维码
4. 用微信扫码
5. 自动回调确认
```

---

## 📊 数据库变更

### 新增字段

```sql
-- transactions表
order_id VARCHAR(100) UNIQUE          -- 订单号
transaction_no VARCHAR(100)           -- 第三方交易号
completed_at TIMESTAMP                -- 完成时间

-- payment_method字段已存在
payment_method VARCHAR(50)            -- 支付方式
```

### 订单状态

```
pending     - 待支付
completed   - 已完成
failed      - 失败
cancelled   - 已取消
```

---

## 🔒 安全措施

### 1. 签名验证

**微信支付**:
```javascript
// 验证回调签名
const sign = params.sign;
const calculatedSign = generateWechatSign(params);
if (sign !== calculatedSign) {
  return 'FAIL';  // 拒绝处理
}
```

**支付宝**:
```javascript
// RSA2签名验证
const verify = crypto.createVerify('RSA-SHA256');
verify.update(sortedParams);
if (!verify.verify(alipayPublicKey, sign, 'base64')) {
  return 'fail';  // 拒绝处理
}
```

---

### 2. 防重复回调

```javascript
// 更新时检查状态
UPDATE transactions 
SET status = 'completed' 
WHERE order_id = $1 AND status = 'pending'  -- 只更新pending状态
RETURNING *
```

**效果**: 同一订单多次回调只处理一次

---

### 3. 金额验证

```javascript
// 验证支付金额
const dbAmount = transaction.amount;
const paidAmount = params.total_fee / 100;  // 微信单位是分

if (Math.abs(dbAmount - paidAmount) > 0.01) {
  throw new Error('金额不匹配');
}
```

---

## 📱 前端交互

### 轮询机制

```javascript
// 每3秒检查一次支付状态
setInterval(() => {
  checkPaymentStatus();
}, 3000);

// 检测到支付成功
if (result.paid) {
  clearInterval();  // 停止轮询
  showSuccess();    // 显示成功
  closeModal();     // 关闭模态框
  refreshBalance(); // 刷新余额
}
```

---

### 用户反馈

**创建订单中**:
```
[💰 立即充值] → [⏳ 创建订单中...]
```

**显示二维码**:
```
[二维码图片]
请使用 微信 扫描二维码
```

**支付成功**:
```
✅ 支付成功！
余额已更新，页面即将刷新...
(2秒后自动关闭)
```

---

## 🛠️ 部署checklist

### 开发环境（演示模式）

```bash
# 1. 不配置任何支付参数
# 2. 直接启动
npm start

# 3. 测试充值功能
# 使用模拟支付即可
```

---

### 生产环境（真实支付）

#### 方案A: YunGouOS（个人推荐）

```bash
# 1. 注册YunGouOS账户
https://www.yungouos.com

# 2. 获取商户号和密钥

# 3. 配置.env
YUNGOUOS_ENABLED=true
YUNGOUOS_MCH_ID=你的商户号
YUNGOUOS_API_KEY=你的密钥
BASE_URL=https://your-domain.com

# 4. 确保服务器可被外网访问（用于回调）

# 5. 重启服务
npm start
```

---

#### 方案B: 微信/支付宝直连（企业推荐）

```bash
# 1. 申请微信商户号
https://pay.weixin.qq.com

# 2. 配置微信参数
WECHAT_APP_ID=wx...
WECHAT_MCH_ID=123...
WECHAT_API_KEY=32位密钥
WECHAT_NOTIFY_URL=https://your-domain.com/api/payment/wechat/notify

# 3. 配置支付宝
ALIPAY_APP_ID=202100...
ALIPAY_PRIVATE_KEY=MII...
ALIPAY_PUBLIC_KEY=MII...

# 4. 确保HTTPS (支付宝要求)

# 5. 配置回调白名单

# 6. 重启服务
```

---

## 🎊 功能对比

### 修改前（模拟支付）

```
优点:
✅ 无需配置
✅ 开发测试方便

缺点:
❌ 无真实支付
❌ 任何人都能充值
❌ 无法商用
```

### 修改后（IJPay集成）

```
优点:
✅ 支持真实支付
✅ 微信/支付宝/云闪付
✅ 可商业化运营
✅ 支持个人账户（YunGouOS）
✅ 保留演示模式（测试用）
✅ 自动回调确认
✅ 订单状态追踪

功能:
✅ 扫码支付
✅ 订单查询
✅ 支付回调
✅ 签名验证
✅ 金额验证
✅ 状态轮询
✅ 自动到账
```

---

## 📖 API文档

### POST /api/payment/create-order

创建支付订单

**Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body**:
```json
{
  "planId": 2,
  "paymentMethod": "wechat"
}
```

**Response**:
```json
{
  "success": true,
  "paymentType": "wechat",
  "qrCode": "weixin://wxpay/bizpayurl?pr=xxx",
  "orderId": "ORDER_1704067200000_5",
  "mockMode": false
}
```

---

### GET /api/payment/query-order/:orderId

查询订单支付状态

**Headers**:
```
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "paid": true,
  "status": "completed"
}
```

---

### POST /api/payment/mock-confirm/:orderId

模拟支付成功（仅演示模式）

**Response**:
```json
{
  "success": true,
  "message": "充值成功",
  "newBalance": 150.50
}
```

---

## 🎯 总结

### 实现内容

```
✅ IJPay核心服务 (services/ijpay.js)
✅ 支付API路由 (routes/payment-routes.js)
✅ 前端支付逻辑 (public/payment-ijpay.js)
✅ 支付UI更新 (public/profile.html)
✅ 数据库扩展 (scripts/init-db.js)
✅ 配置文件更新 (.env.example)
✅ 完整文档 (本文档)
```

### 支持的支付方式

```
💚 微信支付  - 扫码/H5
💙 支付宝    - 页面/扫码
🏦 云闪付    - 通过YunGouOS
🎭 演示模式  - 无需配置
```

### 代码统计

```
新增文件:
- services/ijpay.js        (400+ 行)
- routes/payment-routes.js (300+ 行)
- public/payment-ijpay.js  (220+ 行)

修改文件:
- scripts/init-db.js       (+10 行)
- public/profile.html      (+35 行)
- .env.example             (+30 行)

总计: ~1000 行代码
```

---

## 🚀 快速开始

### 开发测试（演示模式）

```bash
# 1. 无需配置，直接启动
npm start

# 2. 访问会员中心
http://localhost:8051/public/profile.html

# 3. 选择套餐 + 支付方式
# 4. 点击"模拟支付成功"
# 5. ✅ 余额立即到账
```

---

### 生产部署（真实支付）

```bash
# 推荐：使用YunGouOS（个人也可用）
1. 注册 https://www.yungouos.com
2. 获取商户号和密钥
3. 配置.env
4. 部署到有公网IP的服务器
5. 配置回调地址
6. ✅ 开始收款
```

---

**🎉 IJPay支付系统集成完成！** 🚀💳✨
