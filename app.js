const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GUILD_FEE_PERCENT = 10;
const ADMIN_EMAIL = 'yashwanthrangaswamy72@gmail.com';
const MIN_FAIRY_BALANCE = 0; 
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

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupAuthStateListener();
    checkExistingSession();
});

function setupEventListeners() {
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

    const questForm = document.getElementById('questForm');
    if (questForm) questForm.addEventListener('submit', handleQuestSubmit);

    const adminToggle = document.getElementById('adminToggle');
    if (adminToggle) adminToggle.addEventListener('click', toggleAdmin);

    const signInEmail = document.getElementById('signInEmail');
    const signInPassword = document.getElementById('signInPassword');
    const signUpEmail = document.getElementById('signUpEmail');
    const signUpPassword = document.getElementById('signUpPassword');
    const signUpConfirmPassword = document.getElementById('signUpConfirmPassword');

    if (signInEmail) signInEmail.addEventListener('keypress', handleEnter);
    if (signInPassword) signInPassword.addEventListener('keypress', handleEnter);
    if (signUpEmail) signUpEmail.addEventListener('keypress', handleEnter);
    if (signUpPassword) signUpPassword.addEventListener('keypress', handleEnter);
    if (signUpConfirmPassword) signUpConfirmPassword.addEventListener('keypress', handleEnter);
}

function setupAuthStateListener() {
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        currentUser = session?.user ?? null;
        if (currentUser) {
            await loadQuests({ render: false });
            await ensureSignupBonus();
            await loadQuests();
        }
        updateUI();
    });
}

async function checkExistingSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadQuests({ render: false });
        await ensureSignupBonus();
        await loadQuests();
        updateUI();
    }
}

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

async function signUp() {
    const email = document.getElementById('signUpEmail')?.value.trim() || '';
    const password = document.getElementById('signUpPassword')?.value || '';
    const confirmPassword = document.getElementById('signUpConfirmPassword')?.value;

    if (!email || !password) { showAuthError('Please enter both email and password.'); return; }
    if (!validateEmail(email)) { showAuthError('Please enter a valid email address.'); return; }
    if (password.length < 6) { showAuthError('Password must be at least 6 characters long.'); return; }
    if (password.length > 72) { showAuthError('Password is too long.'); return; }
    if (confirmPassword && password !== confirmPassword) { showAuthError('Passwords do not match!'); return; }

    setAuthLoading(true, 'btnSignUp');
    clearAuthError();

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email, password, options: { emailRedirectTo: window.location.origin }
        });
        if (error) { showAuthError(error.message); return; }
        showAuthStep('verify');
        startResendCooldown();
    } catch (err) {
        showAuthError('Unexpected error during registration.');
    } finally {
        setAuthLoading(false, 'btnSignUp');
    }
}

async function sendVerificationEmail() { await resendVerificationEmail(); }

async function resendVerificationEmail() {
    if (resendCooldown > 0) return;
    const email = document.getElementById('signUpEmail')?.value.trim() || '';
    if (!email) return;
    setAuthLoading(true, 'btnResendCode');
    try {
        const { error } = await supabaseClient.auth.resend({
            type: 'signup', email: email, options: { emailRedirectTo: window.location.origin }
        });
        if (error) showAuthError(error.message);
        else { showAuthSuccess('📧 Verification email resent!'); startResendCooldown(); }
    } catch (err) {
        showAuthError('Failed to resend email.');
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
            if (btn) { btn.disabled = false; btn.textContent = 'Resend Verification Email'; }
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
            setTimeout(() => { closeAuthModal(); ensureSignupBonus(); loadQuests(); updateUI(); }, 2000);
        } else {
            showAuthError('Email not verified yet.');
        }
    } catch (err) {
        showAuthError('Error checking verification status.');
    } finally {
        setAuthLoading(false, 'btnVerifyEmail');
    }
}

async function signIn() {
    const email = document.getElementById('signInEmail').value.trim();
    const password = document.getElementById('signInPassword').value;
    if (!email || !password) { showAuthError('Enter email and password.'); return; }
    setAuthLoading(true, 'btnSignIn');
    clearAuthError();
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { showAuthError(error.message); return; }
        closeAuthModal();
        ensureSignupBonus();
        loadQuests();
    } catch (err) {
        showAuthError('Unexpected error logging in.');
    } finally {
        setAuthLoading(false, 'btnSignIn');
    }
}

async function signOut() {
    await supabaseClient.auth.signOut();
    quests = []; ratings = []; strikes = []; comments = []; fairyLedger = [];
    reports = []; fairyPurchases = []; userProfiles = []; currentUser = null;
    updateUI(); renderQuests();
}

function showAuthError(msg) {
    const currentStep = document.querySelector('.auth-step:not([style*="display: none"])');
    const err = currentStep ? currentStep.querySelector('.auth-error') : document.getElementById('signInError');
    if (err) { err.textContent = msg; err.style.display = 'block'; }
}

function showAuthSuccess(msg) {
    const currentStep = document.querySelector('.auth-step:not([style*="display: none"])');
    const success = currentStep ? currentStep.querySelector('.auth-success') : document.getElementById('signInSuccess');
    if (success) { success.textContent = msg; success.style.display = 'block'; setTimeout(() => success.style.display = 'none', 5000); }
}

function clearAuthError() {
    document.querySelectorAll('.auth-error').forEach(el => { el.textContent = ''; el.style.display = 'none'; });
    document.querySelectorAll('.auth-success').forEach(el => { el.textContent = ''; el.style.display = 'none'; });
}

async function ensureSignupBonus() {
    if (!currentUser) return;
    const { data: existingBonus } = await supabaseClient
        .from('fairy_ledger')
        .select('id')
        .eq('to_user', currentUser.id)
        .eq('type', 'signup_bonus')
        .maybeSingle();

    if (!existingBonus) {
        try {
            const { error } = await supabaseClient.rpc('grant_signup_bonus');
            if (!error) { await loadQuests(); showToast(`🎉 Welcome! You received ${SIGNUP_BONUS} Fairy Coins!`); }
        } catch (err) { console.error(err); }
    }
}

function getFairyBalance(userId) {
    return fairyLedger.filter(t => t.from_user === userId || t.to_user === userId).reduce((sum, t) => {
        if (t.to_user === userId) return sum + t.amount;
        if (t.from_user === userId) return sum - t.amount;
        return sum;
    }, 0);
}

function getFairyEscrow(userId) {
    return quests.reduce((sum, q) => {
        if (q.posted_by === userId && q.status !== 'completed' && q.status !== 'cancelled' && q.fairy_coin_reward > 0) {
            return sum + q.fairy_coin_reward;
        }
        return sum;
    }, 0);
}

function getAvailableFairyBalance(userId) { return Math.max(MIN_FAIRY_BALANCE, getFairyBalance(userId)); }

function hasEnoughFairyCoins(userId, amount) { return getAvailableFairyBalance(userId) >= amount; }

function selectShopPackage(amount) {
    const select = document.getElementById('fairyPurchaseAmount');
    if (select) { select.value = amount; updateFairyShopPreview(); }
    document.querySelectorAll('.shop-package').forEach(pkg => {
        pkg.classList.toggle('selected', parseInt(pkg.dataset.amount) === amount);
    });
}

function openFairyShop() { const modal = document.getElementById('fairyShopModal'); if (modal) modal.style.display = 'flex'; updateFairyShopPreview(); }
function closeFairyShop() { const modal = document.getElementById('fairyShopModal'); if (modal) modal.style.display = 'none'; }

function updateFairyShopPreview() {
    const select = document.getElementById('fairyPurchaseAmount');
    const preview = document.getElementById('fairyPurchasePreview');
    const upiId = document.getElementById('fairyShopUpiId');
    if (upiId) upiId.textContent = 'Pay to UPI: ' + ADMIN_EMAIL.replace('@gmail.com', '') + '@upi';
    if (select && preview) {
        const amount = parseInt(select.value) || 0;
        preview.innerHTML = `You will pay <strong>₹${amount}</strong> via UPI to receive <strong>🧚 ${amount}</strong> Fairy Coins.`;
    }
}

async function buyFairyCoins() {
    if (!currentUser) { alert('Login first!'); return; }
    const amount = parseInt(document.getElementById('fairyPurchaseAmount')?.value) || 0;
    const upiTxnId = document.getElementById('fairyUpiTxnId')?.value.trim();
    const screenshotFile = document.getElementById('fairyPaymentScreenshot')?.files[0];

    if (amount <= 0) { alert('Select an amount.'); return; }
    if (!upiTxnId) { alert('Enter UPI Transaction ID.'); return; }

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
        } catch (e) { console.error(e); }
    }

    try {
        const { error } = await supabaseClient.from('fairy_purchases').insert({
            user_id: currentUser.id, user_email: currentUser.email, amount: amount, upi_transaction_id: upiTxnId, status: 'pending', evidence_url: evidenceUrl
        });
        if (error) { alert(error.message); return; }
        closeFairyShop();
        alert('📧 Submitted! Admin will verify and credit within 24 hours.');
        await loadQuests();
    } catch (err) { alert(err.message); }
}

-- ─── ATOMIC LOGIC ENFORCEMENT VIA DB INTERACTION RPC ───
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

    if (fairyReward > 0) {
        const available = getAvailableFairyBalance(currentUser.id);
        if (available < fairyReward) {
            alert(`🚫 Not enough Fairy Coins!\nAvailable: ${available} 🧚`);
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
            if (!uploadError) {
                const { data: urlData } = supabaseClient.storage.from('quest-images').getPublicUrl(fileName);
                imageUrl = urlData?.publicUrl || '';
            }
        } catch (uploadErr) { console.error(uploadErr); }
    }

    try {
        const { error: rpcError } = await supabaseClient.rpc('post_quest_with_escrow', {
            p_title: title,
            p_description: description,
            p_reward: reward,
            p_fairy_coin_reward: fairyReward,
            p_category: category,
            p_poster_upi: upiId,
            p_deadline: deadline,
            p_image_url: imageUrl
        });

        if (rpcError) { alert('Error: ' + rpcError.message); return; }

        questForm.reset();
        document.getElementById('reward').value = 0;
        document.getElementById('fairyReward').value = 0;
        document.getElementById('category').value = 'Misc';
        await loadQuests();
        showToast('✅ Quest posted successfully!');
    } catch (err) { alert(err.message); }
}

async function acceptQuest(id) {
    if (!currentUser) return;
    if (isBanned(currentUser.id)) { alert('🚫 Banned!'); return; }
    try {
        const { error } = await supabaseClient.from('quests').update({
            status: 'accepted', accepted_by: currentUser.id, acceptor_email: currentUser.email
        }).eq('id', id);
        if (error) alert(error.message); else await loadQuests();
    } catch (err) { alert(err.message); }
}

let currentVerifyQuestId = null;

async function completeQuest(id) {
    if (!currentUser) return;
    const quest = quests.find(q => q.id === id);
    if (!quest) return;
    if (quest.accepted_by !== currentUser.id) { alert('Only the acceptor can mark complete.'); return; }
    try {
        const { error } = await supabaseClient.from('quests').update({
            status: 'pending_confirmation', completion_reported_at: new Date().toISOString()
        }).eq('id', id);
        if (error) alert(error.message); else { await loadQuests(); showToast('✅ Completion reported!'); }
    } catch (err) { alert(err.message); }
}

function openVerifyModal(questId) {
    currentVerifyQuestId = questId;
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;
    const modal = document.getElementById('verifyModal');
    const title = document.getElementById('verifyQuestTitle');
    const status = document.getElementById('verifyQuestStatus');
    if (title) title.textContent = quest.title;
    if (status) status.textContent = `Status: ${quest.status.replace('_', ' ').toUpperCase()}`;
    if (modal) modal.style.display = 'flex';
    document.getElementById('btnConfirmWork').style.display = (currentUser.id === quest.posted_by && quest.status === 'pending_confirmation') ? 'inline-block' : 'none';
    document.getElementById('btnConfirmPayment').style.display = (currentUser.id === quest.accepted_by && quest.status === 'pending_confirmation' && quest.reward > 0) ? 'inline-block' : 'none';
    document.getElementById('btnRaiseDispute').style.display = (currentUser.id === quest.posted_by || currentUser.id === quest.accepted_by) ? 'inline-block' : 'none';
}

function closeVerifyModal() { const modal = document.getElementById('verifyModal'); if (modal) modal.style.display = 'none'; currentVerifyQuestId = null; }

async function confirmWorkReceived(questId) {
    if (!questId) return;
    setLoading('btnConfirmWork', true);
    try {
        const { error } = await supabaseClient.from('quests').update({ poster_confirmed_complete: true }).eq('id', questId);
        if (error) alert(error.message); else { await checkBothConfirmed(questId); closeVerifyModal(); await loadQuests(); }
    } catch (err) { alert(err.message); } finally { setLoading('btnConfirmWork', false); }
}

async function confirmPaymentReceived(questId) {
    if (!questId) return;
    setLoading('btnConfirmPayment', true);
    try {
        const { error } = await supabaseClient.from('quests').update({ acceptor_confirmed_complete: true }).eq('id', questId);
        if (error) alert(error.message); else { await checkBothConfirmed(questId); closeVerifyModal(); await loadQuests(); }
    } catch (err) { alert(err.message); } finally { setLoading('btnConfirmPayment', false); }
}

async function checkBothConfirmed(questId) {
    const { data: quest } = await supabaseClient.from('quests').select('*').eq('id', questId).single();
    if (!quest) return;
    if (quest.poster_confirmed_complete && (quest.reward === 0 || quest.acceptor_confirmed_complete)) {
        await supabaseClient.from('quests').update({ status: 'completed' }).eq('id', questId);
        if (quest.fairy_coin_reward > 0 && quest.accepted_by) {
            await supabaseClient.from('fairy_ledger').insert({
                from_user: null, to_user: quest.accepted_by, quest_id: questId, amount: quest.fairy_coin_reward, type: 'quest_reward', description: `Reward for: ${quest.title}`
            });
        }
        showToast('🎉 Quest completed!');
    }
}

async function raiseDispute(questId) {
    if (!questId) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;
    const reason = prompt('Describe the issue:');
    if (!reason || !reason.trim()) return;
    try {
        await supabaseClient.from('quests').update({ dispute_raised: true, status: 'disputed' }).eq('id', questId);
        await supabaseClient.from('reports').insert({
            quest_id: questId, reporter_id: currentUser.id, reported_id: currentUser.id === quest.posted_by ? quest.accepted_by : quest.posted_by, report_type: 'other', description: reason.trim()
        });
        closeVerifyModal(); await loadQuests(); alert('🚨 Dispute raised!');
    } catch (err) { alert(err.message); }
}

async function cancelQuest(id) {
    if (!currentUser) return;
    const quest = quests.find(q => q.id === id);
    if (!quest) return;
    if (!confirm('Cancel this quest?')) return;
    try {
        if (quest.fairy_coin_reward > 0 && quest.posted_by) {
            await supabaseClient.from('fairy_ledger').insert({
                from_user: null, to_user: quest.posted_by, quest_id: quest.id, amount: quest.fairy_coin_reward, type: 'quest_refund', description: `Refund: ${quest.title}`
            });
        }
        await supabaseClient.from('quests').update({ status: 'pending', accepted_by: null, acceptor_email: null }).eq('id', id);
        await loadQuests();
    } catch (err) { alert(err.message); }
}

async function deleteQuest(id) {
    if (!currentUser) return;
    const quest = quests.find(q => q.id === id);
    if (!quest || quest.posted_by !== currentUser.id) return;
    if (!confirm('Delete forever?')) return;
    try {
        if (quest.fairy_coin_reward > 0 && quest.status === 'pending') {
            await supabaseClient.from('fairy_ledger').insert({
                from_user: null, to_user: quest.posted_by, quest_id: quest.id, amount: quest.fairy_coin_reward, type: 'quest_refund', description: `Refund: ${quest.title}`
            });
        }
        await supabaseClient.from('quests').delete().eq('id', id);
        await loadQuests();
    } catch (err) { alert(err.message); }
}

async function confirmPayment(questId, field) {
    const updateObj = {}; updateObj[field] = true;
    try { await supabaseClient.from('quests').update(updateObj).eq('id', questId); await loadQuests(); } catch (err) { alert(err.message); }
}

function openReportModal(questId) { currentReportQuestId = questId; const modal = document.getElementById('reportModal'); if (modal) modal.style.display = 'flex'; }
function closeReportModal() { const modal = document.getElementById('reportModal'); if (modal) modal.style.display = 'none'; }

async function submitReport() {
    const description = document.getElementById('reportDescription')?.value.trim();
    if (!description) return;
    const quest = quests.find(q => q.id === currentReportQuestId);
    try {
        await supabaseClient.from('reports').insert({
            quest_id: currentReportQuestId, reporter_id: currentUser.id, reported_id: currentUser.id === quest.posted_by ? quest.accepted_by : quest.posted_by, report_type: 'other', description
        });
        closeReportModal(); await loadQuests(); alert('🚨 Submitted!');
    } catch (err) { alert(err.message); }
}

async function submitRating(questId, toUser, toEmail, ratingValue) {
    try {
        await supabaseClient.from('ratings').insert({
            quest_id: questId, from_user: currentUser.id, to_user: toUser, from_email: currentUser.email, to_email: toEmail, rating: ratingValue
        });
        await loadQuests();
    } catch (err) { alert(err.message); }
}

async function addStrike(userId, userEmail, questId, reason) {
    try {
        await supabaseClient.from('strikes').insert({ user_id: userId, user_email: userEmail, quest_id: questId, reason });
        alert('Strike added!'); await loadQuests();
    } catch (err) { alert(err.message); }
}

async function sendComment(questId, message) {
    if (!message.trim()) return;
    try {
        await supabaseClient.from('comments').insert({ quest_id: questId, user_id: currentUser.id, user_email: currentUser.email, message: message.trim() });
        await loadQuests();
    } catch (err) { alert(err.message); }
}

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

function getUserStrikes(userId) { return strikes.filter(s => s.user_id === userId && !s.resolved).length; }
function hasRated(questId, toUserId) { return ratings.some(r => r.quest_id === questId && r.from_user === currentUser?.id && r.to_user === toUserId); }
function isBanned(userId) { return getUserStrikes(userId) >= 3; }
function isAdmin() { return currentUser?.email === ADMIN_EMAIL; }
function setLoading(btnId, isLoading) { const btn = document.getElementById(btnId); if (btn) { btn.disabled = isLoading; btn.textContent = isLoading ? 'Processing...' : btn.dataset.originalText || btn.textContent; } }

function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message; toast.style.display = 'block'; toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.style.display = 'none', 300); }, 4000);
    }
}

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

        document.getElementById('userEmail').textContent = currentUser.email;
        const info = getRankInfo(quests.filter(q => q.accepted_by === currentUser.id && q.status === 'completed').length);
        const badge = document.getElementById('userRank');
        if (badge) { badge.textContent = info.rank; badge.style.background = info.bg; badge.style.color = info.color; }

        const avg = getUserRating(currentUser.id);
        document.getElementById('userRating').textContent = avg ? `${avg} ⭐` : '';
        document.getElementById('userFairy').textContent = `🧚 ${getFairyBalance(currentUser.id)}`;

        const strikeCount = getUserStrikes(currentUser.id);
        const strikeBadge = document.getElementById('userStrikes');
        if (strikeBadge) { strikeBadge.textContent = `${strikeCount} STRIKES`; strikeBadge.style.display = strikeCount > 0 ? 'inline' : 'none'; }

        if (isAdmin()) { document.getElementById('adminToggle').style.display = 'block'; updateAdminPanel(); }
        if (isBanned(currentUser.id)) { alert('🚫 Banned!'); signOut(); }
    } else {
        if (navAuth) navAuth.style.display = 'flex';
        if (userBar) userBar.style.display = 'none';
        if (questBoard) questBoard.style.display = 'none';
        if (lockedMessage) lockedMessage.style.display = 'block';
        if (sidebar) sidebar.style.display = 'none';
    }
}

function toggleAdmin() { const panel = document.getElementById('adminPanel'); if (panel) { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; if (panel.style.display === 'block') updateAdminPanel(); } }

function updateAdminPanel() {
    const totalRevenue = quests.filter(q => q.status === 'completed' && q.reward > 0).reduce((sum, q) => sum + (q.reward * 0.1), 0);
    document.getElementById('adminRevenue').textContent = '₹ ' + Math.round(totalRevenue).toLocaleString('en-IN');
    document.getElementById('adminTotalQuests').textContent = quests.length;
    renderAdminPurchases(); renderAdminReports(); renderAdminDisputes();
}

function renderAdminPurchases() {
    const container = document.getElementById('adminPurchasesTable'); if (!container) return;
    const pending = fairyPurchases.filter(p => p.status === 'pending');
    if (pending.length === 0) { container.innerHTML = '<p>No pending purchases.</p>'; return; }
    let html = '<table>';
    pending.forEach(p => {
        html += `<tr><td>${p.user_email}</td><td>🧚 ${p.amount}</td><td><button onclick="confirmPurchase('${p.id}', ${p.amount}, '${p.user_id}')">Confirm</button></td></tr>`;
    });
    container.innerHTML = html + '</table>';
}

function renderAdminReports() {
    const container = document.getElementById('adminReportsTable'); if (!container) return;
    const pending = reports.filter(r => r.status === 'pending');
    if (pending.length === 0) { container.innerHTML = '<p>No pending reports.</p>'; return; }
    let html = '<table>';
    pending.forEach(r => {
        html += `<tr><td>${r.description}</td><td><button onclick="resolveReport('${r.id}', 'dismissed')">Dismiss</button></td></tr>`;
    });
    container.innerHTML = html + '</table>';
}

function renderAdminDisputes() {
    const container = document.getElementById('adminDisputesTable'); if (!container) return;
    const disputed = quests.filter(q => q.status === 'disputed');
    if (disputed.length === 0) { container.innerHTML = '<p>No disputes.</p>'; return; }
    let html = '<table>';
    disputed.forEach(q => {
        html += `<tr><td>${q.title}</td><td><button onclick="resolveDispute('${q.id}', 'poster')">Refund Poster</button></td></tr>`;
    });
    container.innerHTML = html + '</table>';
}

async function confirmPurchase(purchaseId, amount, userId) {
    try {
        await supabaseClient.from('fairy_purchases').update({ status: 'confirmed' }).eq('id', purchaseId);
        await supabaseClient.from('fairy_ledger').insert({ from_user: null, to_user: userId, amount, type: 'purchase', description: 'UPI Purchase' });
        await loadQuests();
    } catch (err) { alert(err.message); }
}

async function rejectPurchase(purchaseId) { try { await supabaseClient.from('fairy_purchases').update({ status: 'rejected' }).eq('id', purchaseId); await loadQuests(); } catch (err) { alert(err.message); } }
async function resolveReport(reportId, resolution) { try { await supabaseClient.from('reports').update({ status: resolution }).eq('id', reportId); await loadQuests(); } catch (err) { alert(err.message); } }

async function resolveDispute(questId, favor) {
    const quest = quests.find(q => q.id === questId); if (!quest) return;
    try {
        if (favor === 'poster' && quest.fairy_coin_reward > 0) {
            await supabaseClient.from('fairy_ledger').insert({ from_user: null, to_user: quest.posted_by, quest_id: questId, amount: quest.fairy_coin_reward, type: 'dispute_refund' });
        }
        await supabaseClient.from('quests').update({ status: 'completed', dispute_raised: false }).eq('id', questId);
        await loadQuests();
    } catch (err) { alert(err.message); }
}

async function loadQuests(options = {}) {
    try {
        const [q, r, s, c, l, rep, pur] = await Promise.all([
            supabaseClient.from('quests').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('ratings').select('*'),
            supabaseClient.from('strikes').select('*'),
            supabaseClient.from('comments').select('*').order('created_at', { ascending: true }),
            supabaseClient.from('fairy_ledger').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('reports').select('*'),
            supabaseClient.from('fairy_purchases').select('*')
        ]);
        quests = q.data || []; ratings = r.data || []; strikes = s.data || []; comments = c.data || []; fairyLedger = l.data || []; reports = rep.data || []; fairyPurchases = pur.data || [];
        if (options.render !== false) { updateUI(); renderQuests(); }
    } catch (err) { console.error(err); }
}

// ─── HIGH-EFFICIENCY ALGORITHMIC REALTIME SUBSCRIPTIONS ───
supabaseClient.channel('public:quests').on('postgres_changes', { event: '*', schema: 'public', table: 'quests' }, async () => {
    const { data } = await supabaseClient.from('quests').select('*').order('created_at', { ascending: false });
    if (data) quests = data; updateUI(); renderQuests();
}).subscribe();

supabaseClient.channel('public:ratings').on('postgres_changes', { event: '*', schema: 'public', table: 'ratings' }, async () => {
    const { data } = await supabaseClient.from('ratings').select('*');
    if (data) ratings = data; updateUI(); renderQuests();
}).subscribe();

supabaseClient.channel('public:strikes').on('postgres_changes', { event: '*', schema: 'public', table: 'strikes' }, async () => {
    const { data } = await supabaseClient.from('strikes').select('*');
    if (data) strikes = data; updateUI(); renderQuests();
}).subscribe();

supabaseClient.channel('public:comments').on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, async () => {
    const { data } = await supabaseClient.from('comments').select('*').order('created_at', { ascending: true });
    if (data) comments = data; updateUI(); renderQuests();
}).subscribe();

supabaseClient.channel('public:fairy_ledger').on('postgres_changes', { event: '*', schema: 'public', table: 'fairy_ledger' }, async () => {
    const { data } = await supabaseClient.from('fairy_ledger').select('*').order('created_at', { ascending: false });
    if (data) fairyLedger = data; updateUI(); renderQuests();
}).subscribe();

function renderQuests() {
    const list = document.getElementById('questList'); if (!list) return;
    list.innerHTML = '';
    let display = quests;
    if (currentTab === 'posted') display = display.filter(q => q.posted_by === currentUser?.id);
    else if (currentTab === 'accepted') display = display.filter(q => q.accepted_by === currentUser?.id);
    if (currentFilter !== 'all') display = display.filter(q => q.category === currentFilter);

    if (display.length === 0) { list.innerHTML = '<p>No quests here.</p>'; return; }

    display.forEach(quest => {
        const node = document.getElementById('questTemplate')?.content?.cloneNode(true);
        const card = node.querySelector('.quest-card'); card.dataset.questId = quest.id;

        if (quest.image_url) { const img = card.querySelector('.quest-image'); img.src = quest.image_url; img.style.display = 'block'; }
        card.querySelector('.status-badge').textContent = quest.status;
        card.querySelector('.quest-title').textContent = quest.title;
        card.querySelector('.quest-desc').textContent = quest.description;
        card.querySelector('.poster-email').textContent = quest.poster_email;

        const acceptBtn = card.querySelector('.btn-accept');
        const completeBtn = card.querySelector('.btn-complete');
        const cancelBtn = card.querySelector('.btn-cancel');
        const deleteBtn = card.querySelector('.btn-delete');
        const verifyBtn = card.querySelector('.btn-verify');

        if (quest.status === 'pending' && quest.posted_by !== currentUser?.id) acceptBtn.onclick = () => acceptQuest(quest.id); else acceptBtn.style.display = 'none';
        if (quest.status === 'accepted' && quest.accepted_by === currentUser?.id) completeBtn.onclick = () => completeQuest(quest.id); else completeBtn.style.display = 'none';
        if (quest.status === 'accepted' && quest.accepted_by === currentUser?.id) cancelBtn.onclick = () => cancelQuest(quest.id); else cancelBtn.style.display = 'none';
        if (quest.posted_by === currentUser?.id && quest.status === 'pending') deleteBtn.onclick = () => deleteQuest(quest.id); else deleteBtn.style.display = 'none';

        if ((quest.status === 'pending_confirmation' || quest.status === 'disputed') && (currentUser?.id === quest.posted_by || currentUser?.id === quest.accepted_by)) {
            verifyBtn.style.display = 'inline-block'; verifyBtn.onclick = () => openVerifyModal(quest.id);
        }

        list.appendChild(card);
    });
    computeStats();
}

function computeStats() {
    if (document.getElementById('totalQuests')) document.getElementById('totalQuests').textContent = quests.length;
    if (document.getElementById('paidQuests')) document.getElementById('paidQuests').textContent = quests.filter(q => q.reward > 0).length;
    if (document.getElementById('completedQuests')) document.getElementById('completedQuests').textContent = quests.filter(q => q.status === 'completed').length;
}
