// services/payment.js - Payment service (mock for MVP)
const db = require('../db/database');

class PaymentService {
  // Get all payment plans
  async getPaymentPlans() {
    const query = 'SELECT * FROM payment_plans WHERE is_active = TRUE ORDER BY price';
    const result = await db.query(query);
    return result.rows;
  }

  // Get payment plan by ID
  async getPaymentPlanById(planId) {
    const query = 'SELECT * FROM payment_plans WHERE id = $1 AND is_active = TRUE';
    const result = await db.query(query, [planId]);
    return result.rows[0];
  }

  // Create transaction (mock payment)
  async createTransaction(userId, planId, paymentMethod) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Get plan
      const planResult = await client.query('SELECT * FROM payment_plans WHERE id = $1', [planId]);
      if (planResult.rows.length === 0) {
        throw new Error('套餐不存在');
      }
      const plan = planResult.rows[0];

      // Get user
      const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        throw new Error('用户不存在');
      }
      const user = userResult.rows[0];

      const balanceBefore = parseFloat(user.balance);
      const amount = parseFloat(plan.price);
      const balanceAfter = balanceBefore + amount;

      // Create transaction record
      const transactionQuery = `
        INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, payment_method, payment_plan_id, status, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;
      
      const transactionResult = await client.query(transactionQuery, [
        userId,
        'recharge',
        amount,
        balanceBefore,
        balanceAfter,
        paymentMethod,
        planId,
        'completed', // In real implementation, this would be 'pending' until payment confirmed
        `充值 - ${plan.name}`
      ]);

      // Update user balance
      await client.query('UPDATE users SET balance = $1 WHERE id = $2', [balanceAfter, userId]);

      await client.query('COMMIT');

      return {
        transaction: transactionResult.rows[0],
        newBalance: balanceAfter
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Deduct balance (for usage)
  async deductBalance(userId, cost, description, videoId = null) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Get user
      const userResult = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (userResult.rows.length === 0) {
        throw new Error('用户不存在');
      }
      const user = userResult.rows[0];

      const balanceBefore = parseFloat(user.balance);
      
      // Check balance (skip for admin)
      if (!user.is_admin && balanceBefore < cost) {
        throw new Error('余额不足');
      }

      const balanceAfter = balanceBefore - cost;

      // Create transaction record
      const transactionQuery = `
        INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      
      await client.query(transactionQuery, [
        userId,
        'usage',
        -cost,
        balanceBefore,
        balanceAfter,
        'completed',
        description
      ]);

      // Update user balance
      await client.query('UPDATE users SET balance = $1 WHERE id = $2', [balanceAfter, userId]);

      // Log usage
      await client.query(
        'INSERT INTO usage_logs (user_id, video_id, action, cost) VALUES ($1, $2, $3, $4)',
        [userId, videoId, description, cost]
      );

      await client.query('COMMIT');

      return {
        success: true,
        newBalance: balanceAfter,
        cost: cost
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get user transactions
  async getUserTransactions(userId, limit = 50, offset = 0) {
    const query = `
      SELECT t.*, p.name as plan_name 
      FROM transactions t
      LEFT JOIN payment_plans p ON t.payment_plan_id = p.id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await db.query(query, [userId, limit, offset]);
    return result.rows;
  }

  // Get all transactions (admin)
  async getAllTransactions(limit = 100, offset = 0) {
    const query = `
      SELECT t.*, u.email, u.username, p.name as plan_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN payment_plans p ON t.payment_plan_id = p.id
      ORDER BY t.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await db.query(query, [limit, offset]);
    return result.rows;
  }

  // Update payment plan (admin only)
  async updatePaymentPlan(planId, updates) {
    const allowedFields = ['name', 'price', 'credits', 'description', 'is_active'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('没有可更新的字段');
    }

    values.push(planId);
    const query = `UPDATE payment_plans SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, values);
    return result.rows[0];
  }
}

module.exports = new PaymentService();
