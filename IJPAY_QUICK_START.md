# 🚀 IJPay 快速开始指南

## 📋 前提条件

本系统已集成 IJPay 支付，支持以下方式：

✅ **微信支付** (企业商户)  
✅ **支付宝** (企业开发者)  
✅ **云闪付** (企业商户)  
✅ **YunGouOS** (个人账户) ⭐ 推荐  
✅ **Mock模式** (测试开发)

---

## 🎯 三种部署模式

### 模式1: Mock模式（立即可用）✨

**特点**: 无需任何配置，立即测试

**配置**: 不需要配置支付参数

**行为**:
- 显示测试二维码
- 3秒后自动确认支付
- 余额立即到账
- 适合功能测试

**使用步骤**:
```bash
1. npm start
2. 访问会员中心
3. 选择套餐和支付方式
4. 点击"立即充值"
5. 等待3秒自动到账 ✓
```

**日志显示**:
```
⚠️  IJPay Mode: Mock (演示模式)
🎭 Mock Payment Created: wechat, Order: ORDER_..., Amount: ¥50
```

---

### 模式2: YunGouOS（个人推荐）⭐

**特点**: 
- ✅ 无需企业资质
- ✅ 个人即可申请
- ✅ 费率低（0.38%）
- ✅ 快速开通

**申请步骤**:

**Step 1**: 注册YunGouOS
```
1. 访问 https://www.yungouos.com
2. 注册账号
3. 登录控制台
```

**Step 2**: 实名认证
```
1. 进入"账户管理"
2. 点击"实名认证"
3. 上传身份证照片
4. 等待审核（通常几分钟）
```

**Step 3**: 获取密钥
```
1. 进入"API管理"
2. 查看"商户号"（Mch ID）
3. 查看"API密钥"（API Key）
4. 复制保存
```

**Step 4**: 配置.env
```env
# 启用YunGouOS
YUNGOUOS_ENABLED=true
YUNGOUOS_MCH_ID=your_merchant_id_here
YUNGOUOS_API_KEY=your_api_key_here

# 设置回调域名
BASE_URL=https://your-domain.com
```

**Step 5**: 重启服务
```bash
npm start
```

**验证**:
```
日志显示:
✅ IJPay Mode: YunGouOS (个人账户)
```

**测试**:
```
1. 访问会员中心
2. 选择套餐（建议先测试¥5）
3. 选择支付方式（微信/支付宝）
4. 点击"立即充值"
5. 扫描YunGouOS生成的二维码
6. 完成支付
7. 等待余额更新（2-5秒）
```

---

### 模式3: 直接渠道（企业账户）

**特点**:
- 需要企业资质
- 官方直连通道
- 更高稳定性

**微信支付申请**:
```
1. 访问 https://pay.weixin.qq.com
2. 注册商户账号
3. 提交资料：
   - 营业执照
   - 法人身份证
   - 银行账户信息
4. 等待审核（3-7个工作日）
5. 获取配置参数
```

**支付宝申请**:
```
1. 访问 https://open.alipay.com
2. 注册企业账号
3. 创建应用
4. 申请产品权限
5. 生成RSA2密钥对
6. 上传公钥到支付宝
```

**配置.env**:
```env
# 微信支付
WECHAT_APP_ID=wx1234567890
WECHAT_MCH_ID=1234567890
WECHAT_API_KEY=your_32_char_key
WECHAT_NOTIFY_URL=https://your-domain.com/api/payment/wechat/notify

# 支付宝
ALIPAY_APP_ID=2021001234567890
ALIPAY_PRIVATE_KEY=MIIEvQIBADANBgkqhkiG9w0BAQE...
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0BAQEFAAO...
ALIPAY_NOTIFY_URL=https://your-domain.com/api/payment/alipay/notify

# 必须设置
BASE_URL=https://your-domain.com
```

---

## 🔧 常见问题

### Q1: 如何选择支付模式？

**个人开发者** → 使用 YunGouOS ⭐  
**企业用户** → 使用直接渠道  
**开发测试** → 使用 Mock模式

---

### Q2: 回调地址怎么设置？

**必须满足**:
- ✅ 公网可访问
- ✅ 使用HTTPS（生产环境）
- ✅ 80或443端口

**开发环境**:
使用内网穿透工具：
- ngrok: `ngrok http 8051`
- frp: 自建穿透服务

```bash
# 使用ngrok
ngrok http 8051

# 获得公网地址
https://abc123.ngrok.io

# 更新.env
BASE_URL=https://abc123.ngrok.io
WECHAT_NOTIFY_URL=https://abc123.ngrok.io/api/payment/wechat/notify
```

---

### Q3: 支付成功但余额未更新？

**检查清单**:
1. ✅ 回调URL配置正确
2. ✅ 服务器可从公网访问
3. ✅ 查看服务器日志是否收到回调
4. ✅ 检查签名验证是否通过

**调试方法**:
```bash
# 查看服务器日志
npm start

# 应该看到
📥 Received wechat callback: {...}
✅ Signature verified
✅ Order completed: ORDER_...
```

---

### Q4: Mock模式如何切换到真实支付？

**步骤**:
```
1. 申请YunGouOS账号
2. 获取商户号和密钥
3. 更新.env配置
4. 重启服务器
5. ✅ 自动切换到真实支付
```

**验证**:
```
启动日志:
✅ IJPay Mode: YunGouOS (个人账户)

（不再显示Mock模式）
```

---

## 📊 费用对比

### YunGouOS vs 官方渠道

| 项目 | YunGouOS | 微信官方 | 支付宝官方 |
|------|----------|----------|-----------|
| 申请条件 | 个人 | 企业 | 企业 |
| 微信费率 | 0.38% | 0.6% | - |
| 支付宝费率 | 0.38% | - | 0.6% |
| 结算周期 | T+1 | T+1 | T+1 |
| 申请时间 | <1天 | 3-7天 | 3-7天 |
| 开通难度 | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

**推荐**: 个人开发者使用 YunGouOS

---

## 🔐 安全说明

### 回调验证流程

```
收到回调
    ↓
1. 验证签名
    ↓
   通过？
    ↓
2. 验证订单存在
    ↓
   存在？
    ↓
3. 验证金额匹配
    ↓
   匹配？
    ↓
4. 检查是否已处理
    ↓
   未处理？
    ↓
5. 更新订单和余额
    ↓
6. 返回SUCCESS
```

**任何验证失败 → 返回FAIL → 不处理订单**

---

## 📱 支付演示

### Mock模式演示

```
1. 选择套餐：月度套餐 (¥50)
2. 选择支付：微信支付
3. 点击充值

显示:
┌───────────────────────────┐
│  微信扫码支付      [×]    │
├───────────────────────────┤
│  [Mock QR Code]           │
│                           │
│  支付金额: ¥50.00         │
│  订单号: ORDER_...        │
│                           │
│  🎭 演示模式              │
│  将在3秒后自动确认支付     │
│                           │
│  [ 取消 ]  [ 刷新状态 ]  │
└───────────────────────────┘

3秒后:
✅ 支付成功！
余额: ¥0.00 → ¥50.00 ✓
```

---

### YunGouOS真实支付

```
1. 选择套餐：按次付费 (¥5)
2. 选择支付：支付宝
3. 点击充值

显示:
┌───────────────────────────┐
│  支付宝扫码支付    [×]    │
├───────────────────────────┤
│  [Real QR Code]           │
│                           │
│  支付金额: ¥5.00          │
│  订单号: ORDER_...        │
│                           │
│  请使用支付宝扫一扫       │
│  完成支付                 │
│                           │
│  ⏳ 等待支付中...         │
│                           │
│  [ 取消 ]  [ 刷新状态 ]  │
└───────────────────────────┘

用户扫码支付:
→ 打开支付宝
→ 扫描二维码
→ 确认支付¥5
→ 支付成功

2秒后前端检测到:
✅ 支付成功！
余额: ¥10.00 → ¥15.00 ✓
```

---

## 🎯 快速测试（3分钟）

### 测试Mock模式

```bash
# 1. 启动服务（不配置支付参数）
npm start

# 2. 访问会员中心
open http://localhost:8051/public/profile.html

# 3. 登录账号
Email: admin@example.com
Password: admin123456

# 4. 充值测试
→ 选择"按次付费" (¥5)
→ 选择"微信支付"
→ 点击"立即充值"
→ 等待3秒
→ ✅ 余额+¥5

# 5. 验证
→ 查看余额已更新
→ 查看交易记录已添加
```

---

### 测试YunGouOS（真实支付）

```bash
# 1. 配置.env
YUNGOUOS_ENABLED=true
YUNGOUOS_MCH_ID=your_id
YUNGOUOS_API_KEY=your_key

# 2. 重启服务
npm start

# 3. 小额测试
→ 选择"按次付费" (¥5)
→ 选择"支付宝"
→ 扫码支付¥5
→ 验证余额增加

# 4. 检查回调
→ 查看服务器日志
→ 应该看到回调日志
```

---

## 📚 完整文档

详细文档请查看：
- **IJPAY_INTEGRATION.md** - 完整集成文档
- **.env.example** - 配置参数说明

---

## ✅ 实现的功能总结

**三大需求**:
1. ✅ 会员余额导出（Excel）
2. ✅ 视频列表筛选修复
3. ✅ 视频导出格式修复

**IJPay集成**:
1. ✅ 支付服务实现
2. ✅ API路由完整
3. ✅ 前端UI更新
4. ✅ 数据库扩展
5. ✅ 回调处理
6. ✅ Mock模式

---

**🎉 IJPay集成完成！支持真实支付！** 🚀💰✨
