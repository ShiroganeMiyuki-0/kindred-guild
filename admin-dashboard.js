// ============================================
// KINDRED GUILD — ADMIN DASHBOARD CONTROLLER (IMPROVED v2)
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async function checkAccess() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }

  const { data: profile, error } = await sb
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (error || !profile?.is_admin) {
    alert('Access Restricted. Yash / Admins only.');
    window.location.href = 'quest-board.html';
    return;
  }

  loadStats();
  loadPendingPurchases();
  loadVerifiedPurchases();
})();

async function loadStats() {
  const { count: pendingCount } = await sb
    .from('coin_purchases')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  document.getElementById('pendingCount').textContent = pendingCount || 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: verifiedToday } = await sb
    .from('coin_purchases')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'verified')
    .gte('created_at', today.toISOString());
  document.getElementById('verifiedTodayCount').textContent = verifiedToday || 0;

  const { count: totalVerified } = await sb
    .from('coin_purchases')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'verified');
  document.getElementById('totalVerifiedCount').textContent = totalVerified || 0;
}

window.switchTab = function(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(tabName + 'Tab').classList.add('active');
  
  if (tabName === 'history') loadVerifiedPurchases();
};

async function loadPendingPurchases() {
  const { data, error } = await sb
    .from('coin_purchases')
    .select(`
      *,
      user:user_profiles!coin_purchases_user_id_fkey(username, display_name)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    document.getElementById('adminQueueBody').innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="empty-state-icon">❌</div>
          Error loading data.
        </td>
      </tr>`;
    return;
  }

  const body = document.getElementById('adminQueueBody');
  if (!data || data.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="empty-state-icon">🎉</div>
          All queue cleared. No pending requests.
        </td>
      </tr>`;
    return;
  }

  body.innerHTML = data.map(p => {
    const user = p.user?.display_name || p.user?.username || 'Member';
    const date = new Date(p.created_at).toLocaleString('en-IN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const timeAgo = getTimeAgo(p.created_at);
    
    const noteHtml = p.payment_note 
      ? `<div class="payment-note-cell">${p.payment_note}</div>`
      : '<div class="no-utr">No payment note</div>';
    
    const utrHtml = p.upi_transaction_ref
      ? `<div class="utr-cell">UTR: ${p.upi_transaction_ref}</div>`
      : '<div class="no-utr">No UTR provided — match by note + amount</div>';

    return `
      <tr>
        <td>
          <div style="font-weight: 600;">${user}</div>
          <div style="font-size: 0.8rem; color: var(--text-dim);">@${p.user?.username || 'unknown'}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--accent); font-size: 1.1rem;">${p.coin_amount} FC</div>
          <div style="font-size: 0.8rem; color: var(--text-dim);">₹${p.coin_amount}</div>
        </td>
        <td>
          ${noteHtml}
          ${utrHtml}
        </td>
        <td>
          <div style="font-size: 0.85rem;">${date}</div>
          <div style="font-size: 0.75rem; color: var(--text-dim);">${timeAgo}</div>
        </td>
        <td>
          <button class="btn btn-approve" onclick="approvePurchase('${p.id}', '${p.user_id}', ${p.coin_amount})">
            ✅ Approve
          </button>
          <button class="btn btn-reject" onclick="rejectPurchase('${p.id}')">
            ❌ Reject
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  loadStats();
}

async function loadVerifiedPurchases() {
  const { data, error } = await sb
    .from('coin_purchases')
    .select(`
      *,
      user:user_profiles!coin_purchases_user_id_fkey(username, display_name)
    `)
    .in('status', ['verified', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(50);

  const container = document.getElementById('verifiedQueueBody');
  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="empty-state-icon">📜</div>
          No history yet.
        </td>
      </tr>`;
    return;
  }

  container.innerHTML = data.map(p => {
    const user = p.user?.display_name || p.user?.username || 'Member';
    const date = new Date(p.created_at).toLocaleString('en-IN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const statusClass = p.status === 'verified' ? 'badge-verified' : 'badge-rejected';
    const statusText = p.status === 'verified' ? 'Verified' : 'Rejected';
    
    return `
      <tr>
        <td>
          <div style="font-weight: 600;">${user}</div>
          <div style="font-size: 0.8rem; color: var(--text-dim);">@${p.user?.username || 'unknown'}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--accent);">${p.coin_amount} FC</div>
          <div style="font-size: 0.8rem; color: var(--text-dim);">₹${p.coin_amount}</div>
        </td>
        <td>
          <div class="payment-note-cell" style="font-size: 0.8rem;">${p.payment_note || '-'}</div>
          ${p.upi_transaction_ref ? `<div class="utr-cell">${p.upi_transaction_ref}</div>` : ''}
        </td>
        <td style="font-size: 0.85rem; color: var(--text-dim);">${date}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
      </tr>
    `;
  }).join('');
}

function getTimeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

window.approvePurchase = async function(purchaseId, userId, coins) {
  if (!confirm(`Verify and approve ${coins} FC to ledger?\n\nPlease confirm you received ₹${coins} in your UPI app with matching payment note/UTR.`)) return;

  const { error: txErr } = await sb
    .from('coin_purchases')
    .update({ status: 'verified' })
    .eq('id', purchaseId);

  if (txErr) {
    alert(txErr.message);
    return;
  }

  const { error: ledgerErr } = await sb
    .from('fairy_ledger')
    .insert({
      user_id: userId,
      amount: coins,
      reason: 'upi_purchase'
    });

  if (ledgerErr) {
    alert('Purchase status updated, but failed to credit coin ledger: ' + ledgerErr.message);
  } else {
    alert('✅ Approved successfully! Coins credited.');
  }

  loadPendingPurchases();
  loadVerifiedPurchases();
  loadStats();
};

window.rejectPurchase = async function(purchaseId) {
  if (!confirm('Reject transaction entry request?\n\nUser will not receive coins.')) return;

  const { error } = await sb
    .from('coin_purchases')
    .update({ status: 'rejected' })
    .eq('id', purchaseId);

  if (error) {
    alert(error.message);
  } else {
    alert('❌ Request rejected.');
  }

  loadPendingPurchases();
  loadVerifiedPurchases();
  loadStats();
};
