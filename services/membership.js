// services/membership.js - Membership, Coupon, and Referral services

const db = require('../db/database');

class MembershipService {
  // ==================== Membership Levels ====================
  
  async getMembershipLevels() {
    const query = 'SELECT * FROM membership_levels ORDER BY level ASC';
    const result = await db.query(query);
    return result.rows;
  }

  async getUserMembershipInfo(userId) {
    const query = `
      SELECT 
        u.id,
        u.total_recharged,
        ml.id as level_id,
        ml.name,
        ml.min_recharge,
        ml.discount,
        ml.benefits,
        ml.icon,
        ml.sort_order
      FROM users u
      LEFT JOIN membership_levels ml ON u.total_recharged >= ml.min_recharge
      WHERE u.id = $1
      ORDER BY ml.min_recharge DESC
      LIMIT 1
    `;
    const result = await db.query(query, [userId]);
    
    // 如果没有找到匹配的等级，返回默认等级
    if (!result.rows[0] || !result.rows[0].name) {
      const defaultLevel = await db.query(`
        SELECT id as level_id, name, min_recharge, discount, benefits, icon, sort_order
        FROM membership_levels 
        ORDER BY min_recharge ASC 
        LIMIT 1
      `);
      if (defaultLevel.rows[0]) {
        return {
          ...defaultLevel.rows[0],
          total_recharged: result.rows[0]?.total_recharged || 0
        };
      }
    }
    
    return result.rows[0];
  }

  async updateUserMembershipLevel(userId) {
    // Get user's total spending
    const spendingQuery = 'SELECT total_spending FROM users WHERE id = $1';
    const spendingResult = await db.query(spendingQuery, [userId]);
    const totalSpending = parseFloat(spendingResult.rows[0]?.total_spending || 0);

    // Find appropriate membership level
    const levelQuery = `
      SELECT level FROM membership_levels 
      WHERE min_spending <= $1 
      ORDER BY level DESC 
      LIMIT 1
    `;
    const levelResult = await db.query(levelQuery, [totalSpending]);
    const newLevel = levelResult.rows[0]?.level || 1;

    // Update user's membership level
    const updateQuery = 'UPDATE users SET membership_level = $1 WHERE id = $2';
    await db.query(updateQuery, [newLevel, userId]);

    return newLevel;
  }

  // ==================== Coupons ====================
  
  async createCoupon(couponData, createdBy) {
    const query = `
      INSERT INTO coupons (code, name, type, discount_value, min_purchase, max_uses, valid_from, valid_until, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await db.query(query, [
      couponData.code,
      couponData.name,
      couponData.type, // 'fixed' or 'percentage'
      couponData.discountValue,
      couponData.minPurchase || 0,
      couponData.maxUses || 1,
      couponData.validFrom || new Date(),
      couponData.validUntil,
      createdBy
    ]);
    return result.rows[0];
  }

  async getAllCoupons(isActive = null) {
    let query = 'SELECT c.*, u.username as creator_name FROM coupons c LEFT JOIN users u ON c.created_by = u.id';
    const params = [];
    
    if (isActive !== null) {
      query += ' WHERE c.is_active = $1';
      params.push(isActive);
    }
    
    query += ' ORDER BY c.created_at DESC';
    const result = await db.query(query, params);
    return result.rows;
  }

  async giveCouponToUser(userId, couponId) {
    const query = `
      INSERT INTO user_coupons (user_id, coupon_id)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await db.query(query, [userId, couponId]);
    return result.rows[0];
  }

  async getUserCoupons(userId, includeUsed = false) {
    let query = `
      SELECT uc.*, c.code, c.name, c.type, c.discount_value, c.min_purchase, c.valid_until
      FROM user_coupons uc
      JOIN coupons c ON uc.coupon_id = c.id
      WHERE uc.user_id = $1
    `;
    
    if (!includeUsed) {
      query += ' AND uc.is_used = FALSE AND c.valid_until > NOW()';
    }
    
    query += ' ORDER BY uc.created_at DESC';
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  async useCoupon(userCouponId, transactionId) {
    const query = `
      UPDATE user_coupons 
      SET is_used = TRUE, used_at = NOW(), transaction_id = $2
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [userCouponId, transactionId]);
    return result.rows[0];
  }

  async validateCoupon(code, userId) {
    // Check if coupon exists and is active
    const couponQuery = `
      SELECT * FROM coupons 
      WHERE code = $1 AND is_active = TRUE 
      AND valid_until > NOW() 
      AND used_count < max_uses
    `;
    const couponResult = await db.query(couponQuery, [code]);
    
    if (couponResult.rows.length === 0) {
      return { valid: false, message: '优惠券不存在或已过期' };
    }

    const coupon = couponResult.rows[0];

    // Check if user already has this coupon
    const userCouponQuery = `
      SELECT * FROM user_coupons 
      WHERE user_id = $1 AND coupon_id = $2
    `;
    const userCouponResult = await db.query(userCouponQuery, [userId, coupon.id]);
    
    if (userCouponResult.rows.length > 0) {
      return { valid: false, message: '您已领取过此优惠券' };
    }

    return { valid: true, coupon };
  }

  // ==================== Referrals ====================
  
  async generateReferralCode(userId) {
    // Generate unique 8-character code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    const query = 'UPDATE users SET referral_code = $1 WHERE id = $2 RETURNING referral_code';
    const result = await db.query(query, [code, userId]);
    return result.rows[0]?.referral_code;
  }

  async getReferralCode(userId) {
    const query = 'SELECT referral_code FROM users WHERE id = $1';
    const result = await db.query(query, [userId]);
    
    let code = result.rows[0]?.referral_code;
    if (!code) {
      code = await this.generateReferralCode(userId);
    }
    
    return code;
  }

  async createReferral(referralCode, referredUserId) {
    // Find referrer by code
    const referrerQuery = 'SELECT id FROM users WHERE referral_code = $1';
    const referrerResult = await db.query(referrerQuery, [referralCode]);
    
    if (referrerResult.rows.length === 0) {
      return { success: false, message: '无效的推荐码' };
    }

    const referrerId = referrerResult.rows[0].id;

    // Can't refer yourself
    if (referrerId === referredUserId) {
      return { success: false, message: '不能使用自己的推荐码' };
    }

    // Check if referral already exists
    const existingQuery = 'SELECT * FROM referrals WHERE referred_id = $1';
    const existingResult = await db.query(existingQuery, [referredUserId]);
    
    if (existingResult.rows.length > 0) {
      return { success: false, message: '您已经使用过推荐码' };
    }

    // Get referrer's membership level for reward amount
    const membershipInfo = await this.getUserMembershipInfo(referrerId);
    const rewardAmount = membershipInfo?.referral_bonus || 5;

    // Create referral
    const query = `
      INSERT INTO referrals (referrer_id, referred_id, referral_code, reward_amount, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING *
    `;
    const result = await db.query(query, [referrerId, referredUserId, referralCode, rewardAmount]);

    return { success: true, referral: result.rows[0] };
  }

  async activateReferral(referralId) {
    // Activate referral and give reward
    const getReferralQuery = 'SELECT * FROM referrals WHERE id = $1';
    const referralResult = await db.query(getReferralQuery, [referralId]);
    
    if (referralResult.rows.length === 0) {
      return { success: false, message: '推荐关系不存在' };
    }

    const referral = referralResult.rows[0];

    if (referral.reward_given) {
      return { success: false, message: '奖励已发放' };
    }

    // Update referrer's balance
    const updateBalanceQuery = `
      UPDATE users 
      SET balance = balance + $1 
      WHERE id = $2
      RETURNING balance
    `;
    await db.query(updateBalanceQuery, [referral.reward_amount, referral.referrer_id]);

    // Create transaction record
    const transactionQuery = `
      INSERT INTO transactions (user_id, type, amount, status, description)
      VALUES ($1, 'referral_reward', $2, 'completed', $3)
    `;
    const description = `推荐奖励 - 成功推荐新用户`;
    await db.query(transactionQuery, [referral.referrer_id, referral.reward_amount, description]);

    // Mark referral as rewarded
    const updateReferralQuery = `
      UPDATE referrals 
      SET status = 'completed', reward_given = TRUE, reward_given_at = NOW()
      WHERE id = $1
    `;
    await db.query(updateReferralQuery, [referralId]);

    return { success: true };
  }

  async getUserReferrals(userId) {
    const query = `
      SELECT r.*, u.username as referred_username, u.email as referred_email, u.created_at as referred_created_at
      FROM referrals r
      JOIN users u ON r.referred_id = u.id
      WHERE r.referrer_id = $1
      ORDER BY r.created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  async getReferralStats(userId) {
    const query = `
      SELECT 
        COUNT(*) as total_referrals,
        SUM(CASE WHEN reward_given THEN 1 ELSE 0 END) as rewarded_referrals,
        SUM(CASE WHEN reward_given THEN reward_amount ELSE 0 END) as total_rewards
      FROM referrals
      WHERE referrer_id = $1
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0];
  }
}

module.exports = new MembershipService();
