// ============================================
// KINDRED GUILD — USERNAME SETUP
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const usernameInput = document.getElementById('username');
const displayNameInput = document.getElementById('displayName');
const createBtn = document.getElementById('createBtn');
const messageEl = document.getElementById('message');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + (type || 'error');
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
    showMessage('Username must be at least 3 characters.', 'error');
    return;
  }

  clearMessage();
  createBtn.disabled = true;
  createBtn.textContent = 'Creating...';

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    showMessage('Session expired. Please log in again.', 'error');
    setTimeout(() => window.location.href = 'auth.html', 1500);
    return;
  }

  // Check if profile already exists
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existing) {
    window.location.href = 'quest-board.html';
    return;
  }

  // Insert profile
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
    if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
      showMessage('That username is already taken. Try another.', 'error');
    } else {
      showMessage(insertError.message, 'error');
    }
    createBtn.disabled = false;
    createBtn.textContent = 'Join the Guild';
    return;
  }

  showMessage('Welcome to the Guild! Redirecting...', 'success');
  setTimeout(() => window.location.href = 'quest-board.html', 1000);
}

// Guard: if already has profile, redirect
(async function guard() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (profile) {
    window.location.href = 'quest-board.html';
  }
})();
