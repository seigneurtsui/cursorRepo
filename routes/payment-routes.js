// routes/payment-routes.js - Payment API routes for IJPay

const express = require('express');
const router = express.Router();
const ijpayService = require('../services/ijpay');
const paymentService = require('../services/payment');
const { authenticate } = require('../middleware/auth');
const db = require('../db/database');

// ==================== Create Payment Order ====================

router.post('/create-order', authenticate, async (req, res) => {
  try {
    const { planId, paymentMethod } = req.body;

    if (!planId || !paymentMethod) {
      return res.status(400).json({ error: '请提供套餐ID和支付方式' });
    }

    // Get payment plan
    const plan = await paymentService.getPaymentPlanById(planId);
    if (!plan) {
      return res.status(404).json({ error: '套餐不存在' });
    }

    // Generate unique order ID
    const orderId = `ORDER_${Date.now()}_${req.user.id}`;
    const amount = parseFloat(plan.price);
    const description = `充值 - ${plan.name}`;

    let paymentData;

    // Check if using mock mode (no real payment config)
    // Mock mode is enabled when:
    // 1. No WeChat Pay config AND
    // 2. No Alipay config AND
    // 3. (No YunGouOS config OR YunGouOS is explicitly disabled)
    const hasWechatConfig = !!(process.env.WECHAT_APP_ID && process.env.WECHAT_MCH_ID && process.env.WECHAT_API_KEY);
    const hasAlipayConfig = !!(process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY);
    const hasYunGouOSConfig = !!(process.env.YUNGOUOS_MCH_ID && process.env.YUNGOUOS_API_KEY);
    const yunGouOSEnabled = process.env.YUNGOUOS_ENABLED === 'true';
    
    const isMockMode = !hasWechatConfig && !hasAlipayConfig && (!hasYunGouOSConfig || !yunGouOSEnabled);

    console.log('💳 Payment Config Check:', {
      hasWechatConfig,
      hasAlipayConfig,
      hasYunGouOSConfig,
      yunGouOSEnabled,
      isMockMode
    });

    if (isMockMode) {
      // Mock mode for testing
      console.log('🎭 Using Mock Payment Mode');
      paymentData = await ijpayService.createMockOrder(orderId, amount, description, paymentMethod);
    } else if (yunGouOSEnabled && hasYunGouOSConfig) {
      // Use YunGouOS for personal accounts
      console.log('🏦 Using YunGouOS Payment');
      const payType = paymentMethod === 'wechat' ? 'wxpay' : paymentMethod === 'alipay' ? 'alipay' : 'unionpay';
      paymentData = await ijpayService.createYunGouOSOrder(orderId, amount, description, payType);
    } else {
      // Use direct payment channels
      console.log(`💰 Using Direct Payment: ${paymentMethod}`);
      switch (paymentMethod) {
        case 'wechat':
          if (!hasWechatConfig) {
            console.log('⚠️ WeChat Pay not configured, using mock mode');
            paymentData = await ijpayService.createMockOrder(orderId, amount, description, paymentMethod);
          } else {
            paymentData = await ijpayService.createWechatOrder(orderId, amount, description);
          }
          break;
        case 'alipay':
          if (!hasAlipayConfig) {
            console.log('⚠️ Alipay not configured, using mock mode');
            paymentData = await ijpayService.createMockOrder(orderId, amount, description, paymentMethod);
          } else {
            paymentData = await ijpayService.createAlipayOrder(orderId, amount, description);
          }
          break;
        default:
          return res.status(400).json({ error: '不支持的支付方式' });
      }
    }

    // Create pending transaction
    await db.query(`
      INSERT INTO transactions (user_id, type, amount, status, plan_id, description, payment_method, order_id)
      VALUES ($1, 'recharge', $2, 'pending', $3, $4, $5, $6)
    `, [req.user.id, amount, planId, description, paymentMethod, orderId]);

    res.json({
      success: true,
      ...paymentData
    });

  } catch (error) {
    console.error('创建支付订单错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Query Order Status ====================

router.get('/query-order/:orderId', authenticate, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get transaction from database
    const transactionQuery = await db.query(
      'SELECT * FROM transactions WHERE order_id = $1 AND user_id = $2',
      [orderId, req.user.id]
    );

    if (transactionQuery.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const transaction = transactionQuery.rows[0];

    // If already completed, return success
    if (transaction.status === 'completed') {
      return res.json({
        success: true,
        paid: true,
        status: 'completed'
      });
    }

    // Check with payment provider
    const paymentMethod = transaction.payment_method;
    let queryResult;

    if (paymentMethod === 'wechat') {
      queryResult = await ijpayService.queryWechatOrder(orderId);
    } else if (paymentMethod === 'alipay') {
      // Add Alipay query implementation
      queryResult = { success: false, paid: false };
    } else {
      queryResult = { success: false, paid: false };
    }

    res.json({
      success: true,
      paid: queryResult.paid,
      status: queryResult.paid ? 'completed' : 'pending'
    });

  } catch (error) {
    console.error('查询订单错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Payment Callbacks ====================

// WeChat Pay callback
router.post('/wechat/notify', async (req, res) => {
  try {
    const params = ijpayService.parseXML(req.body);

    // Verify signature
    if (!ijpayService.verifyWechatNotify(params)) {
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名验证失败]]></return_msg></xml>');
    }

    if (params.result_code === 'SUCCESS') {
      const orderId = params.out_trade_no;
      
      // Update transaction status
      await db.query(`
        UPDATE transactions 
        SET status = 'completed', 
            completed_at = NOW(),
            transaction_no = $2
        WHERE order_id = $1 AND status = 'pending'
        RETURNING *
      `, [orderId, params.transaction_id]);

      // Update user balance
      const transaction = await db.query('SELECT * FROM transactions WHERE order_id = $1', [orderId]);
      if (transaction.rows.length > 0) {
        const t = transaction.rows[0];
        await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [t.amount, t.user_id]);
      }
    }

    res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
  } catch (error) {
    console.error('WeChat notify error:', error);
    res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[处理失败]]></return_msg></xml>');
  }
});

// Alipay callback
router.post('/alipay/notify', async (req, res) => {
  try {
    const params = req.body;

    // Verify signature
    if (!ijpayService.verifyAlipayNotify(params)) {
      return res.send('fail');
    }

    if (params.trade_status === 'TRADE_SUCCESS' || params.trade_status === 'TRADE_FINISHED') {
      const orderId = params.out_trade_no;
      
      // Update transaction status
      await db.query(`
        UPDATE transactions 
        SET status = 'completed', 
            completed_at = NOW(),
            transaction_no = $2
        WHERE order_id = $1 AND status = 'pending'
        RETURNING *
      `, [orderId, params.trade_no]);

      // Update user balance
      const transaction = await db.query('SELECT * FROM transactions WHERE order_id = $1', [orderId]);
      if (transaction.rows.length > 0) {
        const t = transaction.rows[0];
        await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [t.amount, t.user_id]);
      }
    }

    res.send('success');
  } catch (error) {
    console.error('Alipay notify error:', error);
    res.send('fail');
  }
});

// YunGouOS callback
router.post('/yungouos/notify', async (req, res) => {
  try {
    const params = req.body;

    // Verify signature
    if (!ijpayService.verifyYunGouOSNotify(params)) {
      return res.send('fail');
    }

    if (params.trade_status === 'SUCCESS') {
      const orderId = params.out_trade_no;
      
      // Update transaction status
      await db.query(`
        UPDATE transactions 
        SET status = 'completed', 
            completed_at = NOW(),
            transaction_no = $2
        WHERE order_id = $1 AND status = 'pending'
        RETURNING *
      `, [orderId, params.trade_no]);

      // Update user balance
      const transaction = await db.query('SELECT * FROM transactions WHERE order_id = $1', [orderId]);
      if (transaction.rows.length > 0) {
        const t = transaction.rows[0];
        await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [t.amount, t.user_id]);
        
        // Update total spending and check membership upgrade
        await db.query('UPDATE users SET total_spending = total_spending + $1 WHERE id = $2', [t.amount, t.user_id]);
      }
    }

    res.send('success');
  } catch (error) {
    console.error('YunGouOS notify error:', error);
    res.send('fail');
  }
});

// ==================== Mock Payment for Testing ====================

// Manual confirm mock payment (for testing only)
router.post('/mock-confirm/:orderId', authenticate, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Update transaction
    const updateResult = await db.query(`
      UPDATE transactions 
      SET status = 'completed', 
          completed_at = NOW(),
          transaction_no = $2
      WHERE order_id = $1 AND user_id = $3 AND status = 'pending'
      RETURNING *
    `, [orderId, `MOCK_${Date.now()}`, req.user.id]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在或已完成' });
    }

    const transaction = updateResult.rows[0];

    // Update user balance
    await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [transaction.amount, req.user.id]);
    
    // Update total spending
    await db.query('UPDATE users SET total_spending = total_spending + $1 WHERE id = $2', [transaction.amount, req.user.id]);

    // Get new balance
    const userResult = await db.query('SELECT balance FROM users WHERE id = $1', [req.user.id]);
    const newBalance = parseFloat(userResult.rows[0].balance);

    res.json({
      success: true,
      message: '充值成功',
      newBalance: newBalance
    });

  } catch (error) {
    console.error('Mock confirm error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
