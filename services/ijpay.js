// services/ijpay.js - IJPay integration service
// Supports WeChat Pay, Alipay, and UnionPay

const crypto = require('crypto');
const axios = require('axios');

class IJPayService {
  constructor() {
    // WeChat Pay Configuration
    this.wechatConfig = {
      appId: process.env.WECHAT_APP_ID || '',
      mchId: process.env.WECHAT_MCH_ID || '',
      apiKey: process.env.WECHAT_API_KEY || '',
      apiV3Key: process.env.WECHAT_API_V3_KEY || '',
      certPath: process.env.WECHAT_CERT_PATH || '',
      notifyUrl: process.env.WECHAT_NOTIFY_URL || 'http://localhost:8051/api/payment/wechat/notify'
    };

    // Alipay Configuration
    this.alipayConfig = {
      appId: process.env.ALIPAY_APP_ID || '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
      gatewayUrl: process.env.ALIPAY_GATEWAY_URL || 'https://openapi.alipay.com/gateway.do',
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || 'http://localhost:8051/api/payment/alipay/notify'
    };

    // UnionPay Configuration
    this.unionpayConfig = {
      mchId: process.env.UNIONPAY_MCH_ID || '',
      apiKey: process.env.UNIONPAY_API_KEY || '',
      gatewayUrl: process.env.UNIONPAY_GATEWAY_URL || 'https://gateway.95516.com',
      notifyUrl: process.env.UNIONPAY_NOTIFY_URL || 'http://localhost:8051/api/payment/unionpay/notify'
    };

    // YunGouOS Configuration (Third-party aggregator for personal accounts)
    this.yungouosConfig = {
      mchId: process.env.YUNGOUOS_MCH_ID || '',
      apiKey: process.env.YUNGOUOS_API_KEY || '',
      enabled: process.env.YUNGOUOS_ENABLED === 'true' || false,
      gatewayUrl: 'https://api.yungouos.com/api/pay'
    };
  }

  // ==================== WeChat Pay ====================

  async createWechatOrder(orderId, amount, description, openId = null) {
    if (!this.wechatConfig.appId || !this.wechatConfig.mchId) {
      throw new Error('微信支付未配置，请联系管理员');
    }

    const params = {
      appid: this.wechatConfig.appId,
      mch_id: this.wechatConfig.mchId,
      nonce_str: this.generateNonceStr(),
      body: description,
      out_trade_no: orderId,
      total_fee: Math.round(amount * 100), // Convert to cents
      spbill_create_ip: '127.0.0.1',
      notify_url: this.wechatConfig.notifyUrl,
      trade_type: openId ? 'JSAPI' : 'NATIVE'
    };

    if (openId) {
      params.openid = openId;
    }

    // Generate signature
    params.sign = this.generateWechatSign(params);

    // Build XML request
    const xml = this.buildXML(params);

    try {
      const response = await axios.post('https://api.mch.weixin.qq.com/pay/unifiedorder', xml, {
        headers: { 'Content-Type': 'application/xml' }
      });

      const result = this.parseXML(response.data);

      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return {
          success: true,
          paymentType: 'wechat',
          qrCode: result.code_url,
          prepayId: result.prepay_id,
          orderId: orderId
        };
      } else {
        throw new Error(result.err_code_des || '微信支付创建订单失败');
      }
    } catch (error) {
      console.error('WeChat Pay Error:', error);
      throw new Error('微信支付失败: ' + error.message);
    }
  }

  // ==================== Alipay ====================

  async createAlipayOrder(orderId, amount, description) {
    if (!this.alipayConfig.appId || !this.alipayConfig.privateKey) {
      throw new Error('支付宝未配置，请联系管理员');
    }

    const params = {
      app_id: this.alipayConfig.appId,
      method: 'alipay.trade.page.pay',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      version: '1.0',
      notify_url: this.alipayConfig.notifyUrl,
      biz_content: JSON.stringify({
        out_trade_no: orderId,
        product_code: 'FAST_INSTANT_TRADE_PAY',
        total_amount: amount.toFixed(2),
        subject: description
      })
    };

    // Generate signature
    params.sign = this.generateAlipaySign(params);

    // Build payment URL
    const queryString = Object.keys(params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');

    const paymentUrl = `${this.alipayConfig.gatewayUrl}?${queryString}`;

    return {
      success: true,
      paymentType: 'alipay',
      paymentUrl: paymentUrl,
      orderId: orderId
    };
  }

  // ==================== YunGouOS (Personal Account Support) ====================

  async createYunGouOSOrder(orderId, amount, description, payType = 'wxpay') {
    if (!this.yungouosConfig.enabled || !this.yungouosConfig.mchId) {
      throw new Error('YunGouOS未配置或未启用');
    }

    const params = {
      out_trade_no: orderId,
      total_fee: amount.toFixed(2),
      mch_id: this.yungouosConfig.mchId,
      body: description,
      type: payType, // wxpay, alipay, unionpay
      attach: 'video-chapter-generator',
      notify_url: `${process.env.BASE_URL || 'http://localhost:8051'}/api/payment/yungouos/notify`,
      return_url: `${process.env.BASE_URL || 'http://localhost:8051'}/public/profile.html`,
      time: Date.now()
    };

    // Generate sign
    params.sign = this.generateYunGouOSSign(params);

    try {
      const response = await axios.post(`${this.yungouosConfig.gatewayUrl}/${payType}/create`, params);
      const result = response.data;

      if (result.code === 0) {
        return {
          success: true,
          paymentType: payType,
          qrCode: result.qrCode,
          payUrl: result.payUrl,
          orderId: orderId
        };
      } else {
        throw new Error(result.msg || 'YunGouOS创建订单失败');
      }
    } catch (error) {
      console.error('YunGouOS Error:', error);
      throw new Error('YunGouOS支付失败: ' + error.message);
    }
  }

  // ==================== Helper Functions ====================

  generateNonceStr(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  generateWechatSign(params) {
    const sortedParams = Object.keys(params)
      .filter(key => params[key] && key !== 'sign')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const stringSignTemp = `${sortedParams}&key=${this.wechatConfig.apiKey}`;
    return crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase();
  }

  generateAlipaySign(params) {
    const sortedParams = Object.keys(params)
      .filter(key => params[key] && key !== 'sign')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(sortedParams, 'utf8');
    return sign.sign(this.alipayConfig.privateKey, 'base64');
  }

  generateYunGouOSSign(params) {
    const sortedParams = Object.keys(params)
      .filter(key => params[key] && key !== 'sign')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const stringToSign = `${sortedParams}&key=${this.yungouosConfig.apiKey}`;
    return crypto.createHash('md5').update(stringToSign, 'utf8').digest('hex').toUpperCase();
  }

  buildXML(params) {
    let xml = '<xml>';
    Object.keys(params).forEach(key => {
      xml += `<${key}><![CDATA[${params[key]}]]></${key}>`;
    });
    xml += '</xml>';
    return xml;
  }

  parseXML(xmlString) {
    const result = {};
    const regex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>/g;
    let match;
    while ((match = regex.exec(xmlString)) !== null) {
      result[match[1]] = match[2];
    }
    return result;
  }

  // ==================== Payment Verification ====================

  verifyWechatNotify(params) {
    const sign = params.sign;
    delete params.sign;
    const calculatedSign = this.generateWechatSign(params);
    return sign === calculatedSign;
  }

  verifyAlipayNotify(params) {
    const sign = params.sign;
    const signType = params.sign_type;
    delete params.sign;
    delete params.sign_type;

    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(sortedParams, 'utf8');
    return verify.verify(this.alipayConfig.alipayPublicKey, sign, 'base64');
  }

  verifyYunGouOSNotify(params) {
    const sign = params.sign;
    delete params.sign;
    const calculatedSign = this.generateYunGouOSSign(params);
    return sign === calculatedSign;
  }

  // ==================== Query Order Status ====================

  async queryWechatOrder(orderId) {
    const params = {
      appid: this.wechatConfig.appId,
      mch_id: this.wechatConfig.mchId,
      out_trade_no: orderId,
      nonce_str: this.generateNonceStr()
    };

    params.sign = this.generateWechatSign(params);
    const xml = this.buildXML(params);

    try {
      const response = await axios.post('https://api.mch.weixin.qq.com/pay/orderquery', xml, {
        headers: { 'Content-Type': 'application/xml' }
      });

      const result = this.parseXML(response.data);
      return {
        success: result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS',
        tradeState: result.trade_state,
        paid: result.trade_state === 'SUCCESS'
      };
    } catch (error) {
      console.error('Query WeChat order error:', error);
      return { success: false, paid: false };
    }
  }

  // ==================== Mock Mode for Testing ====================

  async createMockOrder(orderId, amount, description, paymentMethod) {
    // Return mock data for testing without real payment configuration
    console.log(`🎭 Mock Payment Created: ${paymentMethod}, Order: ${orderId}, Amount: ¥${amount}`);
    
    return {
      success: true,
      paymentType: paymentMethod,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MOCK_${orderId}`,
      orderId: orderId,
      mockMode: true,
      message: '演示模式：扫码或等待自动确认'
    };
  }
}

module.exports = new IJPayService();
