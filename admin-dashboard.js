// ============================================
// KINDRED GUILD — ADMIN DASHBOARD CONTROLLER
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
    alert('Access Restricted. Admins only.');
    window.location.href = 'quest-board.html';
    return;
  }

  loadPendingPurchases();
})();

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
    return;
  }

  const body = document.getElementById('adminQueueBody');
  if (data.length === 0) {
    body.innerHTML = '<tr><td colspan="5" style="color: var(--text-dim); text-align: center; padding: 30px;">All queue cleared. No pending requests.</td></tr>';
    return;
  }

  body.innerHTML = data.map(p => {
    const user = p.user?.display_name || p.user?.username || 'Member';
    const date = new Date(p.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    return `
      <tr>
        <td><strong>${user}</strong></td>
        <td style="color: var(--accent); font-weight: bold;">${p.coin_amount} FC</td>
        <td><code>${p.upi_transaction_ref}</code></td>
        <td>${date}</td>
        <td>
          <button class="btn btn-approve" onclick="approvePurchase('${p.id}', '${p.user_id}', ${p.coin_amount})">Approve</button>
          <button class="btn btn-reject" onclick="rejectPurchase('${p.id}')">Reject</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.approvePurchase = async function(purchaseId, userId, coins) {
  if (!confirm(`Are you sure you want to approve this purchase? ${coins} FC will be credited to ledger.`)) return;

  // Update transaction status
  const { error: txErr } = await sb
    .from('coin_purchases')
    .update({ status: 'verified' })
    .eq('id', purchaseId);

  if (txErr) {
    alert(txErr.message);
    return;
  }

  // Credit user fairy ledger
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
    alert('Approved successfully!');
  }

  loadPendingPurchases();
}

window.rejectPurchase = async function(purchaseId) {
  if (!confirm('Are you sure you want to reject this request?')) return;

  const { error } = await sb
    .from('coin_purchases')
    .update({ status: 'rejected' })
    .eq('id', purchaseId);

  if (error) {
    alert(error.message);
  } else {
    alert('Request rejected.');
  }

  loadPendingPurchases();
}
