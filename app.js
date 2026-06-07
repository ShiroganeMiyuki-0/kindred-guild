const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GUILD_FEE_PERCENT = 10;
const ADMIN_EMAIL = 'yashwanthrangaswamy72@gmail.com';
const MIN_FAIRY_BALANCE = 0; // Minimum balance is 0, never negative
const SIGNUP_BONUS = 100;

let currentUser = null;
let quests = [];
let ratings = [];
let strikes = [];
let comments = [];
let fairyLedger = [];
let reports = [];
let fairyPurchases = [];
let userProfiles = [];
let currentFilter = 'all';
let currentTab = 'all';
let lastAuthAction = 'signin';
let authPollingInterval = null;
let resendCooldown = 0;

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupAuthStateListener();
    checkExistingSession();
});

function setupEventListeners() {
    // Auth buttons
    const btnSignUp = document.getElementById('btnSignUp');
    const btnSignIn = document.getElementById('btnSignIn');
    const btnSignOut = document.getElementById('btnSignOut');
    const btnShowSignUp = document.getElementById('btnShowSignUp');
    const btnShowSignIn = document.getElementById('btnShowSignIn');
    const btnBackToSignIn = document.getElementById('btnBackToSignIn');
    const btnSendCode = document.getElementById('btnSendCode');
    const btnResendCode = document.getElementById('btnResendCode');
    const btnVerifyEmail = document.getElementById('btnVerifyEmail');
    const btnOpenFairyShop = document.getElementById('btnOpenFairyShop');
    const btnCloseFairyShop = document.getElementById('btnCloseFairyShop');
    const btnBuyFairy = document.getElementById('btnBuyFairy');
    const btnCloseReport = document.getElementById('btnCloseReport');
    const btnSubmitReport = document.getElementById('btnSubmitReport');
    const btnCloseVerify = document.getElementById('btnCloseVerify');
    const btnConfirmWork = document.getElementById('btnConfirmWork');
    const btnConfirmPayment = document.getElementById('btnConfirmPayment');
    const btnRaiseDispute = document.getElementById('btnRaiseDispute');

    if (btnSignUp) btnSignUp.addEventListener('click', () => { lastAuthAction = 'signup'; signUp(); });
    if (btnSignIn) btnSignIn.addEventListener('click', () => { lastAuthAction = 'signin'; signIn(); });
    if (btnSignOut) btnSignOut.addEventListener('click', signOut);
    if (btnShowSignUp) btnShowSignUp.addEventListener('click', () => showAuthStep('signup'));
    if (btnShowSignIn) btnShowSignIn.addEventListener('click', () => showAuthStep('signin'));
    if (btnBackToSignIn) btnBackToSignIn.addEventListener('click', () => showAuthStep('signin'));
    if (btnSendCode) btnSendCode.addEventListener('click', sendVerificationEmail);
    if (btnResendCode) btnResendCode.addEventListener('click', resendVerificationEmail);
    if (btnVerifyEmail) btnVerifyEmail.addEventListener('click', checkEmailConfirmed);
    if (btnOpenFairyShop) btnOpenFairyShop.addEventListener('click', openFairyShop);
    if (btnCloseFairyShop) btnCloseFairyShop.addEventListener('click', closeFairyShop);
    if (btnBuyFairy) btnBuyFairy.addEventListener('click', buyFairyCoins);
    if (btnCloseReport) btnCloseReport.addEventListener('click', closeReportModal);
    if (btnSubmitReport) btnSubmitReport.addEventListener('click', submitReport);
    if (btnCloseVerify) btnCloseVerify.addEventListener('click', closeVerifyModal);
    if (btnConfirmWork) btnConfirmWork.addEventListener('click', () => confirmWorkReceived(currentVerifyQuestId));
    if (btnConfirmPayment) btnConfirmPayment.addEventListener('click', () => confirmPaymentReceived(currentVerifyQuestId));
    if (btnRaiseDispute) btnRaiseDispute.addEventListener('click', () => raiseDispute(currentVerifyQuestId));

    // Quest form
    const questForm = document.getElementById('questForm');
    if (questForm) questForm.addEventListener('submit', handleQuestSubmit);

    // Admin
    const adminToggle = document.getElementById('adminToggle');
    if (adminToggle) adminToggle.addEventListener('click', toggleAdmin);

    // Enter key handlers
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const authConfirmPassword = document.getElementById('authConfirmPassword');
    if (authEmail) authEmail.addEventListener('keypress', handleEnter);
    if (authPassword) authPassword.addEventListener('keypress', handleEnter);
    if (authConfirmPassword) authConfirmPassword.addEventListener('keypress', handleEnter);
}

function setupAuthStateListener() {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user ?? null;
        if (currentUser) {
            ensureSignupBonus();
            loadQuests();
        }
        updateUI();
    });
}

async function checkExistingSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        ensureSignupBonus();
        loadQuests();
        updateUI();
    }
}

// ─── Helpers ───
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setAuthLoading(isLoading, buttonId) {
    const btn = document.getElementById(buttonId);
    if (btn) {
        btn.disabled = isLoading;
        btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
        btn.textContent = isLoading ? '⚡ Processing...' : btn.dataset.originalText;
    }
    const allAuthBtns = ['btnSignUp', 'btnSignIn', 'btnSendCode', 'btnResendCode', 'btnVerifyEmail'];
    allAuthBtns.forEach(id => {
        const b = document.getElementById(id);
        if (b && b.id !== buttonId) b.disabled = isLoading;
    });
}

function showAuthStep(step) {
    const stepSignIn = document.getElementById('stepSignIn');
    const stepSignUp = document.getElementById('stepSignUp');
    const stepVerify = document.getElementById('stepVerify');
    const stepWelcome = document.getElementById('stepWelcome');
    const authModal = document.getElementById('authModal');
    const progressBar = document.getElementById('authProgressBar');

    if (authModal) authModal.style.display = 'flex';

    [stepSignIn, stepSignUp, stepVerify, stepWelcome].forEach(el => {
        if (el) el.style.display = 'none';
    });

    if (step === 'signin' && stepSignIn) {
        stepSignIn.style.display = 'block';
        if (progressBar) progressBar.style.width = '33%';
    } else if (step === 'signup' && stepSignUp) {
        stepSignUp.style.display = 'block';
        if (progressBar) progressBar.style.width = '33%';
    } else if (step === 'verify' && stepVerify) {
        stepVerify.style.display = 'block';
        if (progressBar) progressBar.style.width = '66%';
        startAuthPolling();
    } else if (step === 'welcome' && stepWelcome) {
        stepWelcome.style.display = 'block';
        if (progressBar) progressBar.style.width = '100%';
        stopAuthPolling();
    }
}

function closeAuthModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.style.display = 'none';
    stopAuthPolling();
}

function startAuthPolling() {
    stopAuthPolling();
    authPollingInterval = setInterval(async () => {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user && user.email_confirmed_at) {
            currentUser = user;
            showAuthStep('welcome');
            setTimeout(() => {
                closeAuthModal();
                ensureSignupBonus();
                loadQuests();
                updateUI();
            }, 2000);
        }
    }, 3000);
}

function stopAuthPolling() {
    if (authPollingInterval) {
        clearInterval(authPollingInterval);
        authPollingInterval = null;
    }
}

function handleEnter(event) {
    if (event.key === 'Enter') {
        const stepSignIn = document.getElementById('stepSignIn');
        const stepSignUp = document.getElementById('stepSignUp');
        if (stepSignUp && stepSignUp.style.display === 'block') {
            signUp();
        } else if (stepSignIn && stepSignIn.style.display === 'block') {
            signIn();
        }
    }
}

// ─── GAMING-STYLE SIGN UP WITH VERIFICATION ───
async function signUp() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const confirmPassword = document.getElementById('authConfirmPassword')?.value;

    if (!email || !password) {
        showAuthError('Please enter both email and password.');
        return;
    }
    if (!validateEmail(email)) {
        showAuthError('Please enter a valid email address (e.g., yourname@gmail.com).');
        return;
    }
    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters long.');
        return;
    }
    if (password.length > 72) {
        showAuthError('Password is too long. Please use 72 characters or less.');
        return;
    }
    if (confirmPassword && password !== confirmPassword) {
        showAuthError('Passwords do not match!');
        return;
    }

    setAuthLoading(true, 'btnSignUp');
    clearAuthError();

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin
            }
        });

        if (error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
                showAuthError('This email is already registered. Try logging in instead.');
            } else if (msg.includes('rate limit') || msg.includes('too many')) {
                showAuthError('Too many attempts. Please wait a minute and try again.');
            } else if (msg.includes('invalid') || msg.includes('valid email')) {
                showAuthError('Please enter a valid email address.');
            } else if (msg.includes('password')) {
                showAuthError('Password error: ' + error.message);
            } else {
                showAuthError('Signup error: ' + error.message);
            }
            return;
        }

        if (data.user && data.user.identities && data.user.identities.length === 0) {
            showAuthError('This email is already registered. Try logging in instead.');
            return;
        }

        // Show verification step
        showAuthStep('verify');
        startResendCooldown();

    } catch (err) {
        console.error('Signup exception:', err);
        showAuthError('Unexpected error. Please check your internet connection and try again.');
    } finally {
        setAuthLoading(false, 'btnSignUp');
    }
}

async function sendVerificationEmail() {
    const email = document.getElementById('authEmail').value.trim();
    if (!email || !validateEmail(email)) {
        showAuthError('Please enter a valid email first.');
        return;
    }
    // This is handled by signUp automatically, but we can resend
    await resendVerificationEmail();
}

async function resendVerificationEmail() {
    if (resendCooldown > 0) return;

    const email = document.getElementById('authEmail').value.trim();
    if (!email) return;

    setAuthLoading(true, 'btnResendCode');

    try {
        const { error } = await supabaseClient.auth.resend({
            type: 'signup',
            email: email,
            options: { emailRedirectTo: window.location.origin }
        });

        if (error) {
            showAuthError('Could not resend: ' + error.message);
        } else {
            showAuthSuccess('📧 Verification email resent! Check your inbox.');
            startResendCooldown();
        }
    } catch (err) {
        showAuthError('Failed to resend. Please try again.');
    } finally {
        setAuthLoading(false, 'btnResendCode');
    }
}

function startResendCooldown() {
    resendCooldown = 60;
    const btn = document.getElementById('btnResendCode');
    const countdownEl = document.getElementById('resendCountdown');

    if (countdownEl) countdownEl.style.display = 'inline';

    const interval = setInterval(() => {
        resendCooldown--;
        if (btn) btn.textContent = `Resend (${resendCooldown}s)`;
        if (countdownEl) countdownEl.textContent = `Resend available in ${resendCooldown}s`;

        if (resendCooldown <= 0) {
            clearInterval(interval);
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Resend Verification Email';
            }
            if (countdownEl) countdownEl.style.display = 'none';
        }
    }, 1000);

    if (btn) btn.disabled = true;
}

async function checkEmailConfirmed() {
    setAuthLoading(true, 'btnVerifyEmail');
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user && user.email_confirmed_at) {
            currentUser = user;
            showAuthStep('welcome');
            setTimeout(() => {
                closeAuthModal();
                ensureSignupBonus();
                loadQuests();
                updateUI();
            }, 2000);
        } else {
            showAuthError('Email not verified yet. Please check your inbox and click the confirmation link.');
        }
    } catch (err) {
        showAuthError('Error checking verification status.');
    } finally {
        setAuthLoading(false, 'btnVerifyEmail');
    }
}

// ─── SIGN IN ───
async function signIn() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!email || !password) {
        showAuthError('Enter email and password.');
        return;
    }
    if (!validateEmail(email)) {
        showAuthError('Please enter a valid email address.');
        return;
    }

    setAuthLoading(true, 'btnSignIn');
    clearAuthError();

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('wrong')) {
                showAuthError('Invalid email or password. Please check your credentials.');
            } else if (msg.includes('email not confirmed') || msg.includes('confirmed')) {
                showAuthError('Please verify your email first. Check your inbox for the confirmation link.');
                showAuthStep('verify');
                startResendCooldown();
            } else if (msg.includes('rate limit')) {
                showAuthError('Too many attempts. Please wait a minute.');
            } else {
                showAuthError('Login error: ' + error.message);
            }
            return;
        }

        closeAuthModal();
        ensureSignupBonus();
        loadQuests();
    } catch (err) {
        console.error('Login exception:', err);
        showAuthError('Unexpected error. Please check your internet connection.');
    } finally {
        setAuthLoading(false, 'btnSignIn');
    }
}

async function signOut() {
    await supabaseClient.auth.signOut();
    quests = []; ratings = []; strikes = []; comments = []; fairyLedger = [];
    reports = []; fairyPurchases = []; userProfiles = [];
    currentUser = null;
    updateUI();
    renderQuests();
}

function showAuthError(msg) {
    const el = document.getElementById('authError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function showAuthSuccess(msg) {
    const el = document.getElementById('authSuccess');
    if (el) { el.textContent = msg; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 5000); }
}

function clearAuthError() {
    const el = document.getElementById('authError');
    if (el) el.style.display = 'none';
}

// ─── FAIRY COIN SYSTEM ───
async function ensureSignupBonus() {
    if (!currentUser) return;

    // Check if user already received signup bonus
    const hasBonus = fairyLedger.some(t =>
        t.to_user === currentUser.id && t.type === 'signup_bonus'
    );

    if (!hasBonus) {
        try {
            const { error } = await supabaseClient.from('fairy_ledger').insert({
                from_user: null,
                to_user: currentUser.id,
                quest_id: null,
                amount: SIGNUP_BONUS,
                type: 'signup_bonus',
                description: 'Welcome bonus for joining the Guild!'
            });

            if (error) {
                console.error('Signup bonus error:', error);
            } else {
                // Refresh ledger
                await loadQuests();
                showToast('🎉 Welcome! You received 100 Fairy Coins!');
            }
        } catch (err) {
            console.error('Failed to grant signup bonus:', err);
        }
    }
}

function getFairyBalance(userId) {
    const userTransactions = fairyLedger.filter(t => t.from_user === userId || t.to_user === userId);
    return userTransactions.reduce((sum, t) => {
        if (t.to_user === userId) return sum + t.amount;
        if (t.from_user === userId) return sum - t.amount;
        return sum;
    }, 0);
}

function getFairyEscrow(userId) {
    // Calculate coins currently held in escrow (posted quests not yet completed)
    return quests.reduce((sum, q) => {
        if (q.posted_by === userId && q.status !== 'completed' && q.status !== 'cancelled' && q.fairy_coin_reward > 0) {
            return sum + q.fairy_coin_reward;
        }
        return sum;
    }, 0);
}

function getAvailableFairyBalance(userId) {
    return getFairyBalance(userId) - getFairyEscrow(userId);
}

function hasEnoughFairyCoins(userId, amount) {
    return getAvailableFairyBalance(userId) >= amount;
}

// ─── FAIRY COIN SHOP (UPI PURCHASE) ───
function openFairyShop() {
    const modal = document.getElementById('fairyShopModal');
    if (modal) modal.style.display = 'flex';
    updateFairyShopPreview();
}

function closeFairyShop() {
    const modal = document.getElementById('fairyShopModal');
    if (modal) modal.style.display = 'none';
}

function updateFairyShopPreview() {
    const select = document.getElementById('fairyPurchaseAmount');
    const preview = document.getElementById('fairyPurchasePreview');
    const upiId = document.getElementById('fairyShopUpiId');

    if (upiId) upiId.textContent = 'Pay to UPI: ' + ADMIN_EMAIL.replace('@gmail.com', '') + '@upi';

    if (select && preview) {
        const amount = parseInt(select.value) || 0;
        const price = amount; // 1 Fairy Coin = ₹1 for simplicity
        preview.innerHTML = `You will pay <strong>₹${price}</strong> via UPI to receive <strong>🧚 ${amount}</strong> Fairy Coins.`;
    }
}

async function buyFairyCoins() {
    if (!currentUser) { alert('Login first!'); return; }

    const amount = parseInt(document.getElementById('fairyPurchaseAmount')?.value) || 0;
    const upiTxnId = document.getElementById('fairyUpiTxnId')?.value.trim();
    const screenshotFile = document.getElementById('fairyPaymentScreenshot')?.files[0];

    if (amount <= 0) { alert('Select an amount to purchase.'); return; }
    if (!upiTxnId) { alert('Please enter the UPI Transaction ID after payment.'); return; }

    let evidenceUrl = '';
    if (screenshotFile) {
        try {
            const fileExt = screenshotFile.name.split('.').pop().toLowerCase();
            const fileName = `payment_${currentUser.id}_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabaseClient.storage
                .from('quest-images')
                .upload(fileName, screenshotFile, { cacheControl: '3600', upsert: false });

            if (!uploadError) {
                const { data: urlData } = supabaseClient.storage.from('quest-images').getPublicUrl(fileName);
                evidenceUrl = urlData?.publicUrl || '';
            }
        } catch (e) { console.error('Screenshot upload error:', e); }
    }

    try {
        const { error } = await supabaseClient.from('fairy_purchases').insert({
            user_id: currentUser.id,
            user_email: currentUser.email,
            amount: amount,
            upi_transaction_id: upiTxnId,
            status: 'pending',
            evidence_url: evidenceUrl
        });

        if (error) {
            alert('Error submitting purchase: ' + error.message);
            return;
        }

        closeFairyShop();
        alert('📧 Purchase request submitted! Admin will verify your UPI payment and credit Fairy Coins within 24 hours.');
        await loadQuests();
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    }
}

// ─── QUEST SUBMISSION WITH FAIRY COIN ESCROW ───
async function handleQuestSubmit(e) {
    e.preventDefault();
    if (!currentUser) { alert('Login first!'); return; }
    if (isBanned(currentUser.id)) { alert('🚫 Banned!'); return; }

    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const reward = Number(document.getElementById('reward').value) || 0;
    const fairyReward = Number(document.getElementById('fairyReward').value) || 0;
    const category = document.getElementById('category').value;
    const upiId = document.getElementById('upiId').value.trim();
    const deadlineVal = document.getElementById('deadline').value;
    const imageFile = document.getElementById('questImage').files[0];

    if (!title || !description) { alert('Fill in title and description'); return; }
    if (reward > 0 && !upiId) { alert('UPI ID required for paid quests'); return; }

    // ─── CRITICAL: Check Fairy Coin balance before posting ───
    if (fairyReward > 0) {
        const available = getAvailableFairyBalance(currentUser.id);
        if (available < fairyReward) {
            alert(`🚫 Not enough Fairy Coins!\nAvailable: ${available} 🧚\nRequired: ${fairyReward} 🧚\n\nYour balance: ${getFairyBalance(currentUser.id)}\nLocked in escrow: ${getFairyEscrow(currentUser.id)}\n\nComplete quests or buy coins to post this quest.`);
            return;
        }
    }

    let deadline = deadlineVal ? new Date(deadlineVal).toISOString() : null;
    let imageUrl = '';

    if (imageFile) {
        try {
            const fileExt = imageFile.name.split('.').pop().toLowerCase();
            const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabaseClient.storage
                .from('quest-images')
                .upload(fileName, imageFile, { cacheControl: '3600', upsert: false });

            if (uploadError) {
                alert('⚠️ Image upload failed: ' + uploadError.message + '\nQuest will be posted without image.');
            } else {
                const { data: urlData } = supabaseClient.storage.from('quest-images').getPublicUrl(fileName);
                imageUrl = urlData?.publicUrl || '';
            }
        } catch (uploadErr) {
            alert('⚠️ Image upload failed. Quest will be posted without image.');
        }
    }

    try {
        // Insert quest
        const { data: questData, error: questError } = await supabaseClient.from('quests').insert({
            title, description, reward, fairy_coin_reward: fairyReward, fee_percent: GUILD_FEE_PERCENT,
            status: 'pending', category, posted_by: currentUser.id, poster_email: currentUser.email,
            poster_upi: upiId, deadline, image_url: imageUrl,
            poster_confirmed_complete: false, acceptor_confirmed_complete: false, dispute_raised: false
        }).select().single();

        if (questError) {
            alert('Error posting quest: ' + questError.message);
            return;
        }

        // Deduct fairy coins immediately (escrow)
        if (fairyReward > 0) {
            const { error: ledgerError } = await supabaseClient.from('fairy_ledger').insert({
                from_user: currentUser.id,
                to_user: null, // Held in escrow by system
                quest_id: questData.id,
                amount: fairyReward,
                type: 'quest_escrow',
                description: `Escrow for quest: ${title}`
            });

            if (ledgerError) {
                console.error('Escrow error:', ledgerError);
                alert('⚠️ Quest posted but Fairy Coin escrow failed. Please contact admin.');
            }
        }

        questForm.reset();
        document.getElementById('reward').value = 0;
        document.getElementById('fairyReward').value = 0;
        document.getElementById('category').value = 'Misc';
        await loadQuests();
        showToast('✅ Quest posted successfully!');
    } catch (err) {
        alert('Unexpected error posting quest: ' + err.message);
    }
}

// ─── QUEST ACTIONS ───
async function acceptQuest(id) {
    if (!currentUser) return;
    if (isBanned(currentUser.id)) { alert('🚫 Banned!'); return; }
    try {
        const { error } = await supabaseClient.from('quests').update({
            status: 'accepted', accepted_by: currentUser.id, acceptor_email: currentUser.email
        }).eq('id', id);
        if (error) alert('Error: ' + error.message);
        else await loadQuests();
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    }
}

// ─── NEW: Complete Quest with Verification Flow ───
let currentVerifyQuestId = null;

async function completeQuest(id) {
    if (!currentUser) return;
    const quest = quests.find(q => q.id === id);
    if (!quest) return;
    if (quest.accepted_by !== currentUser.id) { alert('Only the acceptor can mark complete.'); return; }

    try {
        // Change status to pending_confirmation instead of completed
        const { error } = await supabaseClient.from('quests').update({
            status: 'pending_confirmation',
            completion_reported_at: new Date().toISOString()
        }).eq('id', id);

        if (error) {
            alert('Error: ' + error.message);
            return;
        }

        await loadQuests();
        showToast('✅ Completion reported! Waiting for poster confirmation.');
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    }
}

function openVerifyModal(questId) {
    currentVerifyQuestId = questId;
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    const modal = document.getElementById('verifyModal');
    const title = document.getElementById('verifyQuestTitle');
    const status = document.getElementById('verifyQuestStatus');
    const btnConfirmWork = document.getElementById('btnConfirmWork');
    const btnConfirmPayment = document.getElementById('btnConfirmPayment');
    const btnRaiseDispute = document.getElementById('btnRaiseDispute');

    if (title) title.textContent = quest.title;
    if (status) status.textContent = `Status: ${quest.status.replace('_', ' ').toUpperCase()}`;

    // Show/hide buttons based on role and status
    if (btnConfirmWork) {
        btnConfirmWork.style.display = (currentUser.id === quest.posted_by && quest.status === 'pending_confirmation') ? 'inline-block' : 'none';
    }
    if (btnConfirmPayment) {
        btnConfirmPayment.style.display = (currentUser.id === quest.accepted_by && quest.status === 'pending_confirmation' && quest.reward > 0) ? 'inline-block' : 'none';
    }
    if (btnRaiseDispute) {
        btnRaiseDispute.style.display = (currentUser.id === quest.posted_by || currentUser.id === quest.accepted_by) ? 'inline-block' : 'none';
    }

    if (modal) modal.style.display = 'flex';
}

function closeVerifyModal() {
    const modal = document.getElementById('verifyModal');
    if (modal) modal.style.display = 'none';
    currentVerifyQuestId = null;
}

async function confirmWorkReceived(questId) {
    if (!questId) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest || quest.posted_by !== currentUser.id) return;

    setLoading('btnConfirmWork', true);
    try {
        const { error } = await supabaseClient.from('quests').update({
            poster_confirmed_complete: true
        }).eq('id', questId);

        if (error) {
            alert('Error: ' + error.message);
            return;
        }

        await checkBothConfirmed(questId);
        closeVerifyModal();
        await loadQuests();
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    } finally {
        setLoading('btnConfirmWork', false);
    }
}

async function confirmPaymentReceived(questId) {
    if (!questId) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest || quest.accepted_by !== currentUser.id) return;

    setLoading('btnConfirmPayment', true);
    try {
        const { error } = await supabaseClient.from('quests').update({
            acceptor_confirmed_complete: true
        }).eq('id', questId);

        if (error) {
            alert('Error: ' + error.message);
            return;
        }

        await checkBothConfirmed(questId);
        closeVerifyModal();
        await loadQuests();
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    } finally {
        setLoading('btnConfirmPayment', false);
    }
}

async function checkBothConfirmed(questId) {
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    // If both parties confirmed (or no payment needed and poster confirmed), finalize
    const paymentConfirmed = quest.reward === 0 || quest.acceptor_confirmed_complete;
    const workConfirmed = quest.poster_confirmed_complete;

    if (workConfirmed && paymentConfirmed) {
        // Finalize quest
        await supabaseClient.from('quests').update({
            status: 'completed'
        }).eq('id', questId);

        // Transfer fairy coins to acceptor
        if (quest.fairy_coin_reward > 0 && quest.accepted_by) {
            await supabaseClient.from('fairy_ledger').insert({
                from_user: null, // From system escrow
                to_user: quest.accepted_by,
                quest_id: questId,
                amount: quest.fairy_coin_reward,
                type: 'quest_reward',
                description: `Reward for completing: ${quest.title}`
            });
        }

        showToast('🎉 Quest fully verified and completed! Fairy Coins transferred.');
    }
}

async function raiseDispute(questId) {
    if (!questId) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    const reason = prompt('Describe the issue (e.g., "Payment not received", "Work not done", "Rude behavior"):');
    if (!reason || !reason.trim()) return;

    try {
        const { error } = await supabaseClient.from('quests').update({
            dispute_raised: true,
            status: 'disputed'
        }).eq('id', questId);

        if (error) {
            alert('Error raising dispute: ' + error.message);
            return;
        }

        // Also create a report
        const reportedId = currentUser.id === quest.posted_by ? quest.accepted_by : quest.posted_by;
        await supabaseClient.from('reports').insert({
            quest_id: questId,
            reporter_id: currentUser.id,
            reported_id: reportedId,
            report_type: 'other',
            description: reason.trim()
        });

        closeVerifyModal();
        await loadQuests();
        alert('🚨 Dispute raised! Admin will review and resolve this. Funds are held safely until resolution.');
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    }
}

async function cancelQuest(id) {
    if (!currentUser) return;
    const quest = quests.find(q => q.id === id);
    if (!quest || quest.accepted_by !== currentUser.id) return;
    if (!confirm('Cancel this quest? It will return to pending status.')) return;

    try {
        // Refund fairy coins if in escrow
        if (quest.fairy_coin_reward > 0 && quest.posted_by) {
            await supabaseClient.from('fairy_ledger').insert({
                from_user: null,
                to_user: quest.posted_by,
                quest_id: quest.id,
                amount: quest.fairy_coin_reward,
                type: 'quest_refund',
                description: `Refund for cancelled quest: ${quest.title}`
            });
        }

        const { error } = await supabaseClient.from('quests').update({
            status: 'pending', accepted_by: null, acceptor_email: null,
            poster_confirmed_complete: false, acceptor_confirmed_complete: false
        }).eq('id', id);

        if (error) alert('Error: ' + error.message);
        else await loadQuests();
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    }
}

async function deleteQuest(id) {
    if (!currentUser) return;
    const quest = quests.find(q => q.id === id);
    if (!quest || quest.posted_by !== currentUser.id) return;
    if (!confirm('Delete forever?')) return;

    try {
        // Refund fairy coins if quest pending and has escrow
        if (quest.fairy_coin_reward > 0 && quest.status === 'pending') {
            await supabaseClient.from('fairy_ledger').insert({
                from_user: null,
                to_user: quest.posted_by,
                quest_id: quest.id,
                amount: quest.fairy_coin_reward,
                type: 'quest_refund',
                description: `Refund for deleted quest: ${quest.title}`
            });
        }

        const { error } = await supabaseClient.from('quests').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else await loadQuests();
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    }
}

async function confirmPayment(questId, field) {
    if (!currentUser) return;
    if (!['poster_paid', 'acceptor_received'].includes(field)) return;
    const updateObj = {}; updateObj[field] = true;
    try {
        const { error } = await supabaseClient.from('quests').update(updateObj).eq('id', questId);
        if (error) alert('Error: ' + error.message);
        else await loadQuests();
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    }
}

// ─── REPORT SYSTEM ───
let currentReportQuestId = null;

function openReportModal(questId) {
    currentReportQuestId = questId;
    const modal = document.getElementById('reportModal');
    if (modal) modal.style.display = 'flex';
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) modal.style.display = 'none';
    currentReportQuestId = null;
}

async function submitReport() {
    if (!currentReportQuestId || !currentUser) return;

    const type = document.getElementById('reportType')?.value;
    const description = document.getElementById('reportDescription')?.value.trim();
    const evidenceFile = document.getElementById('reportEvidence')?.files[0];

    if (!description) { alert('Please describe the issue.'); return; }

    const quest = quests.find(q => q.id === currentReportQuestId);
    if (!quest) return;

    let evidenceUrl = '';
    if (evidenceFile) {
        try {
            const fileExt = evidenceFile.name.split('.').pop().toLowerCase();
            const fileName = `report_${currentUser.id}_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabaseClient.storage
                .from('quest-images')
                .upload(fileName, evidenceFile, { cacheControl: '3600', upsert: false });

            if (!uploadError) {
                const { data: urlData } = supabaseClient.storage.from('quest-images').getPublicUrl(fileName);
                evidenceUrl = urlData?.publicUrl || '';
            }
        } catch (e) { console.error('Evidence upload error:', e); }
    }

    const reportedId = currentUser.id === quest.posted_by ? quest.accepted_by : quest.posted_by;

    try {
        const { error } = await supabaseClient.from('reports').insert({
            quest_id: currentReportQuestId,
            reporter_id: currentUser.id,
            reported_id: reportedId,
            report_type: type || 'other',
            description: description,
            evidence_urls: evidenceUrl ? [evidenceUrl] : []
        });

        if (error) {
            alert('Error submitting report: ' + error.message);
            return;
        }

        closeReportModal();
        await loadQuests();
        alert('🚨 Report submitted! Admin will review this issue.');
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    }
}

// ─── RATING & STRIKES ───
async function submitRating(questId, toUser, toEmail, ratingValue) {
    if (!currentUser) return;
    try {
        const { error } = await supabaseClient.from('ratings').insert({
            quest_id: questId, from_user: currentUser.id, to_user: toUser,
            from_email: currentUser.email, to_email: toEmail, rating: ratingValue
        });
        if (error) alert('Error: ' + error.message);
        else await loadQuests();
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    }
}

async function addStrike(userId, userEmail, questId, reason) {
    if (!currentUser) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest || currentUser.id !== quest.accepted_by || quest.posted_by !== userId) return;
    try {
        const { error } = await supabaseClient.from('strikes').insert({
            user_id: userId, user_email: userEmail, quest_id: questId, reason: reason
        });
        if (error) alert('Error: ' + error.message);
        else { alert('Strike added!'); await loadQuests(); }
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    }
}

async function sendComment(questId, message) {
    if (!currentUser || !message.trim()) return;
    try {
        const { error } = await supabaseClient.from('comments').insert({
            quest_id: questId, user_id: currentUser.id, user_email: currentUser.email, message: message.trim()
        });
        if (error) alert('Error sending comment: ' + error.message);
        else await loadQuests();
    } catch (err) {
        alert('Unexpected error: ' + err.message);
    }
}

// ─── UI HELPERS ───
function getRankInfo(count) {
    if (count >= 50) return { rank: 'S-Rank', color: '#ff6b35', bg: '#ff6b3522' };
    if (count >= 30) return { rank: 'A-Rank', color: '#ffd700', bg: '#ffd70022' };
    if (count >= 15) return { rank: 'B-Rank', color: '#6b8cff', bg: '#6b8cff22' };
    if (count >= 5) return { rank: 'C-Rank', color: '#cd7f32', bg: '#cd7f3222' };
    return { rank: 'D-Rank', color: '#888', bg: '#88888822' };
}

function getUserRating(userId) {
    const userRatings = ratings.filter(r => r.to_user === userId);
    if (userRatings.length === 0) return null;
    return (userRatings.reduce((sum, r) => sum + r.rating, 0) / userRatings.length).toFixed(1);
}

function getUserStrikes(userId) {
    return strikes.filter(s => s.user_id === userId && !s.resolved).length;
}

function hasRated(questId, toUserId) {
    return ratings.some(r => r.quest_id === questId && r.from_user === currentUser?.id && r.to_user === toUserId);
}

function isBanned(userId) { return getUserStrikes(userId) >= 3; }

function isAdmin() {
    return currentUser?.email === ADMIN_EMAIL;
}

function setLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.disabled = isLoading;
        btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
        btn.textContent = isLoading ? 'Processing...' : btn.dataset.originalText;
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.style.display = 'block';
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.style.display = 'none', 300);
        }, 4000);
    }
}

// ─── MAIN UI UPDATE ───
function updateUI() {
    const navAuth = document.getElementById('navAuth');
    const userBar = document.getElementById('userBar');
    const questBoard = document.getElementById('questBoard');
    const lockedMessage = document.getElementById('lockedMessage');
    const sidebar = document.getElementById('sidebar');

    if (currentUser) {
        if (navAuth) navAuth.style.display = 'none';
        if (userBar) userBar.style.display = 'flex';
        if (questBoard) questBoard.style.display = 'block';
        if (lockedMessage) lockedMessage.style.display = 'none';
        if (sidebar) sidebar.style.display = 'flex';

        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.textContent = currentUser.email;

        const completed = quests.filter(q => q.accepted_by === currentUser.id && q.status === 'completed').length;
        const info = getRankInfo(completed);
        const badge = document.getElementById('userRank');
        if (badge) {
            badge.textContent = info.rank;
            badge.style.background = info.bg;
            badge.style.color = info.color;
        }

        const avg = getUserRating(currentUser.id);
        const userRating = document.getElementById('userRating');
        if (userRating) userRating.textContent = avg ? `${avg} ⭐` : '';

        const fairyBalance = getFairyBalance(currentUser.id);
        const fairyEscrow = getFairyEscrow(currentUser.id);
        const fairyBadge = document.getElementById('userFairy');
        if (fairyBadge) {
            fairyBadge.textContent = `🧚 ${fairyBalance}`;
            fairyBadge.style.display = 'inline';
            fairyBadge.title = `Available: ${getAvailableFairyBalance(currentUser.id)} | Locked: ${fairyEscrow}`;
        }

        const strikeCount = getUserStrikes(currentUser.id);
        const strikeBadge = document.getElementById('userStrikes');
        if (strikeBadge) {
            if (strikeCount > 0) {
                strikeBadge.textContent = `${strikeCount} STRIKES`;
                strikeBadge.style.display = 'inline';
            } else {
                strikeBadge.style.display = 'none';
            }
        }

        const adminToggle = document.getElementById('adminToggle');
        if (isAdmin()) {
            if (adminToggle) adminToggle.style.display = 'block';
            updateAdminPanel();
        } else {
            if (adminToggle) adminToggle.style.display = 'none';
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel) adminPanel.style.display = 'none';
        }

        if (isBanned(currentUser.id)) {
            alert('🚫 You are banned! 3+ unpaid quests.');
            signOut();
        }
    } else {
        if (navAuth) navAuth.style.display = 'flex';
        if (userBar) userBar.style.display = 'none';
        if (questBoard) questBoard.style.display = 'none';
        if (lockedMessage) lockedMessage.style.display = 'block';
        if (sidebar) sidebar.style.display = 'none';
        const adminToggle = document.getElementById('adminToggle');
        if (adminToggle) adminToggle.style.display = 'none';
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) adminPanel.style.display = 'none';
    }
}

function toggleAdmin() {
    const panel = document.getElementById('adminPanel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (panel.style.display === 'block') updateAdminPanel();
    }
}

function updateAdminPanel() {
    const totalRevenue = quests
        .filter(q => q.status === 'completed' && q.reward > 0)
        .reduce((sum, q) => sum + (q.reward * (GUILD_FEE_PERCENT / 100)), 0);

    const uniqueUsers = new Set();
    quests.forEach(q => { if (q.posted_by) uniqueUsers.add(q.posted_by); if (q.accepted_by) uniqueUsers.add(q.accepted_by); });

    const pendingPayments = quests.filter(q => q.status === 'completed' && q.reward > 0 && (!q.poster_paid || !q.acceptor_received)).length;
    const totalCoins = fairyLedger.reduce((sum, t) => { if (t.to_user && t.amount > 0) return sum + t.amount; return sum; }, 0);
    const disputedQuests = quests.filter(q => q.status === 'disputed').length;
    const pendingPurchases = fairyPurchases.filter(p => p.status === 'pending').length;
    const pendingReports = reports.filter(r => r.status === 'pending').length;

    const adminRevenue = document.getElementById('adminRevenue');
    const adminUsers = document.getElementById('adminUsers');
    const adminTotalQuests = document.getElementById('adminTotalQuests');
    const adminPending = document.getElementById('adminPending');
    const adminCoins = document.getElementById('adminCoins');
    const adminDisputed = document.getElementById('adminDisputed');
    const adminPurchases = document.getElementById('adminPurchases');
    const adminReports = document.getElementById('adminReports');

    if (adminRevenue) adminRevenue.textContent = '₹ ' + Math.round(totalRevenue).toLocaleString('en-IN');
    if (adminUsers) adminUsers.textContent = uniqueUsers.size;
    if (adminTotalQuests) adminTotalQuests.textContent = quests.length;
    if (adminPending) adminPending.textContent = pendingPayments;
    if (adminCoins) adminCoins.textContent = totalCoins;
    if (adminDisputed) adminDisputed.textContent = disputedQuests;
    if (adminPurchases) adminPurchases.textContent = pendingPurchases;
    if (adminReports) adminReports.textContent = pendingReports;

    // Render admin tables
    renderAdminPurchases();
    renderAdminReports();
    renderAdminDisputes();
}

function renderAdminPurchases() {
    const container = document.getElementById('adminPurchasesTable');
    if (!container) return;
    const pending = fairyPurchases.filter(p => p.status === 'pending');
    if (pending.length === 0) { container.innerHTML = '<p>No pending purchases.</p>'; return; }

    let html = '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;"><tr style="background:var(--card);"><th>User</th><th>Amount</th><th>UPI TXN</th><th>Evidence</th><th>Action</th></tr>';
    pending.forEach(p => {
        html += `<tr>
            <td>${p.user_email}</td>
            <td>🧚 ${p.amount}</td>
            <td>${p.upi_transaction_id || 'N/A'}</td>
            <td>${p.evidence_url ? `<a href="${p.evidence_url}" target="_blank">View</a>` : 'None'}</td>
            <td><button onclick="confirmPurchase('${p.id}', ${p.amount}, '${p.user_id}')">Confirm</button> <button onclick="rejectPurchase('${p.id}')">Reject</button></td>
        </tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
}

function renderAdminReports() {
    const container = document.getElementById('adminReportsTable');
    if (!container) return;
    const pending = reports.filter(r => r.status === 'pending');
    if (pending.length === 0) { container.innerHTML = '<p>No pending reports.</p>'; return; }

    let html = '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;"><tr style="background:var(--card);"><th>Quest</th><th>Reporter</th><th>Reported</th><th>Type</th><th>Description</th><th>Evidence</th><th>Action</th></tr>';
    pending.forEach(r => {
        const quest = quests.find(q => q.id === r.quest_id);
        html += `<tr>
            <td>${quest ? quest.title : 'Unknown'}</td>
            <td>${r.reporter_id}</td>
            <td>${r.reported_id}</td>
            <td>${r.report_type}</td>
            <td>${r.description}</td>
            <td>${r.evidence_urls && r.evidence_urls.length ? `<a href="${r.evidence_urls[0]}" target="_blank">View</a>` : 'None'}</td>
            <td><button onclick="resolveReport('${r.id}', 'resolved_poster')">Favor Poster</button> <button onclick="resolveReport('${r.id}', 'resolved_acceptor')">Favor Acceptor</button> <button onclick="resolveReport('${r.id}', 'dismissed')">Dismiss</button></td>
        </tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
}

function renderAdminDisputes() {
    const container = document.getElementById('adminDisputesTable');
    if (!container) return;
    const disputed = quests.filter(q => q.status === 'disputed');
    if (disputed.length === 0) { container.innerHTML = '<p>No disputed quests.</p>'; return; }

    let html = '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;"><tr style="background:var(--card);"><th>Title</th><th>Poster</th><th>Acceptor</th><th>Fairy Reward</th><th>Action</th></tr>';
    disputed.forEach(q => {
        html += `<tr>
            <td>${q.title}</td>
            <td>${q.poster_email}</td>
            <td>${q.acceptor_email || 'N/A'}</td>
            <td>🧚 ${q.fairy_coin_reward}</td>
            <td><button onclick="resolveDispute('${q.id}', 'poster')">Refund Poster</button> <button onclick="resolveDispute('${q.id}', 'acceptor')">Pay Acceptor</button></td>
        </tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
}

// ─── ADMIN ACTIONS ───
async function confirmPurchase(purchaseId, amount, userId) {
    if (!isAdmin()) return;
    try {
        await supabaseClient.from('fairy_purchases').update({ status: 'confirmed' }).eq('id', purchaseId);
        await supabaseClient.from('fairy_ledger').insert({
            from_user: null,
            to_user: userId,
            amount: amount,
            type: 'purchase',
            description: 'Fairy Coin purchase via UPI'
        });
        await loadQuests();
        alert('✅ Purchase confirmed and coins credited!');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function rejectPurchase(purchaseId) {
    if (!isAdmin()) return;
    try {
        await supabaseClient.from('fairy_purchases').update({ status: 'rejected' }).eq('id', purchaseId);
        await loadQuests();
        alert('❌ Purchase rejected.');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function resolveReport(reportId, resolution) {
    if (!isAdmin()) return;
    try {
        await supabaseClient.from('reports').update({ status: resolution }).eq('id', reportId);
        await loadQuests();
        alert('Report resolved: ' + resolution);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function resolveDispute(questId, favor) {
    if (!isAdmin()) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    try {
        if (favor === 'poster' && quest.posted_by) {
            // Refund poster
            if (quest.fairy_coin_reward > 0) {
                await supabaseClient.from('fairy_ledger').insert({
                    from_user: null,
                    to_user: quest.posted_by,
                    quest_id: questId,
                    amount: quest.fairy_coin_reward,
                    type: 'dispute_refund',
                    description: `Dispute resolved in favor of poster: ${quest.title}`
                });
            }
        } else if (favor === 'acceptor' && quest.accepted_by) {
            // Pay acceptor
            if (quest.fairy_coin_reward > 0) {
                await supabaseClient.from('fairy_ledger').insert({
                    from_user: null,
                    to_user: quest.accepted_by,
                    quest_id: questId,
                    amount: quest.fairy_coin_reward,
                    type: 'dispute_payout',
                    description: `Dispute resolved in favor of acceptor: ${quest.title}`
                });
            }
        }

        await supabaseClient.from('quests').update({ status: 'completed', dispute_raised: false }).eq('id', questId);
        await loadQuests();
        alert(`✅ Dispute resolved in favor of ${favor}!`);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ─── DATA LOADING ───
async function loadQuests() {
    try {
        const [
            { data: questData, error: qErr },
            { data: ratingData, error: rErr },
            { data: strikeData, error: sErr },
            { data: commentData, error: cErr },
            { data: ledgerData, error: lErr },
            { data: reportData, error: repErr },
            { data: purchaseData, error: purErr },
            { data: profileData, error: profErr }
        ] = await Promise.all([
            supabaseClient.from('quests').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('ratings').select('*'),
            supabaseClient.from('strikes').select('*'),
            supabaseClient.from('comments').select('*').order('created_at', { ascending: true }),
            supabaseClient.from('fairy_ledger').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('reports').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('fairy_purchases').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('user_profiles').select('*')
        ]);

        if (qErr) console.error('Quests error:', qErr);
        if (rErr) console.error('Ratings error:', rErr);
        if (sErr) console.error('Strikes error:', sErr);
        if (cErr) console.error('Comments error:', cErr);
        if (lErr) console.error('Ledger error:', lErr);
        if (repErr) console.error('Reports error:', repErr);
        if (purErr) console.error('Purchases error:', purErr);
        if (profErr) console.error('Profiles error:', profErr);

        quests = questData || [];
        ratings = ratingData || [];
        strikes = strikeData || [];
        comments = commentData || [];
        fairyLedger = ledgerData || [];
        reports = reportData || [];
        fairyPurchases = purchaseData || [];
        userProfiles = profileData || [];

        updateUI();
        renderQuests();
    } catch (err) {
        console.error('Error loading quests:', err);
    }
}

// ─── REALTIME SUBSCRIPTIONS ───
['quests', 'ratings', 'strikes', 'comments', 'fairy_ledger', 'reports', 'fairy_purchases'].forEach(table => {
    supabaseClient.channel(`public:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => loadQuests())
        .subscribe();
});

// ─── RENDER QUEST CARDS ───
function renderQuests() {
    const list = document.getElementById('questList');
    if (!list) return;
    list.innerHTML = '';

    let display = quests;
    if (currentTab === 'posted') display = display.filter(q => q.posted_by === currentUser?.id);
    else if (currentTab === 'accepted') display = display.filter(q => q.accepted_by === currentUser?.id);
    if (currentFilter !== 'all') display = display.filter(q => q.category === currentFilter);

    if (display.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:var(--muted);padding:2rem;">No quests here.</p>';
        computeStats(display);
        return;
    }

    display.forEach(quest => {
        const node = document.getElementById('questTemplate')?.content?.cloneNode(true);
        if (!node) return;

        const card = node.querySelector('.quest-card');
        if (!card) return;
        card.dataset.questId = quest.id;

        // Image
        const img = card.querySelector('.quest-image');
        if (img && quest.image_url) {
            img.src = quest.image_url;
            img.classList.add('visible');
            img.onerror = () => { img.classList.remove('visible'); img.style.display = 'none'; };
        }

        // Status badge
        const statusBadge = card.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.className = `status-badge status-${quest.status}`;
            statusBadge.textContent = quest.status.replace('_', ' ');
        }

        const catBadge = card.querySelector('.cat-badge');
        if (catBadge) catBadge.textContent = quest.category || 'Misc';

        const titleEl = card.querySelector('.quest-title');
        if (titleEl) titleEl.textContent = quest.title;

        const deadlineEl = card.querySelector('.deadline-display');
        if (deadlineEl) {
            if (quest.deadline) deadlineEl.innerHTML = formatDeadline(quest.deadline);
            else deadlineEl.style.display = 'none';
        }

        const descEl = card.querySelector('.quest-desc');
        if (descEl) descEl.textContent = quest.description;

        const rewardTag = card.querySelector('.reward-tag');
        const fairyTag = card.querySelector('.fairy-tag');

        if (rewardTag) {
            if (quest.reward > 0) {
                rewardTag.textContent = `₹ ${quest.reward} • ${GUILD_FEE_PERCENT}% fee`;
                rewardTag.classList.remove('free');
            } else {
                rewardTag.textContent = 'FREE QUEST';
                rewardTag.classList.add('free');
            }
        }

        if (fairyTag) {
            if (quest.fairy_coin_reward > 0) {
                fairyTag.textContent = `+🧚 ${quest.fairy_coin_reward}`;
                fairyTag.style.display = 'inline';
            } else {
                fairyTag.style.display = 'none';
            }
        }

        const posterEl = card.querySelector('.poster-email');
        if (posterEl) posterEl.textContent = quest.poster_email || 'Unknown';

        // ─── Buttons ───
        const acceptBtn = card.querySelector('.btn-accept');
        const completeBtn = card.querySelector('.btn-complete');
        const cancelBtn = card.querySelector('.btn-cancel');
        const deleteBtn = card.querySelector('.btn-delete');
        const verifyBtn = card.querySelector('.btn-verify');

        if (acceptBtn) {
            if (quest.status !== 'pending' || quest.posted_by === currentUser?.id) {
                acceptBtn.style.display = 'none';
            } else {
                acceptBtn.addEventListener('click', () => acceptQuest(quest.id));
            }
        }

        if (completeBtn) {
            if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) {
                completeBtn.style.display = 'none';
            } else {
                completeBtn.addEventListener('click', () => completeQuest(quest.id));
            }
        }

        if (cancelBtn) {
            if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) {
                cancelBtn.style.display = 'none';
            } else {
                cancelBtn.addEventListener('click', () => cancelQuest(quest.id));
            }
        }

        if (deleteBtn) {
            if (quest.posted_by !== currentUser?.id || quest.status === 'accepted') {
                deleteBtn.style.display = 'none';
            } else {
                deleteBtn.addEventListener('click', () => deleteQuest(quest.id));
            }
        }

        // NEW: Verify button for pending_confirmation or disputed
        if (verifyBtn) {
            const showVerify = (quest.status === 'pending_confirmation' || quest.status === 'disputed') &&
                (currentUser?.id === quest.posted_by || currentUser?.id === quest.accepted_by);
            if (showVerify) {
                verifyBtn.style.display = 'inline-block';
                verifyBtn.textContent = quest.status === 'disputed' ? '🔍 View Dispute' : '🔍 Verify Completion';
                verifyBtn.addEventListener('click', () => openVerifyModal(quest.id));
            } else {
                verifyBtn.style.display = 'none';
            }
        }

        // ─── Payment section for paid quests ───
        const paymentSection = card.querySelector('.payment-section');
        if (paymentSection && quest.reward > 0) {
            const fee = Math.round(quest.reward * (GUILD_FEE_PERCENT / 100));
            const net = quest.reward - fee;

            const paymentInfo = document.createElement('div');
            paymentInfo.style.cssText = 'background:var(--accent-glow); border:1px solid var(--accent); border-radius:8px; padding:0.75rem; margin:0.5rem 0; font-size:0.85rem;';
            paymentInfo.innerHTML = `
                <strong>💰 Payment Info</strong><br>
                Total: ₹${quest.reward} | Guild Fee (${GUILD_FEE_PERCENT}%): ₹${fee} | Net: ₹${net}
                ${quest.poster_upi ? `<br>Poster UPI: ${quest.poster_upi}` : ''}
            `;
            paymentSection.appendChild(paymentInfo);

            if (currentUser && (currentUser.id === quest.posted_by || currentUser.id === quest.accepted_by) && quest.status === 'completed') {
                if (!quest.poster_paid && currentUser.id === quest.posted_by) {
                    paymentSection.appendChild(createPaymentCheckbox('I have paid ₹' + quest.reward + ' to the acceptor', () => confirmPayment(quest.id, 'poster_paid')));
                }
                if (quest.poster_paid) {
                    paymentSection.appendChild(createPaymentStatus('✅ Poster has paid'));
                }
                if (!quest.acceptor_received && currentUser.id === quest.accepted_by) {
                    paymentSection.appendChild(createPaymentCheckbox('I have received ₹' + net + ' (after guild fee)', () => confirmPayment(quest.id, 'acceptor_received')));
                }
                if (quest.acceptor_received) {
                    paymentSection.appendChild(createPaymentStatus('✅ Acceptor has received payment'));
                }
            }
        }

        // ─── Comments ───
        const commentSection = card.querySelector('.comment-section');
        const commentList = card.querySelector('.comment-list');
        const sendCommentBtn = card.querySelector('.send-comment');
        const commentInput = card.querySelector('.comment-field');

        if (commentSection && commentList) {
            if (currentUser) commentSection.style.display = 'block';

            const questComments = comments.filter(c => c.quest_id === quest.id);
            if (questComments.length === 0) {
                commentList.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">No comments yet. Be the first to comment!</p>';
            } else {
                commentList.innerHTML = '';
                questComments.forEach(comment => {
                    const commentEl = document.createElement('div');
                    commentEl.style.cssText = 'padding:0.5rem; margin:0.25rem 0; background:var(--surface-hover); border-radius:8px; font-size:0.85rem;';
                    const timeAgo = comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Just now';
                    commentEl.innerHTML = `<strong>${comment.user_email || 'Anonymous'}</strong> <span style="color:var(--muted);font-size:0.75rem;">${timeAgo}</span><br>${escapeHtml(comment.message)}`;
                    commentList.appendChild(commentEl);
                });
            }

            if (sendCommentBtn && commentInput) {
                sendCommentBtn.addEventListener('click', () => {
                    const msg = commentInput.value.trim();
                    if (msg) { sendComment(quest.id, msg); commentInput.value = ''; }
                });
            }
        }

        // ─── Rating section ───
        if (quest.status === 'completed' && currentUser) {
            const extras = card.querySelector('.extras');
            if (extras) {
                const canRatePoster = currentUser.id === quest.accepted_by && quest.posted_by && !hasRated(quest.id, quest.posted_by);
                const canRateAcceptor = currentUser.id === quest.posted_by && quest.accepted_by && !hasRated(quest.id, quest.accepted_by);

                if (canRatePoster || canRateAcceptor) {
                    const ratingDiv = document.createElement('div');
                    ratingDiv.style.cssText = 'margin-top:0.75rem; padding:0.75rem; background:var(--surface-hover); border-radius:8px;';
                    ratingDiv.innerHTML = '<strong>⭐ Rate this quest</strong><br>';

                    if (canRatePoster) ratingDiv.appendChild(createRatingRow(quest.id, quest.posted_by, quest.poster_email, 'Rate Poster'));
                    if (canRateAcceptor) ratingDiv.appendChild(createRatingRow(quest.id, quest.accepted_by, quest.acceptor_email, 'Rate Acceptor'));
                    extras.appendChild(ratingDiv);
                }
            }
        }

        // ─── Strike & Report buttons ───
        if ((quest.status === 'completed' || quest.status === 'pending_confirmation') && currentUser &&
            (currentUser.id === quest.accepted_by || currentUser.id === quest.posted_by)) {
            const extras = card.querySelector('.extras');
            if (extras) {
                const actionDiv = document.createElement('div');
                actionDiv.style.cssText = 'margin-top:0.5rem; display:flex; gap:0.5rem; flex-wrap:wrap;';

                if (currentUser.id === quest.accepted_by && quest.posted_by) {
                    const strikeBtn = document.createElement('button');
                    strikeBtn.className = 'btn btn-ghost btn-sm';
                    strikeBtn.textContent = '🚨 Strike Poster';
                    strikeBtn.style.cssText = 'color:var(--danger); border-color:var(--danger); font-size:0.8rem;';
                    strikeBtn.addEventListener('click', () => {
                        const reason = prompt('Why are you giving a strike? (e.g., "Did not pay", "Rude behavior")');
                        if (reason && reason.trim()) addStrike(quest.posted_by, quest.poster_email, quest.id, reason.trim());
                    });
                    actionDiv.appendChild(strikeBtn);
                }

                const reportBtn = document.createElement('button');
                reportBtn.className = 'btn btn-ghost btn-sm';
                reportBtn.textContent = '📋 Report Issue';
                reportBtn.style.cssText = 'color:var(--warning); border-color:var(--warning); font-size:0.8rem;';
                reportBtn.addEventListener('click', () => openReportModal(quest.id));
                actionDiv.appendChild(reportBtn);

                extras.appendChild(actionDiv);
            }
        }

        list.appendChild(card);
    });

    computeStats(display);
}

function createPaymentCheckbox(labelText, onChange) {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex; align-items:center; gap:0.5rem; margin:0.25rem 0; cursor:pointer; color:var(--text-muted); font-size:0.9rem;';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', onChange);
    label.append(checkbox, document.createTextNode(` ${labelText}`));
    return label;
}

function createPaymentStatus(text) {
    const status = document.createElement('div');
    status.style.cssText = 'color:var(--success); font-size:0.9rem;';
    status.textContent = text;
    return status;
}

function createRatingRow(questId, toUserId, toEmail, label) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:0.5rem; margin:0.25rem 0; flex-wrap:wrap;';
    row.innerHTML = `${label}:`;

    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('button');
        star.textContent = '⭐';
        star.style.cssText = 'background:none; border:none; cursor:pointer; font-size:1rem; padding:0.1rem; opacity:0.5; transition:opacity 0.2s;';
        star.addEventListener('mouseenter', () => {
            Array.from(row.querySelectorAll('button')).forEach((s, idx) => { s.style.opacity = idx < i ? '1' : '0.5'; });
        });
        star.addEventListener('mouseleave', () => {
            Array.from(row.querySelectorAll('button')).forEach(s => s.style.opacity = '0.5');
        });
        star.addEventListener('click', () => submitRating(questId, toUserId, toEmail, i));
        row.appendChild(star);
    }
    return row;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDeadline(deadlineStr) {
    if (!deadlineStr) return '';
    const d = new Date(deadlineStr);
    const now = new Date();
    const diff = d - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (diff < 0) return `⏰ OVERDUE by ${Math.abs(hours)}h`;
    if (hours < 24) return `⏰ Due in ${hours}h`;
    return `⏰ Due in ${Math.floor(hours/24)}d`;
}

function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-item').forEach(btn => {
        const text = btn.textContent.toLowerCase();
        btn.classList.toggle('active', (filter === 'all' && text.includes('all') && !text.includes('my')) || text.includes(filter.toLowerCase()));
    });
    renderQuests();
}

function setTab(tab) {
    currentTab = tab;
    renderQuests();
}

function computeStats(displayQuests) {
    const total = quests.length;
    const paid = quests.filter(q => q.reward > 0).length;
    const completed = quests.filter(q => q.status === 'completed').length;

    const totalEl = document.getElementById('totalQuests');
    const paidEl = document.getElementById('paidQuests');
    const completedEl = document.getElementById('completedQuests');

    if (totalEl) totalEl.textContent = total;
    if (paidEl) paidEl.textContent = paid;
    if (completedEl) completedEl.textContent = completed;
}
