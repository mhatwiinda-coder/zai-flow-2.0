// Approvals Inbox - manager sign-off for gated actions (payroll, purchasing)
// Depends on: supabase-init.js, branch-context.js

document.addEventListener("DOMContentLoaded", () => {
  loadApprovals();
});

const ACTION_LABELS = {
  RUN_PAYROLL: '💰 Payroll',
  CONFIRM_PURCHASE_ORDER: '📦 Purchase Order',
  RECORD_PURCHASE_INVOICE: '🧾 Supplier Invoice',
  PROCESS_SUPPLIER_PAYMENT: '💳 Supplier Payment'
};

function loadApprovals() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) {
        console.error("❌ No branch context available");
        return;
      }

      const authUUID = getAuthUUID();
      if (!authUUID) {
        console.error("❌ Could not identify current user");
        return;
      }

      const { data, error } = await window.supabase.rpc('get_pending_approvals', {
        p_branch_id: context.branch_id,
        p_reviewer_id: authUUID
      });

      if (error) throw error;

      const list = document.getElementById('approvalsList');
      const empty = document.getElementById('noApprovals');

      if (!Array.isArray(data) || data.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
      }

      empty.style.display = 'none';
      list.innerHTML = data.map(req => {
        const label = ACTION_LABELS[req.action_type] || req.action_type;
        const when = new Date(req.created_at).toLocaleString('en-ZM');
        const amountHtml = req.amount != null
          ? `<div class="approval-amount">${formatMoney(req.amount)}</div>`
          : '';

        return `
          <div class="approval-card">
            <div class="row">
              <div style="flex: 1; min-width: 240px;">
                <div class="approval-title">${label} — ${escapeHtml(req.title)}</div>
                <div class="approval-meta">${escapeHtml(req.department_name)} · requested by ${escapeHtml(req.requested_by_name)} · ${when}</div>
                ${req.description ? `<div class="approval-desc">${escapeHtml(req.description)}</div>` : ''}
              </div>
              ${amountHtml}
            </div>
            <div class="approval-actions">
              <button class="btn-approve" onclick="approveRequest(${req.id})">✓ Approve</button>
              <button class="btn-reject" onclick="rejectRequest(${req.id})">✗ Reject</button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error("Load approvals error:", err);
      alert("Failed to load approvals: " + err.message);
    }
  })();
}

function approveRequest(requestId) {
  if (!confirm('Approve this request? The action will run immediately.')) return;

  (async () => {
    try {
      const authUUID = getAuthUUID();
      const { data, error } = await window.supabase.rpc('approve_approval_request', {
        p_request_id: requestId,
        p_reviewed_by: authUUID,
        p_notes: null
      });

      if (error) throw error;

      const result = data[0];
      alert((result.success ? '✅ ' : '⚠️ ') + result.message);
      loadApprovals();
    } catch (err) {
      console.error("Approve request error:", err);
      alert("Failed to approve: " + err.message);
    }
  })();
}

function rejectRequest(requestId) {
  const reason = prompt('Reason for rejecting this request (required - the requester will see this):');
  if (reason === null) return; // cancelled
  if (!reason.trim()) {
    alert('A reason is required.');
    return;
  }

  (async () => {
    try {
      const authUUID = getAuthUUID();
      const { data, error } = await window.supabase.rpc('reject_approval_request', {
        p_request_id: requestId,
        p_reviewed_by: authUUID,
        p_notes: reason.trim()
      });

      if (error) throw error;

      const result = data[0];
      alert((result.success ? '✅ ' : '⚠️ ') + result.message);
      loadApprovals();
    } catch (err) {
      console.error("Reject request error:", err);
      alert("Failed to reject: " + err.message);
    }
  })();
}

function formatMoney(value) {
  return "K " + Number(value || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
