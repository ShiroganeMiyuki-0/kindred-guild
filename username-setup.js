// ============================================
// KINDRED GUILD — USERNAME SETUP
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const usernameInput = document.getElementById('username');
const displayNameInput = document.getElementById('displayName');
const createBtn = document.getElementById('createBtn');
const messageEl = document.getElementById('message');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + (type || 'error');
  console.log('[' + (type || 'error') + ']', text);
}

function clearMessage() {
  messageEl.className = 'message';
  messageEl.textContent = '';
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '').replace(/_{2,}/g, '_');
}

async function createProfile() {
  let username = usernameInput.value.trim();
  const displayName = displayNameInput.value.trim();

  if (!username) {
    showMessage('Please enter a username.', 'error');
    return;
  }

  username = slugify(username);

  if (username.length < 3) {
    showMessage('Username must be at least 3 characters (letters, numbers, underscores only).', 'error');
    return;
  }

  clearMessage();
  createBtn.disabled = true;
  createBtn.textContent = 'Creating...';

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('Get user error:', userError);
      showMessage('Session error: ' + userError.message, 'error');
      createBtn.disabled = false;
      createBtn.textContent = 'Join the Guild';
      return;
    }

    if (!user) {
      showMessage('Not logged in. Redirecting to login...', 'error');
      setTimeout(() => window.location.href = 'auth.html', 1500);
      return;
    }

    console.log('Creating profile for user:', user.id);

    const { data: existing, error: existingError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (existing) {
      console.log('Profile already exists, redirecting');
      window.location.href = 'quest-board.html';
      return;
    }

    const { error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        username: username,
        display_name: displayName || username,
        reputation_score: 0,
        is_suspended: false
      });

    if (insertError) {
      console.error('Insert profile error:', insertError);
      if (insertError.code === '23505' || insertError.message.includes('unique') || insertError.message.includes('duplicate')) {
        showMessage('That username is already taken. Try another.', 'error');
      } else {
        showMessage('Error: ' + insertError.message, 'error');
      }
      createBtn.disabled = false;
      createBtn.textContent = 'Join the Guild';
      return;
    }

    console.log('Profile created successfully');
    showMessage('Welcome to the Guild! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'quest-board.html', 1000);

  } catch (err) {
    console.error('Unexpected error:', err);
    showMessage('Something went wrong. Check console (F12).', 'error');
    createBtn.disabled = false;
    createBtn.textContent = 'Join the Guild';
  }
}

(async function guard() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log('No user session, redirecting to auth');
      window.location.href = 'auth.html';
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (profile) {
      console.log('Profile exists, redirecting to quest board');
      window.location.href = 'quest-board.html';
    }
  } catch (err) {
    console.error('Guard error:', err);
  }
})();
