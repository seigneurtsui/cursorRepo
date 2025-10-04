// payment-ijpay.js - IJPay payment handling functions

// Global variables for payment
let currentOrderId = null;
let paymentStatusCheckInterval = null;

// Show payment modal with QR code
function showPaymentModal(paymentData) {
  currentOrderId = paymentData.orderId;
  
  // Get selected plan info
  const planCards = document.querySelectorAll('.plan-card');
  let selectedPlanPrice = 0;
  let selectedPlanName = '';
  planCards.forEach((card) => {
    if (card.classList.contains('selected')) {
      const priceText = card.querySelector('.plan-price').textContent;
      selectedPlanPrice = parseFloat(priceText.replace('¥', ''));
      selectedPlanName = card.querySelector('div').textContent.split('🔥')[0].trim();
    }
  });
  
  document.getElementById('paymentAmount').textContent = `¥${selectedPlanPrice.toFixed(2)}`;
  document.getElementById('paymentDesc').textContent = selectedPlanName;
  document.getElementById('orderIdDisplay').textContent = paymentData.orderId;
  
  // Set payment method display
  const methodNames = {
    wechat: '微信',
    alipay: '支付宝',
    unionpay: '云闪付'
  };
  
  const selectedMethod = window.selectedPaymentMethod || 'wechat';
  document.getElementById('paymentMethodDisplay').textContent = methodNames[selectedMethod] || selectedMethod;
  
  // Display QR code
  const qrContainer = document.getElementById('qrCodeContainer');
  
  if (paymentData.mockMode) {
    // Mock mode - show test QR and auto-confirm button
    qrContainer.innerHTML = `
      <div style="text-align: center;">
        <img src="${paymentData.qrCode}" alt="Payment QR Code" style="width: 250px; height: 250px; border: 2px solid #ddd; border-radius: 10px;">
        <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 6px;">
          <div style="color: #856404; font-size: 13px;">
            <strong>🎭 演示模式</strong> - 未配置真实支付
          </div>
          <button onclick="mockConfirmPayment()" class="btn-primary" style="margin-top: 10px; padding: 8px 16px; font-size: 14px;">
            ✅ 模拟支付成功
          </button>
        </div>
      </div>
    `;
  } else if (paymentData.qrCode) {
    // Real payment - show QR code
    qrContainer.innerHTML = `
      <img src="${paymentData.qrCode}" alt="Payment QR Code" style="width: 250px; height: 250px; border: 2px solid #ddd; border-radius: 10px;">
    `;
    
    // Start polling payment status
    startPaymentStatusCheck();
  } else if (paymentData.paymentUrl) {
    // Alipay - redirect to payment page
    qrContainer.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 48px; margin-bottom: 15px;">💙</div>
        <div style="font-size: 16px; color: #333; margin-bottom: 20px;">即将跳转到支付宝收银台...</div>
        <a href="${paymentData.paymentUrl}" target="_blank" class="btn-primary" style="display: inline-block; text-decoration: none; padding: 12px 24px;">
          前往支付宝支付
        </a>
      </div>
    `;
    
    // Auto-redirect after 2 seconds
    setTimeout(() => {
      window.open(paymentData.paymentUrl, '_blank');
    }, 2000);
    
    // Start polling payment status
    startPaymentStatusCheck();
  }
  
  // Show modal
  document.getElementById('paymentModal').style.display = 'flex';
}

function closePaymentModal() {
  document.getElementById('paymentModal').style.display = 'none';
  currentOrderId = null;
  
  // Stop status checking
  if (paymentStatusCheckInterval) {
    clearInterval(paymentStatusCheckInterval);
    paymentStatusCheckInterval = null;
  }
  
  // Reload profile to refresh balance
  if (typeof loadProfile === 'function') {
    loadProfile();
  }
}

function startPaymentStatusCheck() {
  // Check payment status every 3 seconds
  paymentStatusCheckInterval = setInterval(async () => {
    await checkPaymentStatus(true);
  }, 3000);
}

async function checkPaymentStatus(autoCheck = false) {
  if (!currentOrderId) return;
  
  const token = localStorage.getItem('token');
  const API_BASE = window.location.origin;
  
  try {
    const response = await fetch(`${API_BASE}/api/payment/query-order/${currentOrderId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success && result.paid) {
      // Payment successful
      if (paymentStatusCheckInterval) {
        clearInterval(paymentStatusCheckInterval);
        paymentStatusCheckInterval = null;
      }
      
      // Show success
      document.getElementById('qrCodeContainer').innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 64px; color: #28a745; margin-bottom: 15px;">✅</div>
          <div style="font-size: 20px; font-weight: 600; color: #28a745;">支付成功！</div>
          <div style="font-size: 14px; color: #666; margin-top: 10px;">余额已更新，页面即将刷新...</div>
        </div>
      `;
      
      setTimeout(() => {
        closePaymentModal();
        alert('🎉 充值成功！感谢您的支持！');
      }, 2000);
    } else if (!autoCheck) {
      // Manual check, show message
      alert('⏳ 订单还未支付，请扫码完成支付');
    }
  } catch (error) {
    console.error('Check payment status error:', error);
    if (!autoCheck) {
      alert('❌ 查询失败: ' + error.message);
    }
  }
}

// Mock payment confirm (for testing mode only)
async function mockConfirmPayment() {
  if (!currentOrderId) return;
  
  const token = localStorage.getItem('token');
  const API_BASE = window.location.origin;
  
  try {
    const response = await fetch(`${API_BASE}/api/payment/mock-confirm/${currentOrderId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Show success
      document.getElementById('qrCodeContainer').innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 64px; color: #28a745; margin-bottom: 15px;">✅</div>
          <div style="font-size: 20px; font-weight: 600; color: #28a745;">模拟支付成功！</div>
          <div style="font-size: 14px; color: #666; margin-top: 10px;">新余额: ¥${result.newBalance.toFixed(2)}</div>
        </div>
      `;
      
      setTimeout(() => {
        closePaymentModal();
        alert(`🎉 充值成功！\n\n新余额: ¥${result.newBalance.toFixed(2)}`);
      }, 1500);
    } else {
      alert('❌ 支付失败: ' + (result.error || '未知错误'));
    }
  } catch (error) {
    console.error('Mock confirm error:', error);
    alert('❌ 支付失败: ' + error.message);
  }
}
