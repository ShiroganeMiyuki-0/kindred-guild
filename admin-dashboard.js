/**
 * Kindred Guild - Admin Dashboard Manager
 * File: admin-dashboard.js
 */

let activeTab = 'quests';
let allFeedback = [];

// 1. Tab Switching Module
function switchTab(tabId) {
    activeTab = tabId;
    
    // Toggle Active Styles on tabs
    document.querySelectorAll('[id^="tab-"]').forEach(el => {
        el.classList.remove('active-tab');
    });
    const currentTab = document.getElementById(`tab-${tabId}`);
    if (currentTab) currentTab.classList.add('active-tab');

    // Toggle Panel Visibility
    document.querySelectorAll('.panel-view').forEach(panel => {
        panel.classList.add('hidden');
    });
    const currentPanel = document.getElementById(`panel-${tabId}`);
    if (currentPanel) currentPanel.classList.remove('hidden');

    // Load corresponding data
    if (tabId === 'quests') fetchPendingQuests();
    if (tabId === 'coins') fetchPendingCoins();
    if (tabId === 'workers') fetchWorkersPool();
    if (tabId === 'feedback') fetchFeedbackPortal();
}

// 2. Authentication Check
async function checkAdminAuthorization() {
    if (!window.supabase) {
        showGlobalAlert("Database connection is offline. Please review your credentials.", "error");
        return;
    }

    const { data: { session }, error } = await window.supabase.auth.getSession();
    if (error || !session) {
        window.location.href = 'auth.html';
        return;
    }

    const user = session.user;
    const isAdmin = user.user_metadata?.role === 'admin' || user.email?.includes('admin');
    
    if (!isAdmin) {
        showGlobalAlert("Access Denied: You do not carry the Guild Master credentials.", "error");
        // Force redirect regular players after a short delay
        setTimeout(() => {
            window.location.href = 'quest-board.html';
        }, 2500);
        return;
    }

    // Initialize Dashboard data
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

    setTimeout(() => {
        alertBox.classList.add('hidden');
    }, 5000);
}

// 4. Fetch Pending Quests Module
async function fetchPendingQuests() {
    const tableBody = document.getElementById('questsTableBody');
    if (!tableBody) return;

    try {
        const { data, error } = await window.supabase
            .from('quests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-gray-500">
                        <i class="fa-solid fa-circle-check text-emerald-400 mb-2 block text-xl"></i> No pending quests to approve.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = data.map(quest => `
            <tr class="border-b border-slate-800/40 hover:bg-slate-900/20 transition-colors">
                <td class="py-4 font-semibold text-white">${escapeHtml(quest.title)}</td>
                <td class="py-4 text-gray-400">${escapeHtml(quest.creator_email || 'Adventurer')}</td>
                <td class="py-4 text-amber-400 font-bold">${quest.reward_coins} FC</td>
                <td class="py-4 text-gray-400">${new Date(quest.created_at).toLocaleDateString()}</td>
                <td class="py-4 text-right">
                    <button onclick="approveQuest('${quest.id}')" class="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition mr-2">Approve</button>
                    <button onclick="rejectQuest('${quest.id}')" class="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-400 text-xs px-3 py-1.5 rounded-lg transition">Deny</button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Quests loading error:", err);
        tableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-400">Failed to load quests: ${err.message}</td></tr>`;
    }
}

// 5. Quest Actions
async function approveQuest(id) {
    try {
        const { error } = await window.supabase
            .from('quests')
            .update({ status: 'active' })
            .eq('id', id);

        if (error) throw error;
        showGlobalAlert("Quest successfully approved and published onto the Quest Board!");
        fetchPendingQuests();
    } catch (err) {
        showGlobalAlert(err.message, "error");
    }
}

async function rejectQuest(id) {
    try {
        const { error } = await window.supabase
            .from('quests')
            .update({ status: 'rejected' })
            .eq('id', id);

        if (error) throw error;
        showGlobalAlert("Quest has been rejected.");
        fetchPendingQuests();
    } catch (err) {
        showGlobalAlert(err.message, "error");
    }
}


// 6. Fetch Coin Ledger Transactions
async function fetchPendingCoins() {
    const tableBody = document.getElementById('coinsTableBody');
    if (!tableBody) return;

    try {
        const { data, error } = await window.supabase
            .from('coin_purchases')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-gray-500">
                        <i class="fa-solid fa-clipboard-check text-emerald-400 mb-2 block text-xl"></i> Ledger is clean. No pending verifications.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = data.map(tx => `
            <tr class="border-b border-slate-800/40 hover:bg-slate-900/20 transition-colors">
                <td class="py-4 font-semibold text-white">${escapeHtml(tx.email)}</td>
                <td class="py-4 text-amber-400 font-bold">${tx.amount_coins} FC</td>
                <td class="py-4 text-gray-400 font-mono text-xs">${escapeHtml(tx.utr || 'N/A')}</td>
                <td class="py-4 text-gray-400">${new Date(tx.created_at).toLocaleDateString()}</td>
                <td class="py-4 text-right">
                    <button onclick="approveCoins('${tx.id}', '${tx.user_id}', ${tx.amount_coins})" class="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition mr-2">Verify & Add Coins</button>
                    <button onclick="rejectCoins('${tx.id}')" class="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-400 text-xs px-3 py-1.5 rounded-lg transition">Deny</button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Ledger reading error:", err);
        tableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-400">Failed to scan ledger: ${err.message}</td></tr>`;
    }
}

// 7. Coin Actions
async function approveCoins(txId, userId, coinsAmount) {
    try {
        // Step A: Approve transactional ticket
        const { error: txError } = await window.supabase
            .from('coin_purchases')
            .update({ status: 'verified' })
            .eq('id', txId);

        if (txError) throw txError;

        // Step B: Get the user's current coins
        const { data: profile, error: profileGetError } = await window.supabase
            .from('profiles')
            .select('coins')
            .eq('id', userId)
            .single();

        if (profileGetError) throw profileGetError;

        // Step C: Increment and save balance
        const updatedCoins = (profile.coins || 0) + coinsAmount;
        const { error: profileUpdateError } = await window.supabase
            .from('profiles')
            .update({ coins: updatedCoins })
            .eq('id', userId);

        if (profileUpdateError) throw profileUpdateError;

        showGlobalAlert(`Payment approved! credited +${coinsAmount} Fairy Coins to the adventurer's wallet.`);
        fetchPendingCoins();
    } catch (err) {
        showGlobalAlert(`Error: ${err.message}`, "error");
    }
}

async function rejectCoins(txId) {
    try {
        const { error } = await window.supabase
            .from('coin_purchases')
            .update({ status: 'denied' })
            .eq('id', txId);

        if (error) throw error;
        showGlobalAlert("Coin request denied and marked as invalid transaction.");
        fetchPendingCoins();
    } catch (err) {
        showGlobalAlert(err.message, "error");
    }
}


// 8. Fetch Worker Pools Tab
async function fetchWorkersPool() {
    const tableBody = document.getElementById('workersTableBody');
    if (!tableBody) return;

    try {
        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('is_worker', true)
            .order('reputation', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-gray-500">
                        No registered workers found in the database.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = data.map(worker => `
            <tr class="border-b border-slate-800/40 hover:bg-slate-900/20 transition-colors">
                <td class="py-4 font-semibold text-white">${escapeHtml(worker.username || 'Anonymous')}</td>
                <td class="py-4 text-gray-400">${escapeHtml(worker.skills || 'General Helper')}</td>
                <td class="py-4 text-amber-400 font-bold">${worker.reputation || 0} ⭐</td>
                <td class="py-4 text-gray-400">${worker.created_at ? new Date(worker.created_at).toLocaleDateString() : 'N/A'}</td>
                <td class="py-4 text-right">
                    <button onclick="adjustReputation('${worker.id}', 5)" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-2.5 py-1.5 rounded-lg transition mr-1">+5 Rep</button>
                    <button onclick="adjustReputation('${worker.id}', -5)" class="bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs px-2.5 py-1.5 rounded-lg transition">Reduce Rep</button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Worker fetching error:", err);
        tableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-400">Failed to load registry: ${err.message}</td></tr>`;
    }
}

async function adjustReputation(workerId, amount) {
    try {
        const { data: worker, error: fetchErr } = await window.supabase
            .from('profiles')
            .select('reputation')
            .eq('id', workerId)
            .single();

        if (fetchErr) throw fetchErr;

        const currentRep = worker.reputation || 0;
        const newRep = Math.max(0, currentRep + amount);

        const { error: updateErr } = await window.supabase
            .from('profiles')
            .update({ reputation: newRep })
            .eq('id', workerId);

        if (updateErr) throw updateErr;

        showGlobalAlert(`Reputation adjusted successfully for the worker!`);
        fetchWorkersPool();
    } catch (err) {
        showGlobalAlert(err.message, "error");
    }
}


// 9. Guild Feedback Fetch & Display (NEW)
async function fetchFeedbackPortal() {
    const listContainer = document.getElementById('feedbackListContainer');
    if (!listContainer) return;

    try {
        const { data, error } = await window.supabase
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
                Failed to load feedback from Supabase: ${err.message}
            </div>
        `;
    }
}

function renderFeedbackCards(feedbackList) {
    const listContainer = document.getElementById('feedbackListContainer');
    if (!listContainer) return;

    if (feedbackList.length === 0) {
        listContainer.innerHTML = `
            <div class="col-span-full py-12 text-center text-gray-500 glass-card rounded-2xl">
                <i class="fa-solid fa-envelope-open text-3xl text-slate-700 mb-3 block"></i>
                No feedback entries found in this category.
            </div>
        `;
        return;
    }

    const categoryBadges = {
        'Bug': 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        'Feature Request': 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
        'Appreciation': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        'Inquiry': 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    };

    const categoryIcons = {
        'Bug': 'fa-bug',
        'Feature Request': 'fa-lightbulb',
        'Appreciation': 'fa-heart',
        'Inquiry': 'fa-circle-question'
    };

    listContainer.innerHTML = feedbackList.map(item => {
        const badgeClass = categoryBadges[item.category] || 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
        const iconClass = categoryIcons[item.category] || 'fa-comments';
        
        return `
            <div class="glass-card rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition duration-150">
                <div>
                    <!-- Header -->
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <span class="${badgeClass} px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                            <i class="fa-solid ${iconClass}"></i> ${escapeHtml(item.category)}
                        </span>
                        <span class="text-xs text-gray-500">${new Date(item.created_at).toLocaleDateString()}</span>
                    </div>

                    <!-- Content -->
                    <h3 class="text-white font-bold text-lg mb-2">${escapeHtml(item.subject)}</h3>
                    <p class="text-gray-400 text-sm whitespace-pre-wrap leading-relaxed mb-4" style="max-height: 180px; overflow-y: auto;">${escapeHtml(item.message)}</p>
                </div>

                <!-- Footer & Action -->
                <div class="flex items-center justify-between border-t border-slate-800/60 pt-4 mt-auto">
                    <div class="text-xs text-gray-500 truncate max-w-[200px]">
                        <span class="block text-[10px] text-gray-600 uppercase font-semibold">From Adventurer</span>
                        <span class="text-gray-400 font-medium">${escapeHtml(item.email)}</span>
                    </div>
                    <button onclick="deleteFeedback('${item.id}')" class="text-rose-500 hover:text-white hover:bg-rose-950/30 px-3 py-1.5 rounded-lg text-xs transition duration-150 flex items-center gap-1.5 border border-transparent hover:border-rose-500/20 cursor-pointer">
                        <i class="fa-solid fa-trash-can"></i> Archive
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// FILTER FEEDBACK LOCAL DROPDOWN
function filterFeedback() {
    const value = document.getElementById('feedbackFilter').value;
    if (value === 'ALL') {
        renderFeedbackCards(allFeedback);
    } else {
        const filtered = allFeedback.filter(item => item.category === value);
        renderFeedbackCards(filtered);
    }
}

// ARCHIVE / DELETE FEEDBACK
async function deleteFeedback(id) {
    if (!confirm("Are you sure you want to archive and clear this feedback from the keep?")) return;

    try {
        const { error } = await window.supabase
            .from('feedback')
            .delete()
            .eq('id', id);

        if (error) throw error;
        showGlobalAlert("Feedback successfully archived!");
        fetchFeedbackPortal();

    } catch (err) {
        showGlobalAlert(`Error: ${err.message}`, "error");
    }
}

// DYNAMIC BADGE CALCULATOR
function updateFeedbackCountBadges() {
    const badge = document.getElementById('feedback-count-badge');
    const sideBadge = document.getElementById('feedback-count-badge-side');
    const dot = document.getElementById('feedback-dot');
    
    if (badge) badge.textContent = allFeedback.length;
    if (sideBadge) sideBadge.textContent = allFeedback.length;
    
    if (dot) {
        if (allFeedback.length > 0) {
            dot.classList.remove('hidden');
        } else {
            dot.classList.add('hidden');
        }
    }
}

// ASYNC PRELOADER BADGE
async function preloadFeedbackBadge() {
    try {
        const { data, error } = await window.supabase
            .from('feedback')
            .select('id');
        if (data && !error) {
            const count = data.length;
            const countDisplay = document.getElementById('feedback-count-badge');
            const dot = document.getElementById('feedback-dot');
            if (countDisplay) countDisplay.textContent = count;
            if (dot && count > 0) dot.classList.remove('hidden');
        }
    } catch (e) {
        console.warn("Failed to preload feedback status badge.");
    }
}

// Helper: Escape raw HTML values securely
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// 10. Startup Lifecycle initialization
window.addEventListener('load', () => {
    // Wait briefly for Supabase to establish session
    setTimeout(checkAdminAuthorization, 200);
});
