// ============================================
// KINDRED GUILD — SHARED SUPABASE CLIENT
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
})();
