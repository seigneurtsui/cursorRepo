// routes/membership-routes.js - Membership API routes

const express = require('express');
const router = express.Router();
const membershipService = require('../services/membership');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ==================== Membership Levels ====================

// Get all membership levels
router.get('/levels', async (req, res) => {
  try {
    const levels = await membershipService.getMembershipLevels();
    res.json({ success: true, levels });
  } catch (error) {
    console.error('获取会员等级错误:', error);
    res.status(500).json({ error: '获取会员等级失败' });
  }
});

// Get user's membership info
router.get('/my-level', authenticate, async (req, res) => {
  try {
    const info = await membershipService.getUserMembershipInfo(req.user.id);
    res.json({ success: true, membership: info });
  } catch (error) {
    console.error('获取会员信息错误:', error);
    res.status(500).json({ error: '获取会员信息失败' });
  }
});

// ==================== Coupons ====================

// Get all coupons (admin only)
router.get('/admin/coupons', authenticate, requireAdmin, async (req, res) => {
  try {
    const { active } = req.query;
    const isActive = active === 'true' ? true : active === 'false' ? false : null;
    const coupons = await membershipService.getAllCoupons(isActive);
    res.json({ success: true, coupons });
  } catch (error) {
    console.error('获取优惠券错误:', error);
    res.status(500).json({ error: '获取优惠券失败' });
  }
});

// Create coupon (admin only)
router.post('/admin/coupons', authenticate, requireAdmin, async (req, res) => {
  try {
    const coupon = await membershipService.createCoupon(req.body, req.user.id);
    res.json({ success: true, coupon });
  } catch (error) {
    console.error('创建优惠券错误:', error);
    res.status(500).json({ error: '创建优惠券失败' });
  }
});

// Give coupon to user (admin only)
router.post('/admin/coupons/:couponId/give', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    const couponId = parseInt(req.params.couponId);
    const userCoupon = await membershipService.giveCouponToUser(userId, couponId);
    res.json({ success: true, userCoupon });
  } catch (error) {
    console.error('发放优惠券错误:', error);
    res.status(500).json({ error: '发放优惠券失败' });
  }
});

// Get user's coupons
router.get('/my-coupons', authenticate, async (req, res) => {
  try {
    const { includeUsed } = req.query;
    const coupons = await membershipService.getUserCoupons(req.user.id, includeUsed === 'true');
    res.json({ success: true, coupons });
  } catch (error) {
    console.error('获取优惠券错误:', error);
    res.status(500).json({ error: '获取优惠券失败' });
  }
});

// Claim coupon by code
router.post('/claim-coupon', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    
    // Validate coupon
    const validation = await membershipService.validateCoupon(code, req.user.id);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    // Give coupon to user
    const userCoupon = await membershipService.giveCouponToUser(req.user.id, validation.coupon.id);
    
    res.json({ 
      success: true, 
      message: '优惠券领取成功',
      userCoupon,
      coupon: validation.coupon
    });
  } catch (error) {
    console.error('领取优惠券错误:', error);
    res.status(500).json({ error: '领取优惠券失败' });
  }
});

// ==================== Referrals ====================

// Get my referral code
router.get('/my-referral-code', authenticate, async (req, res) => {
  try {
    const code = await membershipService.getReferralCode(req.user.id);
    res.json({ success: true, referralCode: code });
  } catch (error) {
    console.error('获取推荐码错误:', error);
    res.status(500).json({ error: '获取推荐码失败' });
  }
});

// Get my referrals
router.get('/my-referrals', authenticate, async (req, res) => {
  try {
    const referrals = await membershipService.getUserReferrals(req.user.id);
    const stats = await membershipService.getReferralStats(req.user.id);
    res.json({ success: true, referrals, stats });
  } catch (error) {
    console.error('获取推荐记录错误:', error);
    res.status(500).json({ error: '获取推荐记录失败' });
  }
});

// Use referral code (during registration or later)
router.post('/use-referral-code', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    
    const result = await membershipService.createReferral(code, req.user.id);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ 
      success: true, 
      message: '推荐码使用成功',
      referral: result.referral 
    });
  } catch (error) {
    console.error('使用推荐码错误:', error);
    res.status(500).json({ error: '使用推荐码失败' });
  }
});

// Activate referral and give reward (admin or auto-trigger)
router.post('/admin/referrals/:id/activate', authenticate, requireAdmin, async (req, res) => {
  try {
    const referralId = parseInt(req.params.id);
    const result = await membershipService.activateReferral(referralId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true, message: '推荐奖励发放成功' });
  } catch (error) {
    console.error('发放推荐奖励错误:', error);
    res.status(500).json({ error: '发放推荐奖励失败' });
  }
});

module.exports = router;
