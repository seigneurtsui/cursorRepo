// public/auth-helper.js - Authentication helper functions

// Get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Make authenticated request
async function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  };
  
  const mergedOptions = { ...options, headers: { ...defaultOptions.headers, ...options.headers } };
  
  const response = await fetch(url, mergedOptions);
  
  // Check for authentication errors
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/public/login.html';
    throw new Error('认证失败，请重新登录');
  }
  
  // Check for balance errors
  if (response.status === 402) {
    const result = await response.json();
    throw new Error(result.error || '余额不足');
  }
  
  return response;
}
