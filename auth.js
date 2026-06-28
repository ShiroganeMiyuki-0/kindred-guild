// ============================================
// KINDRED GUILD — AUTH LOGIC
// ============================================
// Replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const emailInput = document.getElementById('email');
const otpInput = document.getElementById('otp');
const emailStep = document.getElementById('emailStep');
const otpStep = document.getElementById('otpStep');
const messageEl = document.getElementById('message');
const sendBtn = document.getElementById('sendOtpBtn');
const verifyBtn = document.getElementById('verifyOtpBtn');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + (type || 'info');
}

function clearMessage() {
  messageEl.className = 'message';
  messageEl.textContent = '';
}

async function sendOTP() {
  const email = emailInput.value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    showMessage('Please enter a valid email address.', 'error');
    return;
  }

  clearMessage();
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  const { error } = await supabase.auth.signInWithOtp({
    email: email,
    options: { shouldCreateUser: true }
  });

  sendBtn.disabled = false;
  sendBtn.textContent = 'Send Magic Code';

  if (error) {
    showMessage(error.message, 'error');
    return;
  }

  showMessage('Magic code sent! Check your email (and spam folder).', 'success');
  emailStep.classList.add('hidden');
  otpStep.classList.remove('hidden');
  otpInput.focus();
}

async function verifyOTP() {
  const email = emailInput.value.trim().toLowerCase();
  const token = otpInput.value.trim();

  if (!token || token.length !== 6) {
    showMessage('Please enter the 6-digit code from your email.', 'error');
    return;
  }

  clearMessage();
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';

  const { data, error } = await supabase.auth.verifyOtp({
    email: email,
    token: token,
    type: 'email'
  });

  verifyBtn.disabled = false;
  verifyBtn.textContent = 'Enter the Guild';

  if (error) {
    showMessage(error.message, 'error');
    return;
  }

  // Check if user has a profile (first-time vs returning)
  const user = data.user;
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('id', user.id)
    .single();

  if (profile) {
    // Returning user — go to quest board
    window.location.href = 'quest-board.html';
  } else {
    // First time — set up username
    window.location.href = 'username-setup.html';
  }
}

function backToEmail() {
  otpStep.classList.add('hidden');
  emailStep.classList.remove('hidden');
  clearMessage();
  otpInput.value = '';
}

// Check if already logged in on page load
(async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', session.user.id)
      .single();

    if (profile) {
      window.location.href = 'quest-board.html';
    } else {
      window.location.href = 'username-setup.html';
    }
  }
})();
