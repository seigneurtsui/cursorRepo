# 💳 IJPay 支付集成文档

## 📋 概述

本项目已集成 IJPay 支付系统，支持以下支付方式：
- 💚 **微信支付** (WeChat Pay)
- 💙 **支付宝** (Alipay)  
- 🔷 **银联云闪付** (UnionPay)

同时支持**YunGouOS**第三方聚合平台（个人账户可用）。

---

## 🎯 功能特点

### 1. 多支付渠道
- ✅ 微信支付（扫码支付）
- ✅ 支付宝（扫码支付）
- ✅ 银联云闪付
- ✅ YunGouOS聚合（个人账户）

### 2. 安全可靠
- ✅ RSA2签名验证
- ✅ 回调通知验证
- ✅ 订单状态追踪
- ✅ 重复支付防护

### 3. 用户体验
- ✅ 扫码支付（二维码）
- ✅ 实时状态检查
- ✅ 自动到账
- ✅ 交易记录

### 4. 演示模式
- ✅ 无需配置即可测试
- ✅ 模拟支付流程
- ✅ 完整功能体验

---

## 🏗️ 架构设计

```
用户充值流程:
  ↓
前端: 选择套餐 + 支付方式
  ↓
POST /api/payment/create-order
  ↓
IJPay Service: 创建支付订单
  ↓
返回: QR Code + Order ID
  ↓
前端: 显示二维码弹窗
  ↓
用户: 扫码支付
  ↓
支付平台: 回调通知
  ↓
POST /api/payment/{platform}/notify
  ↓
验证签名 → 更新订单 → 增加余额
  ↓
前端: 轮询查询状态
  ↓
GET /api/payment/query-order/:orderId
  ↓
返回: paid=true
  ↓
前端: 显示成功 → 刷新余额
```

---

## 📁 文件结构

### 新增文件

```
services/ijpay.js           - IJPay核心服务
routes/payment-routes.js    - 支付API路由
```

### 修改文件

```
server.js                   - 集成payment routes
scripts/init-db.js          - 添加订单字段
public/profile.html         - 支付UI更新
.env.example                - IJPay配置模板
```

---

## 🔧 配置指南

### 方案A: 企业账户（真实支付）

#### 1. 微信支付配置

**申请流程**:
1. 注册微信商户平台：https://pay.weixin.qq.com
2. 完成企业认证
3. 获取配置信息

**环境变量**:
```bash
WECHAT_APP_ID=wx1234567890abcdef        # 公众号AppID
WECHAT_MCH_ID=1234567890                # 商户号
WECHAT_API_KEY=32位API密钥              # API密钥
WECHAT_API_V3_KEY=32位APIv3密钥         # APIv3密钥
WECHAT_CERT_PATH=/path/to/apiclient_cert.p12
WECHAT_NOTIFY_URL=https://yourdomain.com/api/payment/wechat/notify
```

**获取方式**:
- AppID: 公众号管理后台 → 开发 → 基本配置
- MchID: 商户平台 → 账户中心 → 商户信息
- API密钥: 商户平台 → 账户中心 → API安全 → 设置密钥
- 证书: 商户平台 → 账户中心 → API安全 → 下载证书

---

#### 2. 支付宝配置

**申请流程**:
1. 注册支付宝开放平台：https://open.alipay.com
2. 创建网页/移动应用
3. 配置RSA2密钥

**环境变量**:
```bash
ALIPAY_APP_ID=2021001234567890           # 应用AppID
ALIPAY_PRIVATE_KEY=MIIEvQIBA...          # RSA2私钥(Base64)
ALIPAY_PUBLIC_KEY=MIIBIjANB...           # 支付宝公钥(Base64)
ALIPAY_GATEWAY_URL=https://openapi.alipay.com/gateway.do
ALIPAY_NOTIFY_URL=https://yourdomain.com/api/payment/alipay/notify
```

**生成密钥**:
```bash
# 使用支付宝密钥生成工具
# 下载地址: https://opendocs.alipay.com/common/02kipl

# 选择密钥格式: PKCS1
# 选择密钥长度: 2048
# 生成后会得到:
#   - 应用私钥 (app_private_key.txt)
#   - 应用公钥 (app_public_key.txt)

# 上传应用公钥到支付宝开放平台
# 获取支付宝公钥并保存
```

---

#### 3. 银联配置

**申请流程**:
1. 注册银联开放平台：https://open.unionpay.com
2. 创建商户应用
3. 获取商户号和密钥

**环境变量**:
```bash
UNIONPAY_MCH_ID=123456789012345          # 商户号
UNIONPAY_API_KEY=your_unionpay_key       # API密钥
UNIONPAY_GATEWAY_URL=https://gateway.95516.com
UNIONPAY_NOTIFY_URL=https://yourdomain.com/api/payment/unionpay/notify
```

---

### 方案B: YunGouOS（个人账户）⭐ 推荐

**适用场景**:
- 个人开发者
- 小型项目
- 快速上线
- 无需企业资质

**申请流程**:
1. 访问：https://www.yungouos.com
2. 注册账号（个人即可）
3. 实名认证
4. 获取商户号和密钥

**环境变量**:
```bash
YUNGOUOS_ENABLED=true                    # 启用YunGouOS
YUNGOUOS_MCH_ID=your_merchant_id         # 商户号
YUNGOUOS_API_KEY=your_api_key            # API密钥
BASE_URL=https://yourdomain.com          # 你的域名
```

**优势**:
- ✅ 个人账户可用
- ✅ 快速审核（1-3天）
- ✅ 支持微信/支付宝/银联
- ✅ 手续费低（0.38%-0.6%）
- ✅ T+1到账

**费率**:
- 微信支付: 0.38%
- 支付宝: 0.38%
- 银联: 0.6%

---

### 方案C: 演示模式（默认）

**无需配置，开箱即用**:
```bash
# 不设置任何支付配置
# 系统自动进入演示模式
```

**特点**:
- ✅ 显示模拟二维码
- ✅ 完整支付流程
- ✅ 手动确认支付
- ✅ 功能完全可测试

**限制**:
- ❌ 无法真实收款
- ⚠️ 仅用于开发测试

---

## 💻 代码实现

### 后端服务 (services/ijpay.js)

**核心类**:
```javascript
class IJPayService {
  // WeChat Pay
  async createWechatOrder(orderId, amount, description)
  async queryWechatOrder(orderId)
  verifyWechatNotify(params)
  
  // Alipay
  async createAlipayOrder(orderId, amount, description)
  verifyAlipayNotify(params)
  
  // YunGouOS
  async createYunGouOSOrder(orderId, amount, description, payType)
  verifyYunGouOSNotify(params)
  
  // Mock Mode
  async createMockOrder(orderId, amount, description, paymentMethod)
  
  // Helpers
  generateNonceStr()
  generateWechatSign(params)
  generateAlipaySign(params)
  generateYunGouOSSign(params)
}
```

---

### API路由 (routes/payment-routes.js)

```javascript
// Create payment order
POST /api/payment/create-order
Body: { planId, paymentMethod }
Response: { success, orderId, qrCode, paymentType, mockMode }

// Query order status
GET /api/payment/query-order/:orderId
Response: { success, paid, status }

// Mock confirm (testing only)
POST /api/payment/mock-confirm/:orderId
Response: { success, newBalance }

// Payment callbacks
POST /api/payment/wechat/notify
POST /api/payment/alipay/notify
POST /api/payment/yungouos/notify
```

---

### 前端UI (public/profile.html)

**支付方式选择**:
```html
<div class="payment-methods">
  <div class="payment-btn" onclick="selectPayment('wechat')">
    💚 微信支付 (扫码支付)
  </div>
  <div class="payment-btn" onclick="selectPayment('alipay')">
    💙 支付宝 (扫码支付)
  </div>
</div>
```

**支付弹窗**:
```html
<div id="paymentModal">
  <h2>💚 微信扫码支付</h2>
  <img id="qrCodeImage" src="...">  <!-- 二维码 -->
  <div>订单金额: ¥50.00</div>
  <div>订单号: ORDER_1234567890_1</div>
  <div>⏳ 等待支付中...</div>
  <button onclick="checkPaymentStatus()">🔄 检查支付状态</button>
  <button onclick="closePaymentModal()">❌ 取消支付</button>
  
  <!-- 演示模式专用 -->
  <div id="mockPaymentSection">
    <button onclick="mockConfirmPayment()">
      ✅ 模拟支付成功（测试用）
    </button>
  </div>
</div>
```

**JavaScript函数**:
```javascript
// Create payment order
async function recharge()

// Show payment modal
function showPaymentModal(paymentData, amount)

// Close modal
function closePaymentModal()

// Auto-check payment status (every 3s)
function startPaymentStatusCheck()
async function checkPaymentStatus()

// Mock payment confirm (demo mode)
async function mockConfirmPayment()
```

---

## 🔄 支付流程

### 微信支付流程

```
1. 用户选择"微信支付"
   ↓
2. 点击"立即充值"
   ↓
3. 调用 POST /api/payment/create-order
   ↓
4. IJPay创建订单:
   - 生成订单号: ORDER_{timestamp}_{userId}
   - 调用微信统一下单API
   - 获取二维码链接
   ↓
5. 返回前端:
   {
     success: true,
     orderId: "ORDER_1234567890_1",
     qrCode: "weixin://wxpay/bizpayurl?pr=abc123",
     paymentType: "wechat"
   }
   ↓
6. 显示支付弹窗:
   - 显示二维码
   - 显示订单金额
   - 开始轮询状态(每3秒)
   ↓
7. 用户扫码支付
   ↓
8. 微信回调通知:
   POST /api/payment/wechat/notify
   - 验证签名
   - 更新订单状态
   - 增加用户余额
   - 创建交易记录
   ↓
9. 前端轮询检测到支付成功:
   GET /api/payment/query-order/{orderId}
   → { paid: true }
   ↓
10. 显示成功提示
    → 关闭弹窗
    → 刷新余额
    → 更新交易记录
```

### 支付宝流程

```
流程与微信类似，区别:
- 使用支付宝API
- RSA2签名
- 不同的二维码格式
- 不同的回调验证
```

---

## 🗄️ 数据库设计

### transactions表新增字段

```sql
ALTER TABLE transactions ADD COLUMN:
- order_id VARCHAR(100) UNIQUE     -- 订单号
- transaction_no VARCHAR(100)      -- 第三方交易号
- completed_at TIMESTAMP           -- 完成时间

CREATE INDEX idx_transactions_order_id ON transactions(order_id);
```

### 订单号格式

```
ORDER_{timestamp}_{userId}

示例:
ORDER_1735833600000_5
ORDER_1735834200000_10
```

---

## 🧪 测试指南

### 测试1: 演示模式测试（无需配置）

```bash
1. 不设置任何支付环境变量
2. 启动服务器: npm start
3. 登录会员中心
4. 选择套餐和支付方式
5. 点击"立即充值"

预期结果:
✅ 弹出支付窗口
✅ 显示模拟二维码
✅ 显示"⚠️ 演示模式"提示
✅ 显示"✅ 模拟支付成功"按钮
✅ 点击按钮后余额增加
```

---

### 测试2: YunGouOS真实支付

**配置**:
```bash
# .env
YUNGOUOS_ENABLED=true
YUNGOUOS_MCH_ID=your_merchant_id
YUNGOUOS_API_KEY=your_api_key
BASE_URL=https://yourdomain.com
```

**测试步骤**:
```bash
1. 登录会员中心
2. 选择"月度套餐 ¥50"
3. 选择"微信支付"
4. 点击"立即充值"

预期结果:
✅ 弹出支付窗口
✅ 显示真实二维码
✅ 提示"✓ 真实支付渠道已接入"
✅ 使用微信扫码
✅ 支付后3秒内自动到账
✅ 弹窗显示"✅ 支付成功！"
✅ 余额自动刷新
```

---

### 测试3: 回调通知测试

**使用ngrok暴露本地服务**:
```bash
# 安装ngrok
npm install -g ngrok

# 暴露8051端口
ngrok http 8051

# 获得公网URL:
# https://abc123.ngrok.io

# 更新.env
BASE_URL=https://abc123.ngrok.io
WECHAT_NOTIFY_URL=https://abc123.ngrok.io/api/payment/wechat/notify
```

**测试回调**:
```bash
# 模拟微信回调
curl -X POST https://abc123.ngrok.io/api/payment/wechat/notify \
  -H "Content-Type: application/xml" \
  -d '<xml>
    <return_code><![CDATA[SUCCESS]]></return_code>
    <result_code><![CDATA[SUCCESS]]></result_code>
    <out_trade_no><![CDATA[ORDER_1234567890_1]]></out_trade_no>
    <transaction_id><![CDATA[wx123456789]]></transaction_id>
    <sign><![CDATA[valid_signature]]></sign>
  </xml>'

预期结果:
✅ 返回: <xml><return_code><![CDATA[SUCCESS]]></return_code>...
✅ 订单状态更新为completed
✅ 用户余额增加
✅ 交易记录创建
```

---

## 🔐 安全机制

### 1. 签名验证

**微信支付**:
```javascript
// 生成签名
const sortedParams = Object.keys(params)
  .sort()
  .map(key => `${key}=${params[key]}`)
  .join('&');

const stringSignTemp = `${sortedParams}&key=${API_KEY}`;
const sign = md5(stringSignTemp).toUpperCase();

// 验证签名
if (sign === receivedSign) {
  // Valid
}
```

**支付宝**:
```javascript
// RSA2签名
const sign = crypto.createSign('RSA-SHA256');
sign.update(sortedParams);
const signature = sign.sign(privateKey, 'base64');

// 验证
const verify = crypto.createVerify('RSA-SHA256');
verify.update(sortedParams);
const isValid = verify.verify(publicKey, receivedSign, 'base64');
```

---

### 2. 重复支付防护

```javascript
// 订单号唯一约束
CREATE UNIQUE INDEX idx_transactions_order_id 
ON transactions(order_id) 
WHERE order_id IS NOT NULL;

// 更新时检查状态
UPDATE transactions 
SET status = 'completed' 
WHERE order_id = $1 AND status = 'pending'  -- 只更新pending状态
```

---

### 3. 金额验证

```javascript
// 回调中验证金额
if (parseFloat(notifyAmount) !== parseFloat(orderAmount)) {
  throw new Error('金额不匹配');
}
```

---

## 📊 数据库schema

### transactions表完整结构

```sql
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type VARCHAR(50) NOT NULL,              -- 'recharge', 'usage', etc.
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',   -- 'pending', 'completed', 'failed'
  plan_id INTEGER REFERENCES payment_plans(id),
  description TEXT,
  payment_method VARCHAR(50),             -- 'wechat', 'alipay', etc.
  order_id VARCHAR(100) UNIQUE,           -- 订单号 (唯一)
  transaction_no VARCHAR(100),            -- 第三方交易号
  completed_at TIMESTAMP,                 -- 完成时间
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎨 UI设计

### 支付方式选择

```
┌─────────────────────────────────┐
│ 选择支付方式 (IJPay)             │
├─────────────────────────────────┤
│ ┌────────────┬────────────┐     │
│ │  💚 微信支付 │  💙 支付宝  │     │
│ │  扫码支付   │  扫码支付   │     │
│ └────────────┴────────────┘     │
│                                 │
│ [💰 立即充值]                   │
└─────────────────────────────────┘
```

### 支付弹窗

```
┌─────────────────────────────────┐
│ 💚 微信扫码支付            [×]  │
├─────────────────────────────────┤
│                                 │
│     ┌───────────────┐           │
│     │               │           │
│     │   QR CODE     │           │
│     │               │           │
│     └───────────────┘           │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 订单金额                    │ │
│ │ ¥50.00                     │ │
│ └─────────────────────────────┘ │
│                                 │
│ 请使用微信扫一扫完成支付         │
│ 订单号: ORDER_1234567890_1     │
│                                 │
│ ⏳ 等待支付中...                │
│                                 │
│ [🔄 检查状态] [❌ 取消支付]     │
│                                 │
│ ⚠️ 演示模式 (如果未配置)        │
│ [✅ 模拟支付成功（测试用）]     │
└─────────────────────────────────┘
```

---

## 📱 支付体验

### 用户操作流程

```
1. 进入会员中心
   ↓
2. 浏览充值套餐
   - 按次付费: ¥5
   - 月度套餐: ¥50 (推荐)
   - 年度套餐: ¥300 (优惠)
   ↓
3. 点击选择套餐
   ↓
4. 选择支付方式
   - 微信支付 💚
   - 支付宝 💙
   ↓
5. 点击"立即充值"
   ↓
6. 弹出扫码窗口
   - 显示二维码
   - 显示订单金额
   - 显示订单号
   ↓
7. 手机扫码
   - 打开微信/支付宝
   - 扫描二维码
   - 确认支付
   ↓
8. 自动到账
   - 3秒内检测到支付
   - 显示"✅ 支付成功！"
   - 自动关闭弹窗
   - 余额立即更新
   ↓
9. 完成！
```

---

## 🛠️ 部署指南

### 生产环境配置

**1. 配置环境变量**:
```bash
# 复制并编辑
cp .env.example .env

# 填写真实的支付配置
vim .env
```

**2. 确保HTTPS**:
```bash
# 支付回调必须使用HTTPS
# 使用nginx配置SSL证书

server {
  listen 443 ssl;
  server_name yourdomain.com;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location / {
    proxy_pass http://localhost:8051;
  }
}
```

**3. 配置回调URL**:
```bash
# 在各支付平台配置回调地址
微信: https://yourdomain.com/api/payment/wechat/notify
支付宝: https://yourdomain.com/api/payment/alipay/notify
YunGouOS: https://yourdomain.com/api/payment/yungouos/notify
```

**4. 测试回调**:
```bash
# 测试回调是否可访问
curl https://yourdomain.com/api/payment/wechat/notify
# 应返回: 405 Method Not Allowed (POST才允许)
```

---

## 📈 费率对比

| 平台 | 企业费率 | 个人费率(YunGouOS) | 到账时间 |
|------|----------|-------------------|---------|
| 微信支付 | 0.6% | 0.38% | T+1 |
| 支付宝 | 0.55% | 0.38% | T+1 |
| 银联 | 0.5% | 0.6% | T+1 |

**计算示例**:
```
用户充值: ¥100
手续费: ¥100 × 0.38% = ¥0.38
实际到账: ¥99.62

用户充值: ¥1000
手续费: ¥1000 × 0.38% = ¥3.80
实际到账: ¥996.20
```

---

## ⚠️ 注意事项

### 1. 回调域名白名单

**微信支付**:
- 登录商户平台
- 产品中心 → 开发配置
- 添加支付授权目录

**支付宝**:
- 登录开放平台
- 应用管理 → 应用信息
- 配置授权回调地址

---

### 2. 测试环境

**微信支付**:
```bash
# 沙箱环境
WECHAT_GATEWAY_URL=https://api.mch.weixin.qq.com/sandboxnew/pay/unifiedorder
```

**支付宝**:
```bash
# 沙箱环境
ALIPAY_GATEWAY_URL=https://openapi.alipaydev.com/gateway.do
```

---

### 3. 证书管理

**微信支付证书**:
```bash
# 下载证书
# 商户平台 → 账户中心 → API安全 → 申请证书

# 证书位置
WECHAT_CERT_PATH=/path/to/apiclient_cert.p12

# 确保Node.js有读取权限
chmod 644 /path/to/apiclient_cert.p12
```

---

## 🚀 快速开始

### 开发环境（演示模式）

```bash
# 1. 不设置支付配置
# 系统自动使用演示模式

# 2. 启动服务器
npm start

# 3. 访问会员中心
http://localhost:8051/public/profile.html

# 4. 测试充值流程
- 选择套餐
- 选择支付方式
- 点击充值
- 点击"模拟支付成功"
- ✅ 余额增加
```

---

### 生产环境（YunGouOS）

```bash
# 1. 注册YunGouOS
https://www.yungouos.com

# 2. 获取商户号和密钥

# 3. 配置.env
YUNGOUOS_ENABLED=true
YUNGOUOS_MCH_ID=123456
YUNGOUOS_API_KEY=abc123def456
BASE_URL=https://yourdomain.com

# 4. 重启服务器
npm start

# 5. 测试真实支付
- 选择套餐
- 选择支付方式
- 手机扫码支付
- 自动到账
```

---

## 📚 参考资料

### 官方文档

- **IJPay GitHub**: https://github.com/Javen205/IJPay
- **微信支付**: https://pay.weixin.qq.com/wiki/doc/api/
- **支付宝**: https://opendocs.alipay.com/
- **银联**: https://open.unionpay.com/
- **YunGouOS**: https://www.yungouos.com/doc

### 密钥工具

- **支付宝密钥生成器**: https://opendocs.alipay.com/common/02kipl
- **微信支付证书下载**: https://pay.weixin.qq.com → 账户中心 → API安全

---

## 🆘 常见问题

### Q1: 如何快速测试支付功能？

**A**: 使用演示模式（默认）
```bash
# 不配置任何支付参数
# 点击"模拟支付成功"按钮即可测试完整流程
```

---

### Q2: 个人开发者如何接入真实支付？

**A**: 使用YunGouOS
```bash
# 1. 注册: https://www.yungouos.com (支持个人)
# 2. 实名认证
# 3. 获取商户号
# 4. 配置到.env
# 5. 重启服务即可
```

---

### Q3: 回调通知收不到怎么办？

**A**: 检查以下项
```bash
✓ 域名是否可公网访问
✓ 是否使用HTTPS
✓ 回调URL是否在平台白名单
✓ 防火墙是否开放端口
✓ 使用ngrok测试
```

---

### Q4: 签名验证失败怎么办？

**A**: 检查配置
```bash
✓ API密钥是否正确
✓ 参数是否按字典序排序
✓ 是否包含空值参数
✓ 编码格式是否UTF-8
✓ 时间戳是否正确
```

---

## ✅ 集成完成清单

**数据库**:
- ✅ transactions表新增字段
- ✅ 订单号唯一索引
- ✅ 支付状态追踪

**后端**:
- ✅ IJPay服务类
- ✅ 支付路由
- ✅ 回调处理
- ✅ 签名验证
- ✅ 订单查询

**前端**:
- ✅ 支付方式选择
- ✅ 二维码弹窗
- ✅ 状态轮询
- ✅ 成功提示
- ✅ 错误处理

**配置**:
- ✅ 环境变量模板
- ✅ 多平台支持
- ✅ 演示模式
- ✅ 真实支付

---

## 🎊 总结

✅ **IJPay集成完成！**

**支持的支付方式**:
1. 💚 微信支付（企业/个人）
2. 💙 支付宝（企业/个人）
3. 🔷 银联云闪付
4. 🌟 YunGouOS聚合

**支持的账户类型**:
- 企业商户（直连）
- 个人账户（YunGouOS）
- 演示模式（无需配置）

**开箱即用**:
- 默认演示模式，立即可测试
- 配置后秒变真实支付
- 完整的用户体验

---

**🚀 IJPay已集成完毕，支付系统升级完成！** 🎉✨
