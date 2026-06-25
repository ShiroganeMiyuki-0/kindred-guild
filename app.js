const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GUILD_FEE_PERCENT = 10;
const ADMIN_EMAIL = 'yashwanthrangaswamy72@gmail.com';

let currentUser = null;
let quests = [];
let ratings = [];
let strikes = [];
let comments = [];
let reports = [];
let userProfiles = [];
let currentFilter = 'all';
let currentTab = 'all';
let lastAuthAction = 'signin';
let authPollingInterval = null;
let resendCooldown = 0;

// ─── INITIALIZATION LOOP ───
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
    const btnResendCode = document.getElementById('btnResendCode');
    const btnVerifyEmail = document.getElementById('btnVerifyEmail');
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
    if (btnResendCode) btnResendCode.addEventListener('click', resendVerificationEmail);
    if (btnVerifyEmail) btnVerifyEmail.addEventListener('click', checkEmailConfirmed);
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
            const banned = await checkBanStatus(currentUser.id);
            if (!banned) {
                await loadQuests();
            }
        } else {
            updateUI();
        }
    });
}

async function checkExistingSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        const banned = await checkBanStatus(currentUser.id);
        if (!banned) {
            await loadQuests();
        }
    } else {
        updateUI();
    }
}

// ─── REPUTATION SECURITY GATE ───
async function checkBanStatus(userId) {
    if (!userId) return false;
    const { data } = await supabaseClient
        .from('user_profiles')
        .select('is_banned')
        .eq('user_id', userId)
        .maybeSingle();

    if (data?.is_banned) {
        alert("🚫 ACCESS TERMINATED: This identity profile is banned globally for strike rules violations.");
        await signOut();
        return true;
    }
    return false;
}

// ─── INPUT DATA SANITIZATION UTILITIES ───
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeHtmlAttribute(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function showErrorToast(message) {
    console.error('❌ Guild runtime fault:', message);
    showToast(`❌ ${message}`);
}

function setAuthLoading(isLoading, buttonId) {
    const btn = document.getElementById(buttonId);
    if (btn) {
        btn.disabled = isLoading;
        btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
        btn.textContent = isLoading ? '⚡ Processing...' : btn.dataset.originalText;
    }
}

function showAuthStep(step) {
    const stepSignIn = document.getElementById('stepSignIn');
    const stepSignUp = document.getElementById('stepSignUp');
    const stepVerify = document.getElementById('stepVerify');
    const stepWelcome = document.getElementById('stepWelcome');
    const authModal = document.getElementById('authModal');
    const progressBar = document.getElementById('authProgressBar');

    if (authModal) authModal.style.display = 'flex';

    [stepSignIn, stepSignUp, stepVerify, stepWelcome].forEach(el => { if (el) el.style.display = 'none'; });

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
            setTimeout(async () => {
                closeAuthModal();
                await loadQuests();
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
        const stepSignUp = document.getElementById('stepSignUp');
        if (stepSignUp && stepSignUp.style.display === 'block') signUp();
        else signIn();
    }
}

// ─── AUTH CONTROLLERS ───
async function signUp() {
    const email = document.getElementById('signUpEmail')?.value.trim() || '';
    const password = document.getElementById('signUpPassword')?.value || '';
    const confirmPassword = document.getElementById('signUpConfirmPassword')?.value;

    if (!email || !password) { showAuthError('Provide identity attributes.'); return; }
    if (!validateEmail(email)) { showAuthError('Invalid email configuration rule.'); return; }
    if (password.length < 6) { showAuthError('Identity secret string length must be >= 6.'); return; }
    if (password !== confirmPassword) { showAuthError('Secret vectors conflict.'); return; }

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
        showAuthError('Identity registration runtime exception.');
    } finally {
        setAuthLoading(false, 'btnSignUp');
    }
}

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
        else { showAuthSuccess('📧 Token transaction dispatched. Review parameters inside your mailbox.'); startResendCooldown(); }
    } catch (err) {
        showAuthError('Resend runtime crash.');
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
        if (countdownEl) countdownEl.textContent = `Available in ${resendCooldown}s`;

        if (resendCooldown <= 0) {
            clearInterval(interval);
            if (btn) { btn.disabled = false; btn.textContent = 'Resend Verification'; }
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
            setTimeout(async () => {
                closeAuthModal();
                await loadQuests();
            }, 2000);
        } else {
            showAuthError('Email pending confirmation metadata update.');
        }
    } catch (err) {
        showAuthError('Handshake verify tracking failed.');
    } finally {
        setAuthLoading(false, 'btnVerifyEmail');
    }
}

async function signIn() {
    const email = document.getElementById('signInEmail').value.trim();
    const password = document.getElementById('signInPassword').value;

    if (!email || !password) { showAuthError('Empty vector.'); return; }
    setAuthLoading(true, 'btnSignIn');
    clearAuthError();

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { showAuthError(error.message); return; }
        closeAuthModal();
    } catch (err) {
        showAuthError('Identity payload matching down.');
    } finally {
        setAuthLoading(false, 'btnSignIn');
    }
}

async function signOut() {
    await supabaseClient.auth.signOut();
    quests = []; ratings = []; strikes = []; comments = []; reports = []; userProfiles = [];
    currentUser = null;
    updateUI();
    renderQuests();
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
}

// ─── QUEST STRUCT ARCHITECTURE CONTROLLERS ───
async function handleQuestSubmit(e) {
    e.preventDefault();
    if (!currentUser) { alert('Unauthorized node context execution.'); return; }

    const title = escapeHtml(document.getElementById('title').value.trim());
    const description = escapeHtml(document.getElementById('description').value.trim());
    const reward = Number(document.getElementById('reward').value) || 0;
    const category = document.getElementById('category').value;
    const upiId = escapeHtml(document.getElementById('upiId').value.trim());
    const deadlineVal = document.getElementById('deadline').value;
    const imageFile = document.getElementById('questImage').files[0];

    if (reward > 0 && !upiId) { alert('UPI ID configuration missing.'); return; }

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
        const { error: questError } = await supabaseClient.from('quests').insert({
            title, description, reward, fee_percent: GUILD_FEE_PERCENT,
            status: 'pending', category, posted_by: currentUser.id, poster_email: currentUser.email,
            poster_upi: upiId, deadline, image_url: imageUrl
        });

        if (questError) { showErrorToast(questError.message); return; }

        document.getElementById('questForm').reset();
        await loadQuests();
        showToast('✅ Quest payload set loaded inside ecosystem!');
    } catch (err) {
        showErrorToast(err.message);
    }
}

async function acceptQuest(id) {
    if (!currentUser) return;
    const quest = quests.find(q => q.id === id);
    if (!quest || quest.status !== 'pending') return;

    try {
        const { error } = await supabaseClient.from('quests').update({
            status: 'accepted', accepted_by: currentUser.id, acceptor_email: currentUser.email
        }).eq('id', id);
        if (error) showErrorToast(error.message);
        else { await loadQuests(); showToast('✅ Node lock acquisition finished.'); }
    } catch (err) { showErrorToast(err.message); }
}

async function completeQuest(id) {
    if (!currentUser) return;
    const quest = quests.find(q => q.id === id);
    if (!quest || quest.accepted_by !== currentUser.id) return;

    try {
        const { error } = await supabaseClient.from('quests').update({
            status: 'pending_confirmation', completion_reported_at: new Date().toISOString()
        }).eq('id', id);

        if (error) showErrorToast(error.message);
        else { await loadQuests(); showToast('✅ Finished work transaction broadcasted.'); }
    } catch (err) { showErrorToast(err.message); }
}

let currentVerifyQuestId = null;

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
    if (status) status.textContent = `Node State: ${quest.status.toUpperCase()}`;

    if (btnConfirmWork) btnConfirmWork.style.display = (currentUser.id === quest.posted_by && quest.status === 'pending_confirmation') ? 'inline-block' : 'none';
    if (btnConfirmPayment) btnConfirmPayment.style.display = (currentUser.id === quest.accepted_by && quest.status === 'pending_confirmation' && quest.reward > 0) ? 'inline-block' : 'none';
    if (btnRaiseDispute) btnRaiseDispute.style.display = (currentUser.id === quest.posted_by || currentUser.id === quest.accepted_by) ? 'inline-block' : 'none';

    if (modal) modal.style.display = 'flex';
}

function closeVerifyModal() {
    const modal = document.getElementById('verifyModal');
    if (modal) modal.style.display = 'none';
    currentVerifyQuestId = null;
}

async function confirmWorkReceived(questId) {
    if (!questId) return;
    try {
        const { error } = await supabaseClient.from('quests').update({ poster_confirmed_complete: true }).eq('id', questId);
        if (error) { showErrorToast(error.message); return; }
        await checkBothConfirmed(questId);
        closeVerifyModal();
        await loadQuests();
    } catch (err) { showErrorToast(err.message); }
}

async function confirmPaymentReceived(questId) {
    if (!questId) return;
    try {
        const { error } = await supabaseClient.from('quests').update({ acceptor_confirmed_complete: true }).eq('id', questId);
        if (error) { showErrorToast(error.message); return; }
        await checkBothConfirmed(questId);
        closeVerifyModal();
        await loadQuests();
    } catch (err) { showErrorToast(err.message); }
}

async function checkBothConfirmed(questId) {
    const { data: quest } = await supabaseClient.from('quests').select('*').eq('id', questId).single();
    if (!quest) return;

    const paymentConfirmed = quest.reward === 0 || quest.acceptor_confirmed_complete;
    const workConfirmed = quest.poster_confirmed_complete;

    if (workConfirmed && paymentConfirmed) {
        await supabaseClient.from('quests').update({ status: 'completed' }).eq('id', questId);
        showToast('🎉 Verification complete. State sequence matching successful.');
    }
}

async function raiseDispute(questId) {
    if (!questId) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    const reason = prompt('Trace issue context parameters:');
    if (!reason || !reason.trim()) return;

    try {
        const { error } = await supabaseClient.from('quests').update({ dispute_raised: true, status: 'disputed' }).eq('id', questId);
        if (error) { showErrorToast(error.message); return; }

        // FIXED: Replaced old SQL comment bug syntax from -- to standard JS line syntax
        // Also create a report
        const reportedId = currentUser.id === quest.posted_by ? quest.accepted_by : quest.posted_by;
        await supabaseClient.from('reports').insert({
            quest_id: questId, reporter_id: currentUser.id, reported_id: reportedId, report_type: 'other', description: escapeHtml(reason.trim())
        });

        closeVerifyModal();
        await loadQuests();
        alert('🚨 Conflict condition mapped to ledger context. Verification block frozen.');
    } catch (err) { showErrorToast(err.message); }
}

async function cancelQuest(id) {
    if (!currentUser) return;
    const quest = quests.find(q => q.id === id);
    if (!quest || quest.accepted_by !== currentUser.id) return;
    if (!confirm('Drop pointer lock?')) return;

    try {
        const { error } = await supabaseClient.from('quests').update({
            status: 'pending', accepted_by: null, acceptor_email: null, poster_confirmed_complete: false, acceptor_confirmed_complete: false
        }).eq('id', id);
        if (error) showErrorToast(error.message);
        else await loadQuests();
    } catch (err) { showErrorToast(err.message); }
}

async function deleteQuest(id) {
    if (!currentUser) return;
    const quest = quests.find(q => q.id === id);
    if (!quest || quest.posted_by !== currentUser.id) return;
    if (!confirm('Purge structural data block?')) return;

    try {
        const { error } = await supabaseClient.from('quests').delete().eq('id', id);
        if (error) showErrorToast(error.message);
        else await loadQuests();
    } catch (err) { showErrorToast(err.message); }
}

async function confirmPayment(questId, field) {
    if (!currentUser) return;
    const updateObj = {}; updateObj[field] = true;
    try {
        const { error } = await supabaseClient.from('quests').update(updateObj).eq('id', questId);
        if (error) showErrorToast(error.message);
        else await loadQuests();
    } catch (err) { showErrorToast(err.message); }
}

// ─── REPUTATION ENGINE: STRIKE AND AUTO-BAN ENGINE ───
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
    const description = escapeHtml(document.getElementById('reportDescription')?.value.trim());
    const quest = quests.find(q => q.id === currentReportQuestId);
    if (!quest || !description) return;

    const reportedId = currentUser.id === quest.posted_by ? quest.accepted_by : quest.posted_by;

    try {
        const { error } = await supabaseClient.from('reports').insert({
            quest_id: currentReportQuestId, reporter_id: currentUser.id, reported_id: reportedId, report_type: type || 'other', description: description
        });
        if (error) { alert(error.message); return; }
        closeReportModal();
        await loadQuests();
        alert('🚨 Incident log frame submitted to network administrators.');
    } catch (err) { alert(err.message); }
}

async function submitRating(questId, toUser, toEmail, ratingValue) {
    if (!currentUser) return;
    try {
        const { error } = await supabaseClient.from('ratings').insert({
            quest_id: questId, from_user: currentUser.id, to_user: toUser, from_email: currentUser.email, to_email: toEmail, rating: ratingValue
        });
        if (error) alert(error.message);
        else await loadQuests();
    } catch (err) { alert(err.message); }
}

async function addStrike(userId, userEmail, questId, reason) {
    if (!currentUser) return;
    try {
        const { error: strikeErr } = await supabaseClient.from('strikes').insert({
            user_id: userId, user_email: userEmail, quest_id: questId, reason: escapeHtml(reason)
        });
        if (strikeErr) { alert(strikeErr.message); return; }

        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('report_count')
            .eq('user_id', userId)
            .maybeSingle();

        let count = (profile ? profile.report_count : 0) + 1;
        let isBanned = count >= 3;

        await supabaseClient
            .from('user_profiles')
            .update({ report_count: count, is_banned: isBanned })
            .eq('user_id', userId);

        alert(isBanned ? '🚨 CRITICAL STRATAGEM: Node exceeded strike limits. Target banned globally.' : 'Violation index updated (+1 strike).');
        await loadQuests();
    } catch (err) { alert(err.message); }
}

async function sendComment(questId, message) {
    if (!currentUser || !message.trim()) return;
    try {
        const { error } = await supabaseClient.from('comments').insert({
            quest_id: questId, user_id: currentUser.id, user_email: currentUser.email, message: escapeHtml(message.trim())
        });
        if (error) alert(error.message);
        else await loadQuests();
    } catch (err) { alert(err.message); }
}

// ─── UI CONTROLLER COMPONENT ───
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

function isAdmin() { return currentUser?.email === ADMIN_EMAIL; }

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

        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.textContent = currentUser.email;

        const completed = quests.filter(q => q.accepted_by === currentUser.id && q.status === 'completed').length;
        const info = getRankInfo(completed);
        const badge = document.getElementById('userRank');
        if (badge) { badge.textContent = info.rank; badge.style.background = info.bg; badge.style.color = info.color; }

        const avg = getUserRating(currentUser.id);
        const userRating = document.getElementById('userRating');
        if (userRating) userRating.textContent = avg ? `${avg} ⭐` : '';

        const strikeCount = getUserStrikes(currentUser.id);
        const strikeBadge = document.getElementById('userStrikes');
        if (strikeBadge) {
            if (strikeCount > 0) { strikeBadge.textContent = `${strikeCount} STRIKES`; strikeBadge.style.display = 'inline'; }
            else strikeBadge.style.display = 'none';
        }

        const adminToggle = document.getElementById('adminToggle');
        if (isAdmin()) { if (adminToggle) adminToggle.style.display = 'block'; updateAdminPanel(); }
        else { if (adminToggle) adminToggle.style.display = 'none'; }
    } else {
        if (navAuth) navAuth.style.display = 'flex';
        if (userBar) userBar.style.display = 'none';
        if (questBoard) questBoard.style.display = 'none';
        if (lockedMessage) lockedMessage.style.display = 'block';
        if (sidebar) sidebar.style.display = 'none';
    }
}

function toggleAdmin() {
    const panel = document.getElementById('adminPanel');
    if (panel) { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; if (panel.style.display === 'block') updateAdminPanel(); }
}

function updateAdminPanel() {
    const totalRevenue = quests.filter(q => q.status === 'completed' && q.reward > 0).reduce((sum, q) => sum + (q.reward * (GUILD_FEE_PERCENT / 100)), 0);
    const uniqueUsers = new Set();
    quests.forEach(q => { if (q.posted_by) uniqueUsers.add(q.posted_by); if (q.accepted_by) uniqueUsers.add(q.accepted_by); });
    const pendingPayments = quests.filter(q => q.status === 'completed' && q.reward > 0 && (!q.poster_paid || !q.acceptor_received)).length;
    const disputedQuests = quests.filter(q => q.status === 'disputed').length;
    const pendingReports = reports.filter(r => r.status === 'pending').length;

    if (document.getElementById('adminRevenue')) document.getElementById('adminRevenue').textContent = '₹ ' + Math.round(totalRevenue).toLocaleString('en-IN');
    if (document.getElementById('adminUsers')) document.getElementById('adminUsers').textContent = uniqueUsers.size;
    if (document.getElementById('adminTotalQuests')) document.getElementById('adminTotalQuests').textContent = quests.length;
    if (document.getElementById('adminPending')) document.getElementById('adminPending').textContent = pendingPayments;
    if (document.getElementById('adminDisputed')) document.getElementById('adminDisputed').textContent = disputedQuests;
    if (document.getElementById('adminReports')) document.getElementById('adminReports').textContent = pendingReports;

    renderAdminReports();
    renderAdminDisputes();
}

function renderAdminReports() {
    const container = document.getElementById('adminReportsTable');
    if (!container) return;
    const pending = reports.filter(r => r.status === 'pending');
    if (pending.length === 0) { container.innerHTML = '<p>No pending logs.</p>'; return; }

    let html = '<table><tr style="background:var(--card);"><th>Target Profile</th><th>Incident Parameter</th><th>Controls</th></tr>';
    pending.forEach(r => {
        html += `<tr><td>${escapeHtml(r.reported_id)}</td><td>${escapeHtml(r.description)}</td><td><button onclick="resolveReport('${escapeHtmlAttribute(r.id)}', 'dismissed')">Dismiss</button></td></tr>`;
    });
    container.innerHTML = html + '</table>';
}

function renderAdminDisputes() {
    const container = document.getElementById('adminDisputesTable');
    if (!container) return;
    const disputed = quests.filter(q => q.status === 'disputed');
    if (disputed.length === 0) { container.innerHTML = '<p>No conflicting vectors.</p>'; return; }

    let html = '<table><tr style="background:var(--card);"><th>Title</th><th>Poster</th><th>Acceptor</th><th>Action</th></tr>';
    disputed.forEach(q => {
        html += `<tr><td>${escapeHtml(q.title)}</td><td>${escapeHtml(q.poster_email)}</td><td>${escapeHtml(q.acceptor_email || 'N/A')}</td><td><button onclick="resolveDispute('${escapeHtmlAttribute(q.id)}', 'poster')">Close</button></td></tr>`;
    });
    container.innerHTML = html + '</table>';
}

async function resolveReport(reportId, resolution) {
    if (!isAdmin()) return;
    try {
        await supabaseClient.from('reports').update({ status: resolution }).eq('id', reportId);
        await loadQuests();
    } catch (err) { alert(err.message); }
}

async function resolveDispute(questId, favor) {
    if (!isAdmin()) return;
    try {
        await supabaseClient.from('quests').update({ status: 'completed', dispute_raised: false }).eq('id', questId);
        await loadQuests();
    } catch (err) { alert(err.message); }
}

// ─── DATA SYNC SYNCHRONIZER ENGINE ───
async function loadQuests(options = {}) {
    try {
        const [questData, ratingData, strikeData, commentData, reportData, profileData] = await Promise.all([
            supabaseClient.from('quests').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('ratings').select('*'),
            supabaseClient.from('strikes').select('*'),
            supabaseClient.from('comments').select('*').order('created_at', { ascending: true }),
            supabaseClient.from('reports').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('user_profiles').select('*')
        ]);

        quests = questData.data || [];
        ratings = ratingData.data || [];
        strikes = strikeData.data || [];
        comments = commentData.data || [];
        reports = reportData.data || [];
        userProfiles = profileData.data || [];

        if (options.render !== false) { updateUI(); renderQuests(); }
    } catch (err) { console.error(err); }
}

// REALTIME POSTGRES PIPELINE SYNC
['quests', 'ratings', 'strikes', 'comments', 'reports'].forEach(table => {
    supabaseClient.channel(`public:${table}`).on('postgres_changes', { event: '*', schema: 'public', table }, () => loadQuests()).subscribe();
});

// ─── RENDERING DATA VIEW CARDS ───
function renderQuests() {
    const list = document.getElementById('questList');
    if (!list) return;
    list.innerHTML = '';

    let display = quests;
    if (currentTab === 'posted') display = display.filter(q => q.posted_by === currentUser?.id);
    else if (currentTab === 'accepted') display = display.filter(q => q.accepted_by === currentUser?.id);
    if (currentFilter !== 'all') display = display.filter(q => q.category === currentFilter);

    if (display.length === 0) { list.innerHTML = '<p style="text-align:center;color:var(--muted);padding:2rem;">Queue clear.</p>'; computeStats(display); return; }

    display.forEach(quest => {
        const node = document.getElementById('questTemplate')?.content?.cloneNode(true);
        if (!node) return;
        const card = node.querySelector('.quest-card');
        card.dataset.questId = quest.id;

        const img = card.querySelector('.quest-image');
        if (img && quest.image_url) { img.src = quest.image_url; img.classList.add('visible'); }

        const statusBadge = card.querySelector('.status-badge');
        if (statusBadge) { statusBadge.className = `status-badge status-${quest.status}`; statusBadge.textContent = quest.status.replace('_', ' '); }
        if (card.querySelector('.cat-badge')) card.querySelector('.cat-badge').textContent = quest.category || 'Misc';
        if (card.querySelector('.quest-title')) card.querySelector('.quest-title').textContent = quest.title;
        if (card.querySelector('.quest-desc')) card.querySelector('.quest-desc').textContent = quest.description;

        const rewardTag = card.querySelector('.reward-tag');
        if (rewardTag) rewardTag.textContent = quest.reward > 0 ? `₹ ${quest.reward}` : 'FREE QUEST';

        if (card.querySelector('.poster-email')) card.querySelector('.poster-email').textContent = quest.poster_email || 'Unknown';

        const acceptBtn = card.querySelector('.btn-accept');
        const completeBtn = card.querySelector('.btn-complete');
        const cancelBtn = card.querySelector('.btn-cancel');
        const deleteBtn = card.querySelector('.btn-delete');
        const verifyBtn = card.querySelector('.btn-verify');

        if (acceptBtn) { if (quest.status !== 'pending' || quest.posted_by === currentUser?.id) acceptBtn.style.display = 'none'; else acceptBtn.addEventListener('click', () => acceptQuest(quest.id)); }
        if (completeBtn) { if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) completeBtn.style.display = 'none'; else completeBtn.addEventListener('click', () => completeQuest(quest.id)); }
        if (cancelBtn) { if (quest.status !== 'accepted' || quest.accepted_by !== currentUser?.id) cancelBtn.style.display = 'none'; else cancelBtn.addEventListener('click', () => cancelQuest(quest.id)); }
        if (deleteBtn) { if (quest.posted_by !== currentUser?.id || quest.status === 'accepted') deleteBtn.style.display = 'none'; else deleteBtn.addEventListener('click', () => deleteQuest(quest.id)); }

        if (verifyBtn) {
            const showVerify = (quest.status === 'pending_confirmation' || quest.status === 'disputed') && (currentUser?.id === quest.posted_by || currentUser?.id === quest.accepted_by);
            if (showVerify) { verifyBtn.style.display = 'inline-block'; verifyBtn.textContent = '🔍 Run Verification'; verifyBtn.addEventListener('click', () => openVerifyModal(quest.id)); }
            else verifyBtn.style.display = 'none';
        }

        const paymentSection = card.querySelector('.payment-section');
        if (paymentSection && quest.reward > 0) {
            const paymentInfo = document.createElement('div');
            paymentInfo.style.cssText = 'background:var(--accent-glow); border:1px solid var(--accent); border-radius:8px; padding:0.75rem; margin:0.5rem 0; font-size:0.85rem;';
            paymentInfo.innerHTML = `<strong>💰 UPI Payload Pointer:</strong> ${escapeHtml(quest.poster_upi || 'None')}`;
            paymentSection.appendChild(paymentInfo);
        }

        const commentList = card.querySelector('.comment-list');
        if (commentList) {
            if (currentUser) card.querySelector('.comment-section').style.display = 'block';
            const questComments = comments.filter(c => c.quest_id === quest.id);
            questComments.forEach(comment => {
                const commentEl = document.createElement('div');
                commentEl.style.cssText = 'padding:0.5rem; margin:0.25rem 0; background:var(--surface-hover); border-radius:8px; font-size:0.85rem;';
                commentEl.innerHTML = `<strong>${escapeHtml(comment.user_email)}</strong>: ${escapeHtml(comment.message)}`;
                commentList.appendChild(commentEl);
            });

            card.querySelector('.send-comment').addEventListener('click', () => {
                const f = card.querySelector('.comment-field');
                if (f.value.trim()) { sendComment(quest.id, f.value.trim()); f.value = ''; }
            });
        }

        if (quest.status === 'completed' && currentUser) {
            const extras = card.querySelector('.extras');
            const canRatePoster = currentUser.id === quest.accepted_by && quest.posted_by && !hasRated(quest.id, quest.posted_by);
            const canRateAcceptor = currentUser.id === quest.posted_by && quest.accepted_by && !hasRated(quest.id, quest.accepted_by);

            if (canRatePoster || canRateAcceptor) {
                const rDiv = document.createElement('div');
                rDiv.style.cssText = 'margin-top:0.75rem; padding:0.75rem; background:var(--surface-hover); border-radius:8px;';
                rDiv.innerHTML = '<strong>⭐ Evaluation Metrics Matrix</strong><br>';
                if (canRatePoster) rDiv.appendChild(createRatingRow(quest.id, quest.posted_by, quest.poster_email, 'Rate Client'));
                if (canRateAcceptor) rDiv.appendChild(createRatingRow(quest.id, quest.accepted_by, quest.acceptor_email, 'Rate Contractor'));
                extras.appendChild(rDiv);
            }
        }

        if ((quest.status === 'completed' || quest.status === 'pending_confirmation') && currentUser && (currentUser.id === quest.accepted_by || currentUser.id === quest.posted_by)) {
            const extras = card.querySelector('.extras');
            const actionDiv = document.createElement('div');
            actionDiv.style.cssText = 'margin-top:0.5rem; display:flex; gap:0.5rem; flex-wrap:wrap;';

            if (currentUser.id === quest.accepted_by && quest.posted_by) {
                const strikeBtn = document.createElement('button');
                strikeBtn.className = 'btn btn-ghost btn-sm'; strikeBtn.textContent = '🚨 File Incident Strike';
                strikeBtn.style.cssText = 'color:var(--danger); border-color:var(--danger); font-size:0.8rem;';
                strikeBtn.addEventListener('click', () => {
                    const reason = prompt('Specify violation description rules:');
                    if (reason && reason.trim()) addStrike(quest.posted_by, quest.poster_email, quest.id, reason.trim());
                });
                actionDiv.appendChild(strikeBtn);
            }
            extras.appendChild(actionDiv);
        }
        list.appendChild(node);
    });
    computeStats(display);
}

function createRatingRow(questId, toUserId, toEmail, label) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:0.5rem; margin:0.25rem 0; flex-wrap:wrap;';
    row.innerHTML = `${label}:`;
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('button'); star.textContent = '⭐';
        star.style.cssText = 'background:none; border:none; cursor:pointer; font-size:1rem; padding:0.1rem; opacity:0.5;';
        star.addEventListener('click', () => submitRating(questId, toUserId, toEmail, i));
        row.appendChild(star);
    }
    return row;
}

function setFilter(filter) { currentFilter = filter; renderQuests(); }
function setTab(tab) { currentTab = tab; renderQuests(); }

function computeStats(displayQuests) {
    if (document.getElementById('totalQuests')) document.getElementById('totalQuests').textContent = quests.length;
    if (document.getElementById('paidQuests')) document.getElementById('paidQuests').textContent = quests.filter(q => q.reward > 0).length;
    if (document.getElementById('completedQuests')) document.getElementById('completedQuests').textContent = quests.filter(q => q.status === 'completed').length;
}

function handleCommentEnter(event, input) {
    if (event.key === 'Enter') {
        const questId = input.closest('.quest-card').dataset.questId;
        if (input.value.trim()) { sendComment(questId, input.value.trim()); input.value = ''; }
    }
}
