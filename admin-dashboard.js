/**
 * Kindred Guild - Admin Dashboard Manager
 * Copyright (c) 2026 Kindred Guild. All Rights Reserved.
 * Unauthorized copying or redistribution is prohibited.
 */

let activeTab = 'quests';
let allFeedback = [];

// 1. Tab Switching Module
function switchTab(tabId) {
    activeTab = tabId;

    document.querySelectorAll('[id^="tab-"]').forEach(el => {
        el.classList.remove('active-tab');
    });
    const currentTab = document.getElementById(`tab-${tabId}`);
    if (currentTab) currentTab.classList.add('active-tab');

    document.querySelectorAll('.panel-view').forEach(panel => {
        panel.classList.add('hidden');
    });
    const currentPanel = document.getElementById(`panel-${tabId}`);
    if (currentPanel) currentPanel.classList.remove('hidden');

    if (tabId === 'quests') fetchPendingQuests();
    if (tabId === 'coins') fetchPendingCoins();
    if (tabId === 'workers') fetchWorkersPool();
    if (tabId === 'feedback') fetchFeedbackPortal();
}

// 2. Authentication Check — uses is_admin from user_profiles
async function checkAdminAuthorization() {
    if (!window.sb) {
        showGlobalAlert("Database connection is offline.", "error");
        return;
    }

    const { data: { user }, error } = await window.sb.auth.getUser();
    if (error || !user) {
        window.location.href = 'auth.html';
        return;
    }

    const profile = await window.getUserProfile(user.id);
    if (!profile || !profile.is_admin) {
        showGlobalAlert("Access Denied: You do not carry the Guild Master credentials.", "error");
        setTimeout(() => { window.location.href = 'quest-board.html'; }, 2500);
        return;
    }

    fetchPendingQuests();
    preloadFeedbackBadge();
}

// 3. UI Status Alerts
function showGlobalAlert(message, type = "success") {
    const alertBox = document.getElementById('dashboardAlert');
    if (!alertBox) return;

    alertBox.className = `mb-6 p-4 rounded-xl text-sm font-medium ${
        type === 'success'
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
    }`;
    alertBox.textContent = message;
    alertBox.classList.remove('hidden');

    setTimeout(() => { alertBox.classList.add('hidden'); }, 5000);
}

// 4. Fetch Pending Quests
async function fetchPendingQuests() {
    const tableBody = document.getElementById('questsTableBody');
    if (!tableBody) return;

    try {
        const { data, error } = await window.sb
            .from('quests')
            .select('id, title, coin_amount, upi_amount, payment_type, status, created_at, poster_id, poster:user_profiles!quests_poster_id_fkey(username, display_name)')
            .eq('status', 'open')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tableBody.innerHTML = `
                <tr><td colspan="5" class="py-8 text-center text-gray-500">
                    <i class="fa-solid fa-circle-check text-emerald-400 mb-2 block text-xl"></i> No pending quests to review.
                </td></tr>`;
            return;
        }

        tableBody.innerHTML = data.map(quest => {
            const posterName = quest.poster?.display_name || quest.poster?.username || 'Unknown';
            const reward = quest.payment_type === 'coins' ? quest.coin_amount + ' FC' : quest.payment_type === 'upi' ? '₹' + quest.upi_amount : 'Free';
            return `
            <tr class="border-b border-slate-800/40 hover:bg-slate-900/20 transition-colors">
                <td class="py-4 font-semibold text-white">${escapeHtml(quest.title)}</td>
                <td class="py-4 text-gray-400">${escapeHtml(posterName)}</td>
                <td class="py-4 text-amber-400 font-bold">${reward}</td>
                <td class="py-4 text-gray-400">${new Date(quest.created_at).toLocaleDateString()}</td>
                <td class="py-4 text-right">
                    <a href="quest-detail.html?id=${quest.id}" class="text-blue-400 hover:text-blue-300 text-xs px-3 py-1.5 transition mr-2">View</a>
                </td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error("Quests loading error:", err);
        tableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-400">Failed to load quests: ${err.message}</td></tr>`;
    }
}

// 5. Fetch Coin Purchases
async function fetchPendingCoins() {
    const tableBody = document.getElementById('coinsTableBody');
    if (!tableBody) return;

    try {
        const { data, error } = await window.sb
            .from('coin_purchases')
            .select('id, coin_amount, upi_transaction_ref, payment_note, status, created_at, user_id, user:user_profiles!coin_purchases_user_id_fkey(username, display_name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tableBody.innerHTML = `
                <tr><td colspan="5" class="py-8 text-center text-gray-500">
                    <i class="fa-solid fa-clipboard-check text-emerald-400 mb-2 block text-xl"></i> Ledger is clean. No pending verifications.
                </td></tr>`;
            return;
        }

        tableBody.innerHTML = data.map(tx => {
            const userName = tx.user?.display_name || tx.user?.username || 'Unknown';
            return `
            <tr class="border-b border-slate-800/40 hover:bg-slate-900/20 transition-colors">
                <td class="py-4 font-semibold text-white">${escapeHtml(userName)}</td>
                <td class="py-4 text-amber-400 font-bold">${tx.coin_amount} FC</td>
                <td class="py-4 text-gray-400 font-mono text-xs">${escapeHtml(tx.upi_transaction_ref || tx.payment_note || 'N/A')}</td>
                <td class="py-4 text-gray-400">${new Date(tx.created_at).toLocaleDateString()}</td>
                <td class="py-4 text-right">
                    <button onclick="approveCoins('${tx.id}', '${tx.user_id}', ${tx.coin_amount})" class="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition mr-2">Verify & Add Coins</button>
                    <button onclick="rejectCoins('${tx.id}')" class="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-400 text-xs px-3 py-1.5 rounded-lg transition">Deny</button>
                </td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error("Ledger reading error:", err);
        tableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-400">Failed to load purchases: ${err.message}</td></tr>`;
    }
}

// 6. Coin Actions — uses SECURITY DEFINER RPCs (bypasses RLS correctly)
async function approveCoins(txId, userId, coinsAmount) {
    try {
        const { error } = await window.sb.rpc('approve_coin_purchase', { p_purchase_id: txId });
        if (error) throw error;
        showGlobalAlert(`Payment approved! Credited +${coinsAmount} Fairy Coins.`);
        fetchPendingCoins();
    } catch (err) {
        showGlobalAlert(`Error: ${err.message}`, "error");
    }
}

async function rejectCoins(txId) {
    try {
        const { error } = await window.sb.rpc('reject_coin_purchase', { p_purchase_id: txId });
        if (error) throw error;
        showGlobalAlert("Coin request denied.");
        fetchPendingCoins();
    } catch (err) {
        showGlobalAlert(err.message, "error");
    }
}

// 7. Fetch Workers — uses actual schema (user_profiles + worker_posts)
async function fetchWorkersPool() {
    const tableBody = document.getElementById('workersTableBody');
    if (!tableBody) return;

    try {
        const { data, error } = await window.sb
            .from('user_profiles')
            .select('user_id, username, display_name, reputation_score, created_at')
            .order('reputation_score', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!data || data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-gray-500">No users found.</td></tr>`;
            return;
        }

        tableBody.innerHTML = data.map(user => {
            const name = user.display_name || user.username || 'Anonymous';
            const rep = user.reputation_score ? (user.reputation_score / 10).toFixed(1) : '0.0';
            return `
            <tr class="border-b border-slate-800/40 hover:bg-slate-900/20 transition-colors">
                <td class="py-4 font-semibold text-white">${escapeHtml(name)}</td>
                <td class="py-4 text-gray-400">@${escapeHtml(user.username || '—')}</td>
                <td class="py-4 text-amber-400 font-bold">${rep} ⭐</td>
                <td class="py-4 text-gray-400">${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
                <td class="py-4 text-right">
                    <a href="profile.html?username=${user.username}" class="text-blue-400 hover:text-blue-300 text-xs px-3 py-1.5 transition">View Profile</a>
                </td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error("Worker fetching error:", err);
        tableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-400">Failed to load users: ${err.message}</td></tr>`;
    }
}

// 8. Feedback Portal
async function fetchFeedbackPortal() {
    const listContainer = document.getElementById('feedbackListContainer');
    if (!listContainer) return;

    try {
        const { data, error } = await window.sb
            .from('feedback')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allFeedback = data || [];
        renderFeedbackCards(allFeedback);
        updateFeedbackCountBadges();

    } catch (err) {
        console.error("Feedback loading error:", err);
        listContainer.innerHTML = `
            <div class="col-span-full py-12 text-center text-rose-400 glass-card rounded-2xl">
                <i class="fa-solid fa-triangle-exclamation text-3xl mb-3 block"></i>
                Failed to load feedback: ${err.message}
            </div>`;
    }
}

function renderFeedbackCards(feedbackList) {
    const listContainer = document.getElementById('feedbackListContainer');
    if (!listContainer) return;

    if (feedbackList.length === 0) {
        listContainer.innerHTML = `
            <div class="col-span-full py-12 text-center text-gray-500 glass-card rounded-2xl">
                <i class="fa-solid fa-envelope-open text-3xl text-slate-700 mb-3 block"></i>
                No feedback entries found.
            </div>`;
        return;
    }

    const categoryBadges = {
        'Bug': 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        'Feature Request': 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
        'Appreciation': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        'Inquiry': 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    };

    const categoryIcons = {
        'Bug': 'fa-bug', 'Feature Request': 'fa-lightbulb',
        'Appreciation': 'fa-heart', 'Inquiry': 'fa-circle-question'
    };

    listContainer.innerHTML = feedbackList.map(item => {
        const badgeClass = categoryBadges[item.category] || 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
        const iconClass = categoryIcons[item.category] || 'fa-comments';

        return `
            <div class="glass-card rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition duration-150">
                <div>
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <span class="${badgeClass} px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                            <i class="fa-solid ${iconClass}"></i> ${escapeHtml(item.category)}
                        </span>
                        <span class="text-xs text-gray-500">${new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 class="text-white font-bold text-lg mb-2">${escapeHtml(item.subject)}</h3>
                    <p class="text-gray-400 text-sm whitespace-pre-wrap leading-relaxed mb-4" style="max-height:180px;overflow-y:auto">${escapeHtml(item.message)}</p>
                </div>
                <div class="flex items-center justify-between border-t border-slate-800/60 pt-4 mt-auto">
                    <div class="text-xs text-gray-500 truncate max-w-[200px]">
                        <span class="block text-[10px] text-gray-600 uppercase font-semibold">From Adventurer</span>
                        <span class="text-gray-400 font-medium">${escapeHtml(item.email || '—')}</span>
                    </div>
                    <button onclick="deleteFeedback('${item.id}')" class="text-rose-500 hover:text-white hover:bg-rose-950/30 px-3 py-1.5 rounded-lg text-xs transition duration-150 flex items-center gap-1.5 border border-transparent hover:border-rose-500/20 cursor-pointer">
                        <i class="fa-solid fa-trash-can"></i> Archive
                    </button>
                </div>
            </div>`;
    }).join('');
}

function filterFeedback() {
    const value = document.getElementById('feedbackFilter').value;
    if (value === 'ALL') {
        renderFeedbackCards(allFeedback);
    } else {
        renderFeedbackCards(allFeedback.filter(item => item.category === value));
    }
}

async function deleteFeedback(id) {
    if (!confirm("Archive this feedback?")) return;
    try {
        const { error } = await window.sb.from('feedback').delete().eq('id', id);
        if (error) throw error;
        showGlobalAlert("Feedback archived!");
        fetchFeedbackPortal();
    } catch (err) {
        showGlobalAlert(`Error: ${err.message}`, "error");
    }
}

function updateFeedbackCountBadges() {
    const badge = document.getElementById('feedback-count-badge');
    const sideBadge = document.getElementById('feedback-count-badge-side');
    const dot = document.getElementById('feedback-dot');

    if (badge) badge.textContent = allFeedback.length;
    if (sideBadge) sideBadge.textContent = allFeedback.length;
    if (dot) {
        if (allFeedback.length > 0) dot.classList.remove('hidden');
        else dot.classList.add('hidden');
    }
}

async function preloadFeedbackBadge() {
    try {
        const { data, error } = await window.sb.from('feedback').select('id');
        if (data && !error) {
            const count = data.length;
            const countDisplay = document.getElementById('feedback-count-badge');
            const dot = document.getElementById('feedback-dot');
            if (countDisplay) countDisplay.textContent = count;
            if (dot && count > 0) dot.classList.remove('hidden');
        }
    } catch (e) {
        console.warn("Failed to preload feedback badge.");
    }
}

// 9. Init
window.addEventListener('load', () => {
    setTimeout(checkAdminAuthorization, 200);
});
