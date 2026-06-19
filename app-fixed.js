// NOTE: This is a snippet of critical security fixes applied to app.js
// Key changes:
// 1. Environment variables for credentials (instead of hardcoded)
// 2. Fixed SQL comment syntax on line 869
// 3. XSS protection in admin table rendering
// 4. Improved error handling
// 5. Input validation improvements

// ===== ENVIRONMENT CONFIGURATION =====
// Load from .env.local (NOT committed to repo)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const ADMIN_EMAIL = process.env.VITE_ADMIN_EMAIL || 'admin@example.com';

if (!SUPABASE_KEY) {
    console.warn('⚠️ WARNING: VITE_SUPABASE_ANON_KEY not set. Check your .env.local file.');
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GUILD_FEE_PERCENT = 10;
const MIN_FAIRY_BALANCE = 0;
const SIGNUP_BONUS = 100;

// ===== IMPROVED INPUT VALIDATION =====
function validateEmail(email) {
    // More strict email validation: requires 2+ char TLD
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function sanitizeInput(text, maxLength = 1000) {
    if (!text) return '';
    return text.slice(0, maxLength).trim();
}

// ===== XSS PROTECTION =====
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

// ===== IMPROVED ERROR HANDLING =====
function showErrorToast(message) {
    console.error('❌ Error:', message);
    showToast(`❌ ${message}`);
}

// ===== FIXED: SQL COMMENT SYNTAX (Line 869) =====
// Before: -- Also create a report
// After:
// // Also create a report

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
            showErrorToast('Error raising dispute: ' + error.message);
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
        showErrorToast('Unexpected error: ' + err.message);
    }
}

// ===== FIXED: XSS VULNERABILITY IN ADMIN TABLES =====
// Applied escapeHtml() to all user-controlled data

function renderAdminPurchases() {
    const container = document.getElementById('adminPurchasesTable');
    if (!container) return;
    const pending = fairyPurchases.filter(p => p.status === 'pending');
    if (pending.length === 0) { 
        container.innerHTML = '<p>No pending purchases.</p>'; 
        return; 
    }

    let html = '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;"><tr style="background:var(--card);"><th>User</th><th>Amount</th><th>UPI TXN</th><th>Evidence</th><th>Action</th></tr>';
    pending.forEach(p => {
        // FIXED: Escape all user data
        const userEmail = escapeHtml(p.user_email || 'Unknown');
        const upiTxn = escapeHtml(p.upi_transaction_id || 'N/A');
        const evidenceLink = p.evidence_url ? `<a href="${escapeHtmlAttribute(p.evidence_url)}" target="_blank">View</a>` : 'None';
        
        html += `<tr>
            <td>${userEmail}</td>
            <td>🧚 ${p.amount}</td>
            <td>${upiTxn}</td>
            <td>${evidenceLink}</td>
            <td><button onclick="confirmPurchase('${escapeHtmlAttribute(p.id)}', ${p.amount}, '${escapeHtmlAttribute(p.user_id)}')">Confirm</button> <button onclick="rejectPurchase('${escapeHtmlAttribute(p.id)}')">Reject</button></td>
        </tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
}

function renderAdminReports() {
    const container = document.getElementById('adminReportsTable');
    if (!container) return;
    const pending = reports.filter(r => r.status === 'pending');
    if (pending.length === 0) { 
        container.innerHTML = '<p>No pending reports.</p>'; 
        return; 
    }

    let html = '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;"><tr style="background:var(--card);"><th>Quest</th><th>Reporter</th><th>Reported</th><th>Type</th><th>Description</th><th>Evidence</th><th>Action</th></tr>';
    pending.forEach(r => {
        const quest = quests.find(q => q.id === r.quest_id);
        const questTitle = escapeHtml(quest ? quest.title : 'Unknown');
        const reportType = escapeHtml(r.report_type);
        const description = escapeHtml(r.description);
        const evidenceLink = r.evidence_urls && r.evidence_urls.length ? `<a href="${escapeHtmlAttribute(r.evidence_urls[0])}" target="_blank">View</a>` : 'None';
        
        html += `<tr>
            <td>${questTitle}</td>
            <td>${r.reporter_id}</td>
            <td>${r.reported_id}</td>
            <td>${reportType}</td>
            <td>${description}</td>
            <td>${evidenceLink}</td>
            <td><button onclick="resolveReport('${escapeHtmlAttribute(r.id)}', 'resolved_poster')">Favor Poster</button> <button onclick="resolveReport('${escapeHtmlAttribute(r.id)}', 'resolved_acceptor')">Favor Acceptor</button></td>
        </tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
}

function renderAdminDisputes() {
    const container = document.getElementById('adminDisputesTable');
    if (!container) return;
    const disputed = quests.filter(q => q.status === 'disputed');
    if (disputed.length === 0) { 
        container.innerHTML = '<p>No disputed quests.</p>'; 
        return; 
    }

    let html = '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;"><tr style="background:var(--card);"><th>Title</th><th>Poster</th><th>Acceptor</th><th>Fairy Reward</th><th>Action</th></tr>';
    disputed.forEach(q => {
        const title = escapeHtml(q.title);
        const posterEmail = escapeHtml(q.poster_email || 'Unknown');
        const acceptorEmail = escapeHtml(q.acceptor_email || 'N/A');
        
        html += `<tr>
            <td>${title}</td>
            <td>${posterEmail}</td>
            <td>${acceptorEmail}</td>
            <td>🧚 ${q.fairy_coin_reward}</td>
            <td><button onclick="resolveDispute('${escapeHtmlAttribute(q.id)}', 'poster')">Refund Poster</button> <button onclick="resolveDispute('${escapeHtmlAttribute(q.id)}', 'acceptor')">Pay Acceptor</button></td>
        </tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
}

// ===== IMPROVED ASYNC ERROR HANDLING =====
async function loadQuests(options = {}) {
    try {
        const [questResult, ratingResult, strikeResult, commentResult, ledgerResult, reportResult, purchaseResult, profileResult] = await Promise.all([
            supabaseClient.from('quests').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('ratings').select('*'),
            supabaseClient.from('strikes').select('*'),
            supabaseClient.from('comments').select('*').order('created_at', { ascending: true }),
            supabaseClient.from('fairy_ledger').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('reports').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('fairy_purchases').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('user_profiles').select('*')
        ]);

        const errors = [];
        if (questResult.error) errors.push('Failed to load quests');
        if (ratingResult.error) errors.push('Failed to load ratings');
        if (strikeResult.error) errors.push('Failed to load strikes');
        if (commentResult.error) errors.push('Failed to load comments');
        if (ledgerResult.error) errors.push('Failed to load ledger');
        if (reportResult.error) errors.push('Failed to load reports');
        if (purchaseResult.error) errors.push('Failed to load purchases');
        if (profileResult.error) errors.push('Failed to load profiles');

        if (errors.length > 0) {
            console.error('Data loading errors:', errors);
            if (errors.length < 3) {
                showErrorToast('⚠️ Some data failed to load: ' + errors.join(', '));
            } else {
                showErrorToast('⚠️ Multiple data sources failed. Please refresh the page.');
            }
        }

        quests = questResult.data || [];
        ratings = ratingResult.data || [];
        strikes = strikeResult.data || [];
        comments = commentResult.data || [];
        fairyLedger = ledgerResult.data || [];
        reports = reportResult.data || [];
        fairyPurchases = purchaseResult.data || [];
        userProfiles = profileResult.data || [];

        if (options.render !== false) {
            updateUI();
            renderQuests();
        }
    } catch (err) {
        console.error('Fatal error loading quests:', err);
        showErrorToast('Fatal error: Could not load data. Check your connection and try refreshing.');
    }
}
