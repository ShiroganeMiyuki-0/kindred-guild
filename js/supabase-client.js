// ============================================
// KINDRED GUILD — SHARED SUPABASE CLIENT
// Copyright (c) 2026 Kindred Guild. All Rights Reserved.
// Unauthorized copying or redistribution is prohibited.
// Include on EVERY page: <script src="js/supabase-client.js"></script>
// Must be loaded AFTER the Supabase CDN script.
// ============================================
(function () {
  const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

  if (window.supabase && window.supabase.createClient) {
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('[Kindred Guild] Supabase CDN not loaded. Add the CDN script before supabase-client.js');
  }

  // Shared utility: escape HTML to prevent XSS
  window.escapeHtml = function (text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Shared utility: get URL search param
  window.getUrlParam = function (key) {
    return new URLSearchParams(window.location.search).get(key);
  };

  // Shared utility: validate UUID
  window.isValidUuid = function (id) {
    if (!id || id === 'null' || id === 'undefined') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  };

  // Shared utility: relative time string
  window.timeAgo = function (date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
  };

  // Shared: require auth — redirects to auth.html if not logged in
  // Returns the user object or null
  window.requireAuth = async function () {
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) {
      window.location.href = 'auth.html';
      return null;
    }
    return user;
  };

  // Shared: get current user profile
  window.getUserProfile = async function (userId) {
    const { data, error } = await window.sb
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    return error ? null : data;
  };

  // Shared: toast notification system
  window.showToast = function (message, type, durationMs) {
    type = type || 'info';
    durationMs = durationMs || 3000;
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom, 0px) + 100px);right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:360px;';
      document.body.appendChild(container);
    }
    const colors = {
      success: { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#10b981' },
      error: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#ef4444' },
      info: { bg: 'rgba(212,175,55,0.15)', border: '#d4af37', text: '#d4af37' },
      warning: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#f59e0b' }
    };
    const c = colors[type] || colors.info;
    const toast = document.createElement('div');
    toast.style.cssText = `background:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:12px 16px;color:${c.text};font-size:0.85rem;font-weight:600;box-shadow:0 4px 15px rgba(0,0,0,0.3);animation:toastIn 0.3s ease;cursor:pointer;`;
    toast.textContent = message;
    toast.onclick = () => toast.remove();
    container.appendChild(toast);
    if (!document.getElementById('toast-anim-style')) {
      const s = document.createElement('style');
      s.id = 'toast-anim-style';
      s.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(s);
    }
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, durationMs);
  };
})();
