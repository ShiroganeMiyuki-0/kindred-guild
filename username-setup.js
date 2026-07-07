// ============================================
// KINDRED GUILD — USERNAME SETUP
// Uses shared window.sb from supabase-client.js
// ============================================

const usernameInput = document.getElementById('username');
const displayNameInput = document.getElementById('displayName');
const createBtn = document.getElementById('createBtn');
const messageEl = document.getElementById('message');

function showMessage(text, type) { messageEl.textContent = text; messageEl.className = 'message ' + (type || 'error'); }
function clearMessage() { messageEl.className = 'message'; messageEl.textContent = ''; }
function slugify(name) { return name.toLowerCase().replace(/[^a-z0-9_]/g, '').replace(/_{2,}/g, '_'); }

async function createProfile() {
  let username = usernameInput.value.trim();
  const displayName = displayNameInput.value.trim();
  if (!username) { showMessage('Please enter a username.', 'error'); return; }
  username = slugify(username);
  if (username.length < 3) { showMessage('At least 3 characters (letters, numbers, underscores).', 'error'); return; }

  clearMessage();
  createBtn.disabled = true; createBtn.textContent = 'Creating...';

  try {
    const { data: { user }, error: userError } = await window.sb.auth.getUser();
    if (userError || !user) { showMessage('Session error. Redirecting...', 'error'); setTimeout(() => window.location.href = 'auth.html', 1500); return; }

    const { data: existing } = await window.sb.from('user_profiles').select('user_id').eq('user_id', user.id).single();
    if (existing) { window.location.href = 'quest-board.html'; return; }

    const googleName = user.user_metadata?.full_name || user.user_metadata?.name || '';
    const { error: insertError } = await window.sb.from('user_profiles').insert({
      user_id: user.id, username: username,
      display_name: displayName || googleName || username,
      reputation_score: 0, is_suspended: false
    });

    if (insertError) {
      if (insertError.code === '23505' || insertError.message.includes('unique') || insertError.message.includes('duplicate')) {
        showMessage('Username already taken. Try another.', 'error');
      } else { showMessage('Error: ' + insertError.message, 'error'); }
      createBtn.disabled = false; createBtn.textContent = 'Join the Guild';
      return;
    }

    showMessage('Welcome! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'quest-board.html', 1000);
  } catch (err) {
    showMessage('Something went wrong.', 'error');
    createBtn.disabled = false; createBtn.textContent = 'Join the Guild';
  }
}

(async function guard() {
  try {
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) { window.location.href = 'auth.html'; return; }
    const { data: profile } = await window.sb.from('user_profiles').select('user_id').eq('user_id', user.id).single();
    if (profile) window.location.href = 'quest-board.html';
  } catch (err) { console.error(err); }
})();
